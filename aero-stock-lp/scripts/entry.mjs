#!/usr/bin/env node
// aero-stock-lp entry: three phases because there are three transaction
// boundaries (your own swap moves the pool price; sizing must re-read state
// after each tx mines). Scripts NEVER sign — they emit unsigned
// {to, data, value, chainId} objects; the agent submits them via Bankr,
// one at a time, checking each receipt.
//
//   entry.mjs plan   --market AAPL --usd 50 --wallet 0x… --quote 311.20 --quote-age-s 90 [--iv 0.28 | --w 0.04] [--width standard]
//   entry.mjs size   --market AAPL --usd 50 --wallet 0x… --tick-lower -11710 --tick-upper -10910   (ticks from plan output)
//   entry.mjs settle --market AAPL --wallet 0x… --mint-tx 0x… [--entry-usd 50] [--state-path p]
//
// Output: ONE JSON object on stdout: {ok, phase, gates?, band?, txs?, report, next?}
// Gates fail closed: any failed gate -> exit code 1 and {ok:false, gate:"…"}.

import {
  getMarket,
  USDC,
  SEL,
  MAX_UINT256,
  ERC721_TRANSFER_TOPIC,
  CL_GAUGE_FACTORY,
} from "./lib/markets.mjs";
import {
  addrWord,
  uintWord,
  intWord,
  ethCall,
  multicall,
  wordAt,
  toBigInt,
  toInt,
  getReceipt,
  geckoPool,
  aeroSpot,
  aeroHourlyCandles,
  tx,
} from "./lib/chain.mjs";
import {
  priceFromSqrtX96,
  priceFromTick,
  buildBand,
  ticksForBand,
  stockShare,
  wFromIV,
  wFromHourlyCandles,
} from "./lib/math.mjs";
import { loadState, saveState } from "./lib/positions.mjs";

// ---------- tiny arg parser ----------
const [, , phase, ...rest] = process.argv;
const args = {};
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith("--")) {
    const key = rest[i].slice(2);
    const next = rest[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      args[key] = next;
      i++;
    } else args[key] = true;
  }
}

function out(obj, code = 0) {
  console.log(JSON.stringify(obj, null, 2));
  process.exit(code);
}
function fail(gate, detail, extra = {}) {
  out({ ok: false, phase, gate, detail, ...extra }, 1);
}
function need(name) {
  const v = args[name];
  if (v === undefined || v === true) fail("args", `--${name} is required`);
  return v;
}

const deadline = () => Math.floor(Date.now() / 1000) + 600;

// Approve MAX, never exact: pool math rounds amounts owed up a wei and an
// exact allowance makes mint revert STF. Spender must be an allowlisted
// NPM/router/gauge from markets.mjs — the callers only pass those.
function approveTxIfNeeded(allowanceWord, token, spender, neededRaw, label) {
  const current = allowanceWord ? toBigInt(allowanceWord) : 0n;
  if (current >= neededRaw) return [];
  return [tx(token, SEL.approve + addrWord(spender) + uintWord(MAX_UINT256), label)];
}

