#!/usr/bin/env node
// hood-stock-lp entry: three phases because there are three transaction
// boundaries (your own swap moves the pool price; sizing must re-read state
// after each tx mines). Scripts NEVER sign — they emit unsigned
// {to, data, value, chainId: 4663} objects; the agent submits them via
// Bankr, one at a time, checking each receipt.
//
//   entry.mjs plan   --market TSLA --usd 50 --wallet 0x… --quote 311.20 --quote-age-s 90 [--iv 0.45 | --w 0.06] [--width standard]
//   entry.mjs size   --market TSLA --usd 50 --wallet 0x… --tick-lower -60000 --tick-upper -54000   (ticks from plan output)
//   entry.mjs settle --market TSLA --wallet 0x… --mint-tx 0x… [--entry-usd 50] [--recenter-dir up|down] [--state-path p]
//
// Output: ONE JSON object on stdout: {ok, phase, gates?, band?, txs?, report, next?}
// Gates fail closed: any failed gate -> exit code 1 and {ok:false, gate:"…"}.

import {
  getMarket,
  USDG,
  NPM_V3,
  ROUTER_V3,
  POSM,
  UNIVERSAL_ROUTER,
  SEL,
  MAX_UINT256,
  ERC721_TRANSFER_TOPIC,
} from "./lib/markets.mjs";
import {
  addrWord,
  uintWord,
  intWord,
  multicall,
  wordAt,
  toBigInt,
  toInt,
  getReceipt,
  geckoPool,
  tx,
} from "./lib/chain.mjs";
import {
  priceFromSqrtX96,
  priceFromTick,
  buildBand,
  bandFromTicks,
  stockShare,
  wFromIV,
  liquidityForAmounts,
} from "./lib/math.mjs";
import {
  poolKeyFor,
  buyStockZeroForOne,
  sellStockZeroForOne,
  swapData,
  mintData,
  quoteSwap,
  approvalTxs,
  v4PoolState,
} from "./lib/v4.mjs";
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

const deadline = () => Math.floor(Date.now() / 1000) + 1200;

// Approve MAX, never exact: pool math rounds amounts owed up a wei and an
// exact allowance reverts the mint. Spenders are only the allowlisted
// router/NPM/Permit2 addresses from markets.mjs.
function approveTxIfNeeded(allowanceWord, token, spender, neededRaw, label) {
  const current = allowanceWord ? toBigInt(allowanceWord) : 0n;
  if (current >= neededRaw) return [];
  return [tx(token, SEL.approve + addrWord(spender) + uintWord(MAX_UINT256), label)];
}

function v3SwapTx(tokenIn, tokenOut, fee, wallet, amountInRaw, minOutRaw, label) {
  return tx(
    ROUTER_V3,
    SEL.exactInputSingle +
      addrWord(tokenIn) +
      addrWord(tokenOut) +
      uintWord(fee) +
      addrWord(wallet) +
      uintWord(amountInRaw) +
      uintWord(minOutRaw) +
      uintWord(0), // SwapRouter02 shape: no deadline field, sqrtPriceLimitX96 = 0
    label
  );
}

async function readPoolAndBalances(M, wallet) {
  const calls = [
    { to: USDG, data: SEL.balanceOf + addrWord(wallet) },
    { to: M.token, data: SEL.balanceOf + addrWord(wallet) },
  ];
  if (M.venue === "v3") calls.push({ to: M.pool, data: SEL.slot0 });
  const res = await multicall(calls);
  const usdgRaw = res[0].ok ? toBigInt(wordAt(res[0].data, 0)) : 0n;
  const stockRaw = res[1].ok ? toBigInt(wordAt(res[1].data, 0)) : 0n;
  let poolPrice, sqrtP;
  if (M.venue === "v3") {
    if (!res[2].ok) fail("rpc", "slot0 read failed");
    const sqrtPriceX96 = toBigInt(wordAt(res[2].data, 0));
    poolPrice = priceFromSqrtX96(sqrtPriceX96, M.usdgIs0);
    sqrtP = Number(sqrtPriceX96) / 2 ** 96;
  } else {
    const ps = await v4PoolState(M.pool, M.usdgIs0);
    poolPrice = ps.price;
    sqrtP = ps.sqrtP;
  }
  return { usdgRaw, stockRaw, poolPrice, sqrtP };
}

