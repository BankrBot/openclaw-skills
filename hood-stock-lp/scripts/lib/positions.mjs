// hood-stock-lp: position discovery, valuation, and the state file.
// The chain is the memory; the file is a cache holding the only two
// unrecoverable fields (entryUsd, enteredAt) plus the recenter history.
//
// Two venues, one shape: every read returns the same position object whether
// the market lives on v3 (NPM NFT) or v4 (POSM NFT). Valuation is pure math
// from liquidity between ticks (ported from the Midpoint engine, where it
// priced real money) — no owner-spoofed simulations needed.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  MARKETS,
  USDG,
  NPM_V3,
  POSM,
  SEL,
  ERC721_TRANSFER_TOPIC,
} from "./markets.mjs";
import {
  addrWord,
  uintWord,
  intWord,
  b32Word,
  ethCall,
  multicall,
  getLogs,
  wordAt,
  toBigInt,
  toInt,
  toAddr,
} from "./chain.mjs";
import { inRange, amountsForLiquidity, priceFromSqrtX96 } from "./math.mjs";
import { v4PoolState, v4OwedFees, decodePoolAndPositionInfo } from "./v4.mjs";

const Q128 = 1n << 128n;
const M256 = (1n << 256n) - 1n;

// ---------- state file ----------

export function statePath(override) {
  return override || path.join(os.homedir(), ".hood-stock-lp", "state.json");
}

export function loadState(override) {
  const p = statePath(override);
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return { positions: [], recenters: {} };
  }
}

export function saveState(state, override) {
  const p = statePath(override);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(state, null, 2) + "\n");
}

// ---------- discovery ----------
// v3: the NPM is enumerable — balanceOf + tokenOfOwnerByIndex, then match
//     each NFT's (token0, token1, fee) against the market table. The NPM is
//     shared by EVERY v3 pool on the chain, so a tokenId alone says nothing
//     about which market it is (adopting by id once let a GME book consume
//     four other markets' positions).
// v4: POSM is NOT enumerable — scan Transfer logs to the wallet, then verify
//     ownerOf + liquidity, and match the poolKey against the table. A failed
//     log scan is reported as a flag, never silently treated as "no positions".

const ENUM_CAP = 400;

const marketOfV3 = (token0, token1, fee) =>
  Object.keys(MARKETS).find((m) => {
    const M = MARKETS[m];
    if (M.venue !== "v3" || M.fee !== fee) return false;
    const pair = [token0.toLowerCase(), token1.toLowerCase()];
    return pair.includes(USDG.toLowerCase()) && pair.includes(M.token.toLowerCase());
  });

const marketOfV4 = (key) =>
  Object.keys(MARKETS).find((m) => {
    const M = MARKETS[m];
    if (M.venue !== "v4" || M.fee !== key.fee || M.tickSpacing !== key.tickSpacing) return false;
    const pair = [key.currency0.toLowerCase(), key.currency1.toLowerCase()];
    return pair.includes(USDG.toLowerCase()) && pair.includes(M.token.toLowerCase());
  });

export async function discoverPositions(wallet, knownIds = {}) {
  const found = []; // {market, tokenId, venue}
  const flags = { v4ScanFailed: false, truncated: false };

  // ---- v3: enumerate the NPM ----
  const [balRes] = await multicall([{ to: NPM_V3, data: SEL.balanceOf + addrWord(wallet) }]);
  const bal = balRes.ok ? Number(toBigInt(wordAt(balRes.data, 0))) : 0;
  const start = Math.max(0, bal - ENUM_CAP);
  if (start > 0) flags.truncated = true;
  const idxCalls = [];
  for (let k = bal - 1; k >= start; k--) {
    idxCalls.push({ to: NPM_V3, data: SEL.tokenOfOwnerByIndex + addrWord(wallet) + uintWord(k) });
  }
  const v3Ids = (await multicall(idxCalls))
    .filter((r) => r.ok)
    .map((r) => toBigInt(wordAt(r.data, 0)));
  // state-file v3 positions are always checked, even past the cap
  for (const [id, rec] of Object.entries(knownIds)) {
    if (rec.venue === "v3" && !v3Ids.some((x) => String(x) === String(id))) v3Ids.push(BigInt(id));
  }
  if (v3Ids.length) {
    const details = await multicall(
      v3Ids.map((id) => ({ to: NPM_V3, data: SEL.positions + uintWord(id) }))
    );
    v3Ids.forEach((id, i) => {
      if (!details[i].ok) return;
      const d = details[i].data;
      const liq = toBigInt(wordAt(d, 7));
      if (liq === 0n) return; // dust/burned
      const market = marketOfV3(toAddr(wordAt(d, 2)), toAddr(wordAt(d, 3)), Number(toBigInt(wordAt(d, 4))));
      if (market) found.push({ market, tokenId: id, venue: "v3" });
    });
  }

  // ---- v4: Transfer-log scan + state-file ids ----
  let v4Ids = [];
  try {
    const logs = await getLogs(POSM, [
      ERC721_TRANSFER_TOPIC,
      null,
      "0x" + addrWord(wallet),
    ]);
    v4Ids = [...new Set((logs || []).map((l) => toBigInt(l.topics[3].slice(2))))];
  } catch {
    flags.v4ScanFailed = true;
  }
  for (const [id, rec] of Object.entries(knownIds)) {
    if (rec.venue === "v4" && !v4Ids.some((x) => String(x) === String(id))) v4Ids.push(BigInt(id));
  }
  if (v4Ids.length) {
    const reads = await multicall(
      v4Ids.flatMap((id) => [
        { to: POSM, data: SEL.ownerOf + uintWord(id) },
        { to: POSM, data: SEL.getPositionLiquidity + uintWord(id) },
        { to: POSM, data: SEL.getPoolAndPositionInfo + uintWord(id) },
      ])
    );
    v4Ids.forEach((id, i) => {
      const [ownerRes, liqRes, infoRes] = reads.slice(i * 3, i * 3 + 3);
      if (!ownerRes.ok || !liqRes.ok || !infoRes.ok) return;
      if (toAddr(wordAt(ownerRes.data, 0)).toLowerCase() !== wallet.toLowerCase()) return;
      if (toBigInt(wordAt(liqRes.data, 0)) === 0n) return;
      const market = marketOfV4(decodePoolAndPositionInfo(infoRes.data));
      if (market) found.push({ market, tokenId: id, venue: "v4" });
    });
  }

  found.flags = flags;
  return found;
}