// ============================== PLAN ==============================
async function plan() {
  const market = need("market");
  const M = getMarket(market);
  const usd = Number(need("usd"));
  const wallet = need("wallet");
  if (!(usd > 0)) fail("args", "--usd must be > 0");

  // quote gate inputs are REQUIRED — no fresh real quote, no entry, period.
  if (M.kind === "equity" && (args.quote === undefined || args["quote-age-s"] === undefined)) {
    fail("nav", "equity entry requires --quote and --quote-age-s (fresh real-world quote)");
  }

  const gecko = await geckoPool(M.pool);
  const [slot0Res, usdcBalRes, usdcAllowRes] = await multicall([
    { to: M.pool, data: SEL.slot0 },
    { to: USDC, data: SEL.balanceOf + addrWord(wallet) },
    { to: USDC, data: SEL.allowance + addrWord(wallet) + addrWord(M.router) },
  ]);
  if (!slot0Res.ok) fail("rpc", "slot0 read failed");
  const poolPrice = priceFromSqrtX96(toBigInt(wordAt(slot0Res.data, 0)), M.decimals);

  // real quote: equities require it; AERO uses Coinbase spot as the quote
  let quote, quoteAge;
  if (M.kind === "equity") {
    quote = Number(args.quote);
    quoteAge = Number(args["quote-age-s"]);
  } else {
    quote = await aeroSpot();
    quoteAge = 0;
  }

  // vol input for the band: equities need --iv or --w; AERO self-computes
  let w;
  if (args.w !== undefined) w = Number(args.w);
  else if (args.iv !== undefined) w = wFromIV(Number(args.iv));
  else if (M.kind === "crypto") w = wFromHourlyCandles(await aeroHourlyCandles());
  const width = args.width || "standard";

  // ---------- gates (§5) — ALL must pass; fail closed ----------
  const volBrake = M.kind === "equity" ? 7 : 15;
  const usdcBal = usdcBalRes.ok ? Number(toBigInt(wordAt(usdcBalRes.data, 0))) / 1e6 : 0;
  const ageHours = gecko.createdAt
    ? (Date.now() - Date.parse(gecko.createdAt)) / 3.6e6
    : Infinity;
  const gates = [
    { name: "quote-fresh", pass: quoteAge <= 900, value: quoteAge, limit: "<=900s" },
    {
      name: "nav",
      pass: quote > 0 && Math.abs(poolPrice / quote - 1) <= 0.03,
      value: quote > 0 ? +(100 * (poolPrice / quote - 1)).toFixed(2) : null,
      limit: "pool within 3% of real quote",
    },
    {
      name: "unseeded",
      pass: quote > 0 && poolPrice / quote < 2 && poolPrice / quote > 0.5,
      value: +(poolPrice / quote).toFixed(3),
      limit: "pool/quote in (0.5, 2) — outside = fictitious price",
    },
    { name: "tvl", pass: gecko.tvlUsd >= 20000, value: Math.round(gecko.tvlUsd), limit: ">=$20k" },
    { name: "volume", pass: gecko.vol24hUsd > 0, value: Math.round(gecko.vol24hUsd), limit: ">0" },
    { name: "pool-age", pass: ageHours >= 48, value: Math.round(ageHours), limit: ">=48h" },
    {
      name: "size-vs-tvl",
      pass: usd <= 0.25 * gecko.tvlUsd,
      value: +((100 * usd) / gecko.tvlUsd).toFixed(1),
      limit: "<=25% of pool TVL",
    },
    {
      name: "vol-brake",
      pass: Math.abs(gecko.change24hPct) < volBrake,
      value: gecko.change24hPct,
      limit: `|24h move| < ${volBrake}%`,
    },
    { name: "vol-input", pass: w > 0, value: w ?? null, limit: "honest w required (no guess)" },
  ];
  const failed = gates.find((g) => !g.pass);
  if (failed) fail(failed.name, failed.limit, { gates });

  // ---------- band + swap sizing ----------
  const band = buildBand(poolPrice, quote, w, width, M.decimals, M.tickSpacing);
  const share = stockShare((poolPrice + quote) / 2, band.bandLow, band.bandHigh);

  // absorb loose stock already in the wallet
  const [stockBalRes] = await multicall([
    { to: M.token, data: SEL.balanceOf + addrWord(wallet) },
  ]);
  const looseStock = stockBalRes.ok
    ? Number(toBigInt(wordAt(stockBalRes.data, 0))) / 10 ** M.decimals
    : 0;
  const looseStockUsd = looseStock * poolPrice;
  const swapUsd = Math.max(0, usd * share - looseStockUsd);

  const txs = [];
  if (swapUsd >= 0.5) {
    const amountInRaw = BigInt(Math.round(swapUsd * 1e6));
    txs.push(
      ...approveTxIfNeeded(
        usdcAllowRes.ok ? wordAt(usdcAllowRes.data, 0) : null,
        USDC,
        M.router,
        amountInRaw,
        `approve USDC -> ${market} router`
      )
    );
    const expectedOut = (swapUsd / poolPrice) * (1 - M.fee);
    const minOutRaw = BigInt(Math.round(expectedOut * 0.985 * 10 ** M.decimals));
    txs.push(
      tx(
        M.router,
        SEL.exactInputSingle +
          addrWord(USDC) +
          addrWord(M.token) +
          intWord(M.tickSpacing) +
          addrWord(wallet) +
          uintWord(deadline()) +
          uintWord(amountInRaw) +
          uintWord(minOutRaw) +
          uintWord(0),
        `swap $${swapUsd.toFixed(2)} USDC -> ${market} (minOut 1.5% floor)`
      )
    );
  }

  out({
    ok: true,
    phase: "plan",
    gates,
    market,
    usd,
    poolPrice: +poolPrice.toFixed(4),
    quote,
    band: {
      low: +band.bandLow.toFixed(4),
      high: +band.bandHigh.toFixed(4),
      tickLower: band.tickLower,
      tickUpper: band.tickUpper,
      width,
      w: +w.toFixed(5),
    },
    stockShare: +share.toFixed(4),
    looseStockAbsorbedUsd: +looseStockUsd.toFixed(2),
    needsConcentrationConfirm: usd > 0.5 * usdcBal,
    walletUsdc: +usdcBal.toFixed(2),
    txs,
    report: `Deposit $${usd} into the ${market} pool at $${band.bandLow.toFixed(2)} – $${band.bandHigh.toFixed(2)}?`,
    next:
      (txs.length > 0
        ? "submit txs in order via Bankr (confirm with user first), then run: "
        : "no swap needed; run: ") +
      `entry.mjs size --market ${market} --usd ${usd} --wallet ${wallet} --tick-lower ${band.tickLower} --tick-upper ${band.tickUpper}`,
  });
}