// Build the delta swap: buy the stock shortfall with USDG, or sell excess
// stock back to USDG. Existing stock is absorbed, never round-tripped —
// that is what makes recenters cheap.
async function buildDeltaSwap(M, wallet, deltaUsd, poolPrice, usdgRaw, stockRaw) {
  const txs = [];
  if (deltaUsd > 0.5) {
    let amountInRaw = BigInt(Math.round(deltaUsd * 1e6));
    if (amountInRaw > usdgRaw) amountInRaw = usdgRaw;
    if (amountInRaw === 0n) return txs; // nothing to swap with (funds gate reports it)
    if (M.venue === "v3") {
      const [allowRes] = await multicall([
        { to: USDG, data: SEL.allowance + addrWord(wallet) + addrWord(ROUTER_V3) },
      ]);
      txs.push(
        ...approveTxIfNeeded(allowRes.ok ? wordAt(allowRes.data, 0) : null, USDG, ROUTER_V3, amountInRaw, "approve USDG -> v3 router"),
        v3SwapTx(
          USDG, M.token, M.fee, wallet, amountInRaw,
          BigInt(Math.round(((Number(amountInRaw) / 1e6 / poolPrice) * (1 - M.fee / 1e6) * 0.985) * 1e18)),
          `swap $${(Number(amountInRaw) / 1e6).toFixed(2)} USDG -> ${M.symbol} (minOut 1.5% floor)`
        )
      );
    } else {
      const key = poolKeyFor(M);
      const zf1 = buyStockZeroForOne(M);
      const { amountOut } = await quoteSwap(key, zf1, amountInRaw);
      txs.push(
        ...(await approvalTxs(wallet, USDG, amountInRaw, UNIVERSAL_ROUTER, "USDG")),
        tx(UNIVERSAL_ROUTER, swapData(key, zf1, amountInRaw, (amountOut * 985n) / 1000n, deadline()), `swap $${deltaUsd.toFixed(2)} USDG -> ${M.symbol} (quoted, minOut 1.5% floor)`)
      );
    }
  } else if (deltaUsd < -0.5) {
    let sellRaw = BigInt(Math.round((-deltaUsd / poolPrice) * 1e18));
    if (sellRaw > stockRaw) sellRaw = stockRaw; // float may overshoot the balance
    if (sellRaw === 0n) return txs;
    if (M.venue === "v3") {
      const [allowRes] = await multicall([
        { to: M.token, data: SEL.allowance + addrWord(wallet) + addrWord(ROUTER_V3) },
      ]);
      txs.push(
        ...approveTxIfNeeded(allowRes.ok ? wordAt(allowRes.data, 0) : null, M.token, ROUTER_V3, sellRaw, `approve ${M.symbol} -> v3 router`),
        v3SwapTx(
          M.token, USDG, M.fee, wallet, sellRaw,
          BigInt(Math.round((Number(sellRaw) / 1e18) * poolPrice * (1 - M.fee / 1e6) * 0.985 * 1e6)),
          `sell $${((Number(sellRaw) / 1e18) * poolPrice).toFixed(2)} of ${M.symbol} -> USDG (minOut 1.5% floor)`
        )
      );
    } else {
      const key = poolKeyFor(M);
      const zf1 = sellStockZeroForOne(M);
      const { amountOut } = await quoteSwap(key, zf1, sellRaw);
      txs.push(
        ...(await approvalTxs(wallet, M.token, sellRaw, UNIVERSAL_ROUTER, M.symbol)),
        tx(UNIVERSAL_ROUTER, swapData(key, zf1, sellRaw, (amountOut * 985n) / 1000n, deadline()), `sell $${(-deltaUsd).toFixed(2)} of ${M.symbol} -> USDG (quoted, minOut 1.5% floor)`)
      );
    }
  }
  return txs;
}