// ---------- valuation ----------
// Uniform return shape. Decimals: which side is USDG (6dp) vs stock (18dp)
// depends on sort order — dec0/dec1 flip with usdgIs0.

function feesFromGrowth(tick, tickLower, tickUpper, fgg0, fgg1, tl, tu, last0, last1, owed0, owed1, L) {
  const below0 = tick >= tickLower ? tl.out0 : (fgg0 - tl.out0) & M256;
  const below1 = tick >= tickLower ? tl.out1 : (fgg1 - tl.out1) & M256;
  const above0 = tick < tickUpper ? tu.out0 : (fgg0 - tu.out0) & M256;
  const above1 = tick < tickUpper ? tu.out1 : (fgg1 - tu.out1) & M256;
  const inside0 = (fgg0 - below0 - above0) & M256;
  const inside1 = (fgg1 - below1 - above1) & M256;
  return {
    f0: Number(owed0) + Number((((inside0 - last0) & M256) * L) / Q128),
    f1: Number(owed1) + Number((((inside1 - last1) & M256) * L) / Q128),
  };
}

async function readV3(market, tokenId) {
  const M = MARKETS[market];
  const idW = uintWord(tokenId);
  const [slot0Res, fg0Res, fg1Res, posRes, ownerRes, poolLiqRes] = await multicall([
    { to: M.pool, data: SEL.slot0 },
    { to: M.pool, data: SEL.feeGrowthGlobal0 },
    { to: M.pool, data: SEL.feeGrowthGlobal1 },
    { to: NPM_V3, data: SEL.positions + idW },
    { to: NPM_V3, data: SEL.ownerOf + idW },
    { to: M.pool, data: SEL.liquidity },
  ]);
  if (!slot0Res.ok || !posRes.ok || !ownerRes.ok) {
    throw new Error(`core v3 reads failed for ${market} #${tokenId}`);
  }
  const d = posRes.data;
  const tickLower = Number(toInt(wordAt(d, 5)));
  const tickUpper = Number(toInt(wordAt(d, 6)));
  const liquidity = toBigInt(wordAt(d, 7));
  const [tlRes, tuRes] = await multicall([
    { to: M.pool, data: SEL.ticks + intWord(tickLower) },
    { to: M.pool, data: SEL.ticks + intWord(tickUpper) },
  ]);
  const sqrtPriceX96 = toBigInt(wordAt(slot0Res.data, 0));
  const currentTick = Number(toInt(wordAt(slot0Res.data, 1)));
  const sqrtP = Number(sqrtPriceX96) / 2 ** 96;
  const { amt0, amt1 } = amountsForLiquidity(liquidity, currentTick, sqrtP, tickLower, tickUpper);
  let f0 = Number(toBigInt(wordAt(d, 10)));
  let f1 = Number(toBigInt(wordAt(d, 11)));
  if (tlRes.ok && tuRes.ok && fg0Res.ok && fg1Res.ok) {
    const fees = feesFromGrowth(
      currentTick, tickLower, tickUpper,
      toBigInt(wordAt(fg0Res.data, 0)), toBigInt(wordAt(fg1Res.data, 0)),
      { out0: toBigInt(wordAt(tlRes.data, 2)), out1: toBigInt(wordAt(tlRes.data, 3)) },
      { out0: toBigInt(wordAt(tuRes.data, 2)), out1: toBigInt(wordAt(tuRes.data, 3)) },
      toBigInt(wordAt(d, 8)), toBigInt(wordAt(d, 9)),
      toBigInt(wordAt(d, 10)), toBigInt(wordAt(d, 11)),
      liquidity
    );
    f0 = fees.f0;
    f1 = fees.f1;
  }
  return {
    holder: toAddr(wordAt(ownerRes.data, 0)),
    currentTick, tickLower, tickUpper, liquidity, sqrtP,
    poolLiquidity: poolLiqRes.ok ? toBigInt(wordAt(poolLiqRes.data, 0)) : 0n,
    amt0, amt1, f0, f1,
  };
}