// ============================== SIZE ==============================
async function size() {
  const market = need("market");
  const M = getMarket(market);
  const wallet = need("wallet");
  const usd = Number(need("usd"));

  // re-read slot0 AFTER the swap — your own swap moved the price
  const [slot0Res, usdcBalRes, stockBalRes, a0Res, a1Res] = await multicall([
    { to: M.pool, data: SEL.slot0 },
    { to: USDC, data: SEL.balanceOf + addrWord(wallet) },
    { to: M.token, data: SEL.balanceOf + addrWord(wallet) },
    { to: USDC, data: SEL.allowance + addrWord(wallet) + addrWord(M.npm) },
    { to: M.token, data: SEL.allowance + addrWord(wallet) + addrWord(M.npm) },
  ]);
  if (!slot0Res.ok) fail("rpc", "slot0 read failed");
  const price = priceFromSqrtX96(toBigInt(wordAt(slot0Res.data, 0)), M.decimals);

  // Prefer the EXACT ticks from plan's output (--tick-lower/--tick-upper);
  // fall back to re-snapping from band prices (rounded prices can shift a
  // snap boundary by one spacing).
  let band;
  if (args["tick-lower"] !== undefined && args["tick-upper"] !== undefined) {
    const tickLower = Number(args["tick-lower"]);
    const tickUpper = Number(args["tick-upper"]);
    if (
      !Number.isInteger(tickLower) ||
      !Number.isInteger(tickUpper) ||
      tickLower % M.tickSpacing !== 0 ||
      tickUpper % M.tickSpacing !== 0 ||
      tickLower >= tickUpper
    )
      fail("args", "ticks must be spacing-aligned integers with tickLower < tickUpper");
    band = {
      tickLower,
      tickUpper,
      bandLow: priceFromTick(tickUpper, M.decimals),
      bandHigh: priceFromTick(tickLower, M.decimals),
    };
  } else {
    band = ticksForBand(Number(need("band-low")), Number(need("band-high")), M.decimals, M.tickSpacing);
  }

  // Both sides are capped by the $usd budget — a wallet holding loose stock
  // or USDC beyond this entry's budget must NOT have it swept into the mint.
  const stockBalRaw = stockBalRes.ok ? toBigInt(wordAt(stockBalRes.data, 0)) : 0n;
  const share = stockShare(price, band.bandLow, band.bandHigh);
  const stockBudgetRaw = BigInt(Math.round(((usd * share) / price) * 10 ** M.decimals));
  const stockRaw = stockBalRaw < stockBudgetRaw ? stockBalRaw : stockBudgetRaw;
  const stockUsd = (Number(stockRaw) / 10 ** M.decimals) * price;
  const usdcRaw = usdcBalRes.ok ? toBigInt(wordAt(usdcBalRes.data, 0)) : 0n;
  const usdcBudget = Math.max(0, usd - stockUsd);
  const dust = 250000n; // keep ~$0.25 of USDC back for rounding dust
  const usdcAvail = usdcRaw > dust ? usdcRaw - dust : 0n;
  const amount0 = usdcAvail < BigInt(Math.round(usdcBudget * 1e6)) ? usdcAvail : BigInt(Math.round(usdcBudget * 1e6));

  const txs = [
    ...approveTxIfNeeded(a0Res.ok ? wordAt(a0Res.data, 0) : null, USDC, M.npm, amount0, "approve USDC -> NPM"),
    ...approveTxIfNeeded(a1Res.ok ? wordAt(a1Res.data, 0) : null, M.token, M.npm, stockRaw, `approve ${market} -> NPM`),
    tx(
      M.npm,
      SEL.mint +
        addrWord(USDC) +
        addrWord(M.token) +
        intWord(M.tickSpacing) +
        intWord(band.tickLower) +
        intWord(band.tickUpper) +
        uintWord(amount0) +
        uintWord(stockRaw) +
        uintWord(0) +
        uintWord(0) +
        addrWord(wallet) +
        uintWord(deadline()) +
        uintWord(0), // sqrtPriceX96 = 0: pool must already exist
      `mint ${market} position $${(Number(amount0) / 1e6 + stockUsd).toFixed(2)} at $${band.bandLow.toFixed(2)} – $${band.bandHigh.toFixed(2)}`
    ),
  ];

  out({
    ok: true,
    phase: "size",
    market,
    postSwapPrice: +price.toFixed(4),
    band: { low: +band.bandLow.toFixed(4), high: +band.bandHigh.toFixed(4), tickLower: band.tickLower, tickUpper: band.tickUpper },
    amount0Usdc: Number(amount0) / 1e6,
    amount1Stock: Number(stockRaw) / 10 ** M.decimals,
    txs,
    report: `Mint sized at post-swap price $${price.toFixed(2)}.`,
    next: "submit txs in order via Bankr, then run: entry.mjs settle --mint-tx <hash>",
  });
}