// ============================== PLAN ==============================
async function plan() {
  const market = need("market");
  const M = getMarket(market);
  const usd = Number(need("usd"));
  const wallet = need("wallet");
  if (!(usd > 0)) fail("args", "--usd must be > 0");

  // quote gate inputs are REQUIRED — no fresh real quote, no entry, period.
  if (args.quote === undefined || args["quote-age-s"] === undefined) {
    fail("nav", "entry requires --quote and --quote-age-s (fresh real-world quote fetched by the agent)");
  }
  const quote = Number(args.quote);
  const quoteAge = Number(args["quote-age-s"]);

  // vol input for the band: --iv (ATM implied) or --w (5-session expected move)
  let w;
  if (args.w !== undefined) w = Number(args.w);
  else if (args.iv !== undefined) w = wFromIV(Number(args.iv));
  const width = args.width || "standard";

  const gecko = await geckoPool(M.pool);
  const { usdgRaw, stockRaw, poolPrice } = await readPoolAndBalances(M, wallet);
  const usdgBal = Number(usdgRaw) / 1e6;

  // ---------- gates — ALL must pass; fail closed ----------
  const ageHours = gecko.createdAt
    ? (Date.now() - Date.parse(gecko.createdAt)) / 3.6e6
    : Infinity;
  const looseStockUsdPre = (Number(stockRaw) / 1e18) * poolPrice;
  const gates = [
    {
      name: "funds",
      pass: usdgBal + looseStockUsdPre >= usd * 0.999,
      value: +(usdgBal + looseStockUsdPre).toFixed(2),
      limit: `wallet must hold >= $${usd} in USDG + loose stock`,
    },
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
      pass: Math.abs(gecko.change24hPct) < M.circuitPct,
      value: gecko.change24hPct,
      limit: `|24h move| < ${M.circuitPct}% (per-market breaker)`,
    },
    { name: "vol-input", pass: w > 0, value: w ?? null, limit: "honest w required (--iv or --w, no guess)" },
  ];
  const failed = gates.find((g) => !g.pass);
  if (failed) fail(failed.name, failed.limit, { gates });

  // ---------- band + delta swap ----------
  const band = buildBand(poolPrice, quote, w, width, M.usdgIs0, M.tickSpacing);
  const share = stockShare((poolPrice + quote) / 2, band.bandLow, band.bandHigh);
  const looseStockUsd = (Number(stockRaw) / 1e18) * poolPrice;
  const deltaUsd = usd * share - looseStockUsd; // >0: buy stock, <0: sell excess

  const txs = await buildDeltaSwap(M, wallet, deltaUsd, poolPrice, usdgRaw, stockRaw);

  out({
    ok: true,
    phase: "plan",
    gates,
    market: M.symbol,
    venue: M.venue,
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
    swap: deltaUsd > 0.5 ? `buy $${deltaUsd.toFixed(2)}` : deltaUsd < -0.5 ? `sell $${(-deltaUsd).toFixed(2)}` : "none",
    needsConcentrationConfirm: usd > 0.5 * (usdgBal + looseStockUsd),
    walletUsdg: +usdgBal.toFixed(2),
    txs,
    report: `Deposit $${usd} into the ${M.symbol} pool at $${band.bandLow.toFixed(2)} – $${band.bandHigh.toFixed(2)}?`,
    next:
      (txs.length > 0
        ? "submit txs in order via Bankr (confirm with user first), then run: "
        : "no swap needed; run: ") +
      `entry.mjs size --market ${M.symbol} --usd ${usd} --wallet ${wallet} --tick-lower ${band.tickLower} --tick-upper ${band.tickUpper}`,
  });
}

