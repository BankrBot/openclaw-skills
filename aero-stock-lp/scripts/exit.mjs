#!/usr/bin/env node
// aero-stock-lp exit: two phases, because the sell amounts aren't knowable
// until the collect mines. Scripts never sign; the agent submits each tx via
// Bankr and checks its receipt before the next.
//
//   exit.mjs begin  --market AAPL --token-id 123 --wallet 0x…
//     -> [withdraw (if staked; also claims AERO)], decreaseLiquidity(full), collect
//   exit.mjs finish --market AAPL --token-id 123 --wallet 0x… [--state-path p]
//     -> sell stock residual -> USDC, sell claimed AERO (> 0.1) -> USDC, burn
//        (burn failure is NON-FATAL — funds are already out), remove from state
//   exit.mjs sell-aero --wallet 0x…
//     -> standalone AERO -> USDC sell of the wallet's AERO balance (compounding)

import { getMarket, MARKETS, USDC, AERO, ROUTER_MAIN, SEL, MAX_UINT128 } from "./lib/markets.mjs";
import {
  addrWord,
  uintWord,
  intWord,
  multicall,
  wordAt,
  toBigInt,
  toInt,
  toAddr,
  tx,
} from "./lib/chain.mjs";
import { priceFromSqrtX96 } from "./lib/math.mjs";
import { loadState, saveState } from "./lib/positions.mjs";

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
function need(name) {
  const v = args[name];
  if (v === undefined || v === true) out({ ok: false, gate: "args", detail: `--${name} required` }, 1);
  return v;
}
const deadline = () => Math.floor(Date.now() / 1000) + 600;

const MAX_APPROVE = (1n << 256n) - 1n;

function sellTx(router, tokenIn, tickSpacing, wallet, amountRaw, minOutRaw, label) {
  return tx(
    router,
    SEL.exactInputSingle +
      addrWord(tokenIn) +
      addrWord(USDC) +
      intWord(tickSpacing) +
      addrWord(wallet) +
      uintWord(deadline()) +
      uintWord(amountRaw) +
      uintWord(minOutRaw) +
      uintWord(0),
    label
  );
}

async function begin() {
  const market = need("market");
  const M = getMarket(market);
  const tokenId = need("token-id");
  const wallet = need("wallet");
  const idW = uintWord(tokenId);

  const [ownerRes, posRes] = await multicall([
    { to: M.npm, data: SEL.ownerOf + idW },
    { to: M.npm, data: SEL.positions + idW },
  ]);
  if (!ownerRes.ok || !posRes.ok) out({ ok: false, gate: "rpc", detail: "position reads failed" }, 1);
  const holder = toAddr(wordAt(ownerRes.data, 0));
  const staked = holder.toLowerCase() === M.gauge.toLowerCase();
  if (!staked && holder.toLowerCase() !== wallet.toLowerCase()) {
    out({ ok: false, gate: "owner", detail: `#${tokenId} is held by ${holder}, not this wallet or the gauge` }, 1);
  }
  const liquidity = toBigInt(wordAt(posRes.data, 7));

  const txs = [];
  if (staked) txs.push(tx(M.gauge, SEL.gaugeWithdraw + idW, `#${tokenId} unstake (also claims accrued AERO)`));
  if (liquidity > 0n) {
    txs.push(
      tx(
        M.npm,
        SEL.decreaseLiquidity + idW + uintWord(liquidity) + uintWord(0) + uintWord(0) + uintWord(deadline()),
        `#${tokenId} withdraw all liquidity`
      )
    );
  }
  txs.push(
    tx(M.npm, SEL.collect + idW + addrWord(wallet) + uintWord(MAX_UINT128) + uintWord(MAX_UINT128), `#${tokenId} collect principal + fees to wallet`)
  );

  out({
    ok: true,
    phase: "begin",
    market,
    tokenId: String(tokenId),
    wasStaked: staked,
    txs,
    report: `Exit ${market} #${tokenId}: ${txs.length} txs (funds land in the wallet after collect).`,
    next: "submit txs in order via Bankr, then run: exit.mjs finish",
  });
}