// ============================== SETTLE ==============================
async function settle() {
  const market = need("market");
  const M = getMarket(market);
  const wallet = need("wallet");
  const mintTx = need("mint-tx");

  const receipt = await getReceipt(mintTx);
  if (!receipt) fail("receipt", "tx not found or not yet mined — retry when mined");
  if (receipt.status !== "0x1") fail("receipt", `mint tx reverted (status ${receipt.status})`);

  // tokenId comes from the mined receipt, never a simulation
  const log = (receipt.logs || []).find(
    (l) =>
      l.address.toLowerCase() === M.npm.toLowerCase() &&
      l.topics?.[0] === ERC721_TRANSFER_TOPIC &&
      toBigInt(l.topics?.[1]?.slice(2)) === 0n
  );
  if (!log) fail("receipt", "mint mined but no NPM Transfer-from-zero log — recover from chain, do NOT re-mint");
  const tokenId = toBigInt(log.topics[3].slice(2));
  const idW = uintWord(tokenId);

  // route decision (§6): compare the POTS per unit of in-range liquidity
  const [posRes, liqRes, stakedLiqRes, skimRes, rateRes, minStakeRes] = await multicall([
    { to: M.npm, data: SEL.positions + idW },
    { to: M.pool, data: SEL.liquidity },
    { to: M.pool, data: SEL.stakedLiquidity },
    { to: M.pool, data: SEL.unstakedFee },
    { to: M.gauge, data: SEL.rewardRate },
    { to: CL_GAUGE_FACTORY, data: SEL.minStakeTimes + addrWord(M.pool) },
  ]);
  const yourL = posRes.ok ? toBigInt(wordAt(posRes.data, 7)) : 0n;
  const poolL = liqRes.ok ? toBigInt(wordAt(liqRes.data, 0)) : 1n;
  const stakedL = stakedLiqRes.ok ? toBigInt(wordAt(stakedLiqRes.data, 0)) : 0n;
  const skim = skimRes.ok ? Number(toBigInt(wordAt(skimRes.data, 0))) / 1e6 : 0.1;
  const ratePerSec = rateRes.ok ? Number(toBigInt(wordAt(rateRes.data, 0))) / 1e18 : 0;
  const minStakeS = minStakeRes.ok ? Number(toBigInt(wordAt(minStakeRes.data, 0))) : 0;

  const [gecko, spot] = await Promise.all([geckoPool(M.pool), aeroSpot()]);
  const feePotYr = gecko.vol24hUsd * M.fee * 365;
  const emisPotYr = ratePerSec * 31536000 * spot;
  // per unit of in-range liquidity; prospective staked includes your own dilution
  const feePerL = poolL > 0n ? (feePotYr * (1 - skim)) / Number(poolL) : 0;
  const emisPerL = (emisPotYr) / Number(stakedL + yourL || 1n);
  const route = emisPerL > feePerL ? "staked" : "unstaked";

  const txs =
    route === "staked"
      ? [
          tx(M.npm, SEL.approve + addrWord(M.gauge) + idW, `approve NFT #${tokenId} -> gauge`),
          tx(M.gauge, SEL.gaugeDeposit + idW, `stake #${tokenId} for AERO emissions`),
        ]
      : [];

  // record the two unrecoverable fields
  const statePathArg = args["state-path"];
  const state = loadState(statePathArg);
  const entryUsd = args["entry-usd"] !== undefined ? Number(args["entry-usd"]) : null;
  const now = new Date().toISOString();
  state.positions = (state.positions || []).filter((p) => p.tokenId !== String(tokenId));
  state.positions.push({
    market,
    tokenId: String(tokenId),
    entryUsd,
    enteredAt: now,
    lastMintAt: now,
    recenters: [],
  });
  saveState(state, statePathArg);

  out({
    ok: true,
    phase: "settle",
    market,
    tokenId: String(tokenId),
    route,
    routeMath: {
      feePotYrUsd: +feePotYr.toFixed(0),
      emissionsPotYrUsd: +emisPotYr.toFixed(0),
      feePerL,
      emisPerL,
      unstakedFeeSkim: skim,
      minStakeTimeS: minStakeS,
    },
    txs,
    stateRecorded: { entryUsd, enteredAt: now },
    memoryLine: `aero-stock-lp: active Aerodrome LP positions on Base — see ~/.aero-stock-lp/state.json. Manage with the aero-stock-lp skill.`,
    report:
      route === "staked"
        ? `Position #${tokenId} minted; staking wins (emissions pot $${Math.round(emisPotYr)}/yr vs fee pot $${Math.round(feePotYr)}/yr) — submit the 2 stake txs.`
        : `Position #${tokenId} minted; fee route wins — NFT stays in the wallet, done.`,
    next: txs.length ? "submit stake txs via Bankr, then report to the user" : "report to the user",
  });
}

// ---------- dispatch ----------
const phases = { plan, size, settle };
if (!phases[phase]) {
  out(
    { ok: false, gate: "args", detail: "usage: entry.mjs <plan|size|settle> --market … (see file header)" },
    1
  );
}
phases[phase]().catch((e) => fail("error", String(e?.message || e)));