async function readV4(market, tokenId) {
  const M = MARKETS[market];
  const idW = uintWord(tokenId);
  const [ownerRes, liqRes, infoRes] = await multicall([
    { to: POSM, data: SEL.ownerOf + idW },
    { to: POSM, data: SEL.getPositionLiquidity + idW },
    { to: POSM, data: SEL.getPoolAndPositionInfo + idW },
  ]);
  if (!ownerRes.ok || !liqRes.ok || !infoRes.ok) {
    throw new Error(`core v4 reads failed for ${market} #${tokenId}`);
  }
  const info = decodePoolAndPositionInfo(infoRes.data);
  const liquidity = toBigInt(wordAt(liqRes.data, 0));
  const ps = await v4PoolState(M.pool, M.usdgIs0);
  const { amt0, amt1 } = amountsForLiquidity(liquidity, ps.tick, ps.sqrtP, info.tickLower, info.tickUpper);
  // fee read is best-effort; principal must never depend on it
  let f0 = 0, f1 = 0;
  try {
    const owed = await v4OwedFees(M.pool, tokenId, info.tickLower, info.tickUpper);
    f0 = owed.owed0Raw;
    f1 = owed.owed1Raw;
  } catch { /* fees stay 0 */ }
  return {
    holder: toAddr(wordAt(ownerRes.data, 0)),
    currentTick: ps.tick, tickLower: info.tickLower, tickUpper: info.tickUpper,
    liquidity, sqrtP: ps.sqrtP,
    poolLiquidity: ps.liquidity,
    amt0, amt1, f0, f1,
  };
}

export async function readPosition(market, tokenId) {
  const M = MARKETS[market];
  const r = M.venue === "v3" ? await readV3(market, tokenId) : await readV4(market, tokenId);
  const raw = r.sqrtP * r.sqrtP;
  const price = M.usdgIs0 ? 1e12 / raw : raw * 1e12;
  // amt0/f0 are raw units of token0 — which side is stock flips with usdgIs0
  const stockFloat = (M.usdgIs0 ? r.amt1 : r.amt0) / 1e18;
  const usdgFloat = (M.usdgIs0 ? r.amt0 : r.amt1) / 1e6;
  const stockFeesFloat = (M.usdgIs0 ? r.f1 : r.f0) / 1e18;
  const usdgFeesFloat = (M.usdgIs0 ? r.f0 : r.f1) / 1e6;
  return {
    market,
    tokenId: String(tokenId),
    venue: M.venue,
    holder: r.holder,
    currentTick: r.currentTick,
    tickLower: r.tickLower,
    tickUpper: r.tickUpper,
    inRange: inRange(r.currentTick, r.tickLower, r.tickUpper),
    liquidity: r.liquidity,
    poolLiquidity: r.poolLiquidity,
    poolPrice: price,
    stock: stockFloat,
    usdg: usdgFloat,
    principalUsd: usdgFloat + stockFloat * price,
    feesUsd: usdgFeesFloat + stockFeesFloat * price,
  };
}

// Loose wallet balances (USDG + every market token) — real book money; a P&L
// that ignored mint remainders once showed a healthy position as negative.
export async function looseBalances(wallet) {
  const tokens = [
    { key: "USDG", addr: USDG, dec: 6 },
    ...Object.entries(MARKETS).map(([k, m]) => ({ key: k, addr: m.token, dec: 18 })),
  ];
  const res = await multicall(
    tokens.map((t) => ({ to: t.addr, data: SEL.balanceOf + addrWord(wallet) }))
  );
  const out = {};
  tokens.forEach((t, i) => {
    out[t.key] = res[i].ok ? Number(toBigInt(wordAt(res[i].data, 0))) / 10 ** t.dec : 0;
  });
  return out;
}

// current pool price for a market (either venue)
export async function poolPrice(market) {
  const M = MARKETS[market];
  if (M.venue === "v4") {
    return (await v4PoolState(M.pool, M.usdgIs0)).price;
  }
  const out = await ethCall(M.pool, SEL.slot0);
  return priceFromSqrtX96(toBigInt(wordAt(out, 0)), M.usdgIs0);
}