async function finish() {
  const market = need("market");
  const M = getMarket(market);
  const tokenId = need("token-id");
  const wallet = need("wallet");
  const idW = uintWord(tokenId);

  const aeroPool = MARKETS.AERO;
  const [stockBalRes, aeroBalRes, stockAllowRes, aeroAllowRes, slot0Res, aeroSlot0Res] =
    await multicall([
      { to: M.token, data: SEL.balanceOf + addrWord(wallet) },
      { to: AERO, data: SEL.balanceOf + addrWord(wallet) },
      { to: M.token, data: SEL.allowance + addrWord(wallet) + addrWord(M.router) },
      { to: AERO, data: SEL.allowance + addrWord(wallet) + addrWord(ROUTER_MAIN) },
      { to: M.pool, data: SEL.slot0 },
      { to: aeroPool.pool, data: SEL.slot0 },
    ]);

  const txs = [];
  const price = slot0Res.ok ? priceFromSqrtX96(toBigInt(wordAt(slot0Res.data, 0)), M.decimals) : 0;

  // sell stock residual -> USDC (2% minOut floor on exits)
  const stockRaw = stockBalRes.ok ? toBigInt(wordAt(stockBalRes.data, 0)) : 0n;
  if (market !== "AERO" && stockRaw > 0n && price > 0) {
    const allow = stockAllowRes.ok ? toBigInt(wordAt(stockAllowRes.data, 0)) : 0n;
    if (allow < stockRaw)
      txs.push(tx(M.token, SEL.approve + addrWord(M.router) + uintWord(MAX_APPROVE), `approve ${market} -> router`));
    const outUsd = (Number(stockRaw) / 10 ** M.decimals) * price * (1 - M.fee);
    const minOutRaw = BigInt(Math.round(outUsd * 0.98 * 1e6));
    txs.push(sellTx(M.router, M.token, M.tickSpacing, wallet, stockRaw, minOutRaw, `sell ${(Number(stockRaw) / 10 ** M.decimals).toFixed(4)} ${market} -> USDC`));
  }

  // sell claimed AERO (> 0.1) -> USDC via the main router
  const aeroRaw = aeroBalRes.ok ? toBigInt(wordAt(aeroBalRes.data, 0)) : 0n;
  if (aeroRaw > 10n ** 17n && aeroSlot0Res.ok) {
    const aeroPrice = priceFromSqrtX96(toBigInt(wordAt(aeroSlot0Res.data, 0)), 18);
    const allow = aeroAllowRes.ok ? toBigInt(wordAt(aeroAllowRes.data, 0)) : 0n;
    if (allow < aeroRaw)
      txs.push(tx(AERO, SEL.approve + addrWord(ROUTER_MAIN) + uintWord(MAX_APPROVE), "approve AERO -> main router"));
    const outUsd = (Number(aeroRaw) / 1e18) * aeroPrice * (1 - aeroPool.fee);
    const minOutRaw = BigInt(Math.round(outUsd * 0.98 * 1e6));
    txs.push(sellTx(ROUTER_MAIN, AERO, aeroPool.tickSpacing, wallet, aeroRaw, minOutRaw, `sell ${(Number(aeroRaw) / 1e18).toFixed(2)} AERO -> USDC`));
  }

  // burn is cosmetic; a burn failure after collect must NOT fail the exit
  txs.push(tx(M.npm, SEL.burn + idW, `burn #${tokenId} (NON-FATAL if it reverts — funds are already out)`));

  // remove from state; report basis for the final P&L decomposition
  const statePathArg = args["state-path"];
  const state = loadState(statePathArg);
  const rec = (state.positions || []).find((p) => p.tokenId === String(tokenId));
  state.positions = (state.positions || []).filter((p) => p.tokenId !== String(tokenId));
  saveState(state, statePathArg);

  out({
    ok: true,
    phase: "finish",
    market,
    tokenId: String(tokenId),
    txs,
    closedBasis: rec ? { entryUsd: rec.entryUsd, enteredAt: rec.enteredAt } : null,
    report: `Finishing exit of ${market} #${tokenId}: ${txs.length} txs; user lands in USDC. Report the full life-of-position P&L vs basis${rec?.entryUsd != null ? ` ($${rec.entryUsd})` : " (basis unknown — say so)"}.`,
    next: "submit txs in order via Bankr (burn revert is non-fatal), then report final cash + P&L",
  });
}

async function sellAero() {
  const wallet = need("wallet");
  const aeroPool = MARKETS.AERO;
  const [aeroBalRes, aeroAllowRes, aeroSlot0Res] = await multicall([
    { to: AERO, data: SEL.balanceOf + addrWord(wallet) },
    { to: AERO, data: SEL.allowance + addrWord(wallet) + addrWord(ROUTER_MAIN) },
    { to: aeroPool.pool, data: SEL.slot0 },
  ]);
  const aeroRaw = aeroBalRes.ok ? toBigInt(wordAt(aeroBalRes.data, 0)) : 0n;
  if (aeroRaw <= 10n ** 17n) out({ ok: true, phase: "sell-aero", txs: [], report: "AERO balance below 0.1 — nothing to sell." });
  const aeroPrice = priceFromSqrtX96(toBigInt(wordAt(aeroSlot0Res.data, 0)), 18);
  const txs = [];
  const allow = aeroAllowRes.ok ? toBigInt(wordAt(aeroAllowRes.data, 0)) : 0n;
  if (allow < aeroRaw)
    txs.push(tx(AERO, SEL.approve + addrWord(ROUTER_MAIN) + uintWord(MAX_APPROVE), "approve AERO -> main router"));
  const outUsd = (Number(aeroRaw) / 1e18) * aeroPrice * (1 - aeroPool.fee);
  const minOutRaw = BigInt(Math.round(outUsd * 0.98 * 1e6));
  txs.push(sellTx(ROUTER_MAIN, AERO, aeroPool.tickSpacing, wallet, aeroRaw, minOutRaw, `sell ${(Number(aeroRaw) / 1e18).toFixed(2)} AERO -> USDC (~$${outUsd.toFixed(2)})`));
  out({ ok: true, phase: "sell-aero", txs, report: `Selling ${(Number(aeroRaw) / 1e18).toFixed(2)} AERO -> USDC.` });
}

const phases = { begin, finish, "sell-aero": sellAero };
if (!phases[phase]) out({ ok: false, gate: "args", detail: "usage: exit.mjs <begin|finish|sell-aero> --market … --token-id … --wallet …" }, 1);
phases[phase]().catch((e) => out({ ok: false, gate: "error", detail: String(e?.message || e) }, 1));