// ============================== SIZE ==============================
async function size() {
  const market = need("market");
  const M = getMarket(market);
  const wallet = need("wallet");
  const usd = Number(need("usd"));

  const tickLower = Number(need("tick-lower"));
  const tickUpper = Number(need("tick-upper"));
  if (
    !Number.isInteger(tickLower) ||
    !Number.isInteger(tickUpper) ||
    tickLower % M.tickSpacing !== 0 ||
    tickUpper % M.tickSpacing !== 0 ||
    tickLower >= tickUpper
  ) {
    fail("args", "ticks must be spacing-aligned integers with tickLower < tickUpper (use plan's exact output)");
  }
  const band = bandFromTicks(tickLower, tickUpper, M.usdgIs0);

  // re-read AFTER the swap — your own swap moved the price. Sizing at the
  // quote-time price once froze a $706 position for two days.
  const { usdgRaw, stockRaw: stockBalRaw, poolPrice: price, sqrtP } = await readPoolAndBalances(M, wallet);

  // Both sides are capped by the $usd budget — a wallet holding loose stock
  // or USDG beyond this entry's budget must NOT have it swept into the mint.
  const share = stockShare(price, band.low, band.high);
  const stockBudgetRaw = BigInt(Math.round(((usd * share) / price) * 1e18));
  const stockUseRaw = stockBalRaw < stockBudgetRaw ? stockBalRaw : stockBudgetRaw;
  const stockUsdVal = (Number(stockUseRaw) / 1e18) * price;
  const usdgBudget = Math.max(0, usd - stockUsdVal);
  const dust = 250000n; // keep ~$0.25 of USDG back for rounding dust
  const usdgAvail = usdgRaw > dust ? usdgRaw - dust : 0n;
  const usdgBudgetRaw = BigInt(Math.round(usdgBudget * 1e6));
  const usdgUseRaw = usdgAvail < usdgBudgetRaw ? usdgAvail : usdgBudgetRaw;

  // currency0/currency1 order flips with usdgIs0
  const [amount0, amount1] = M.usdgIs0 ? [usdgUseRaw, stockUseRaw] : [stockUseRaw, usdgUseRaw];

  let txs;
  if (M.venue === "v3") {
    const [a0Res, a1Res] = await multicall([
      { to: USDG, data: SEL.allowance + addrWord(wallet) + addrWord(NPM_V3) },
      { to: M.token, data: SEL.allowance + addrWord(wallet) + addrWord(NPM_V3) },
    ]);
    const [token0, token1] = M.usdgIs0 ? [USDG, M.token] : [M.token, USDG];
    txs = [
      ...approveTxIfNeeded(a0Res.ok ? wordAt(a0Res.data, 0) : null, USDG, NPM_V3, usdgUseRaw, "approve USDG -> NPM"),
      ...approveTxIfNeeded(a1Res.ok ? wordAt(a1Res.data, 0) : null, M.token, NPM_V3, stockUseRaw, `approve ${M.symbol} -> NPM`),
      tx(
        NPM_V3,
        SEL.mintV3 +
          addrWord(token0) +
          addrWord(token1) +
          uintWord(M.fee) +
          intWord(tickLower) +
          intWord(tickUpper) +
          uintWord(amount0) +
          uintWord(amount1) +
          uintWord(0) +
          uintWord(0) +
          addrWord(wallet) +
          uintWord(deadline()),
        `mint ${M.symbol} v3 position $${(Number(usdgUseRaw) / 1e6 + stockUsdVal).toFixed(2)} at $${band.low.toFixed(2)} – $${band.high.toFixed(2)}`
      ),
    ];
  } else {
    // v4: mint takes an explicit L. Sized against a ±0.3% price interval so
    // drift between this read and the mint mining can't blow the amount caps
    // (the MaximumAmountExceeded lesson) — the 0.5% haircut rides on top.
    const key = poolKeyFor(M);
    const L = liquidityForAmounts(sqrtP, tickLower, tickUpper, amount0, amount1, 0.003);
    if (L <= 0n) {
      fail(
        "size",
        "computed liquidity is zero — an in-range band needs BOTH sides, and one of them is empty. Most likely the plan swap has not mined yet (or the wallet lacks that side). Verify the swap receipt, then re-run size."
      );
    }
    txs = [
      ...(await approvalTxs(wallet, USDG, usdgUseRaw, POSM, "USDG")),
      ...(await approvalTxs(wallet, M.token, stockUseRaw, POSM, M.symbol)),
      tx(
        POSM,
        mintData(key, tickLower, tickUpper, L, amount0, amount1, wallet, deadline()),
        `mint ${M.symbol} v4 position $${(Number(usdgUseRaw) / 1e6 + stockUsdVal).toFixed(2)} at $${band.low.toFixed(2)} – $${band.high.toFixed(2)}`
      ),
    ];
  }

  out({
    ok: true,
    phase: "size",
    market: M.symbol,
    venue: M.venue,
    postSwapPrice: +price.toFixed(4),
    band: { low: +band.low.toFixed(4), high: +band.high.toFixed(4), tickLower, tickUpper },
    amountUsdg: Number(usdgUseRaw) / 1e6,
    amountStock: Number(stockUseRaw) / 1e18,
    txs,
    report: `Mint sized at post-swap price $${price.toFixed(2)}.`,
    next: `submit txs in order via Bankr, then run: entry.mjs settle --market ${M.symbol} --wallet ${wallet} --mint-tx <hash> --entry-usd ${usd}`,
  });
}

// ============================== SETTLE ==============================
async function settle() {
  const market = need("market");
  const M = getMarket(market);
  const wallet = need("wallet");
  const mintTx = need("mint-tx");
  const nft = M.venue === "v3" ? NPM_V3 : POSM;

  const receipt = await getReceipt(mintTx);
  if (!receipt) fail("receipt", "tx not found or not yet mined — retry when mined");
  if (receipt.status !== "0x1") fail("receipt", `mint tx reverted (status ${receipt.status})`);

  // tokenId comes from the mined receipt, never a simulation
  const log = (receipt.logs || []).find(
    (l) =>
      l.address.toLowerCase() === nft.toLowerCase() &&
      l.topics?.[0] === ERC721_TRANSFER_TOPIC &&
      toBigInt(l.topics?.[1]?.slice(2)) === 0n
  );
  if (!log) fail("receipt", "mint mined but no Transfer-from-zero log — recover via manage.mjs (it discovers from chain), do NOT re-mint");
  const tokenId = toBigInt(log.topics[3].slice(2));

  // record the two unrecoverable fields (+ recenter history for the trend brake)
  const statePathArg = args["state-path"];
  const state = loadState(statePathArg);
  const entryUsd = args["entry-usd"] !== undefined ? Number(args["entry-usd"]) : null;
  const now = new Date().toISOString();
  state.positions = (state.positions || []).filter((p) => p.tokenId !== String(tokenId));
  state.positions.push({
    market: M.symbol,
    venue: M.venue,
    tokenId: String(tokenId),
    entryUsd,
    enteredAt: now,
    lastMintAt: now,
  });
  if (args["recenter-dir"] === "up" || args["recenter-dir"] === "down") {
    state.recenters = state.recenters || {};
    state.recenters[M.symbol] = [
      ...(state.recenters[M.symbol] || []).slice(-9),
      { at: now, dir: args["recenter-dir"] },
    ];
  }
  saveState(state, statePathArg);

  out({
    ok: true,
    phase: "settle",
    market: M.symbol,
    venue: M.venue,
    tokenId: String(tokenId),
    stateRecorded: { entryUsd, enteredAt: now },
    memoryLine: `hood-stock-lp: active Uniswap LP positions on Robinhood Chain — see ~/.hood-stock-lp/state.json. Manage with the hood-stock-lp skill.`,
    report: `Position #${tokenId} minted (${M.venue}). Earning the pool's ${(M.fee / 1e4).toFixed(2)}% trading fees while price stays in the band.`,
    next: "report to the user (one line: amount, band in dollars, one tx link); mention that \"check my LPs\" runs a management pass any time",
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
