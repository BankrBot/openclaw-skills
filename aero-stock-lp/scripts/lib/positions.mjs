// aero-stock-lp: position discovery, valuation, and the state file.
// The chain is the memory; the file is a cache holding the only two
// unrecoverable fields (entryUsd, enteredAt) plus preferences.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  MARKETS,
  USDC,
  AERO,
  SEL,
  MAX_UINT128,
  NPM_EQUITY,
  NPM_AERO,
} from "./markets.mjs";
import {
  addrWord,
  uintWord,
  ethCall,
  multicall,
  wordAt,
  toBigInt,
  toInt,
  toAddr,
  decodeUintArray,
} from "./chain.mjs";
import { priceFromSqrtX96, tokenUsd, usdcUsd, inRange } from "./math.mjs";

// ---------- state file ----------

export function statePath(override) {
  return override || path.join(os.homedir(), ".aero-stock-lp", "state.json");
}

export function loadState(override) {
  const p = statePath(override);
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return { compound: null, positions: [] };
  }
}

export function saveState(state, override) {
  const p = statePath(override);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(state, null, 2) + "\n");
}

// ---------- discovery ----------
// Staked: gauge.stakedValues(wallet) per market.
// Unstaked: NPM balanceOf + tokenOfOwnerByIndex, filtered by tickSpacing.
// knownIds ({tokenId -> market}, e.g. from the state file) are always
// checked directly; enumeration is capped at the most recent ENUM_CAP NFTs
// so a pathological wallet can't stall the pass.

const ENUM_CAP = 400;

export async function discoverPositions(wallet, knownIds = {}) {
  const marketNames = Object.keys(MARKETS);

  const stakedCalls = marketNames.map((m) => ({
    to: MARKETS[m].gauge,
    data: SEL.stakedValues + addrWord(wallet),
  }));
  const balCalls = [NPM_EQUITY, NPM_AERO].map((npm) => ({
    to: npm,
    data: SEL.balanceOf + addrWord(wallet),
  }));
  const first = await multicall([...stakedCalls, ...balCalls]);

  const found = []; // {market, tokenId, staked}
  marketNames.forEach((m, i) => {
    if (!first[i].ok) return;
    for (const id of decodeUintArray(first[i].data)) {
      found.push({ market: m, tokenId: id, staked: true });
    }
  });

  // enumerate unstaked NFTs per NPM (most recent first, capped)
  const npms = [NPM_EQUITY, NPM_AERO];
  const enumCalls = [];
  let enumTruncated = false;
  npms.forEach((npm, j) => {
    const bal = first[marketNames.length + j].ok
      ? Number(toBigInt(wordAt(first[marketNames.length + j].data, 0)))
      : 0;
    const start = Math.max(0, bal - ENUM_CAP);
    if (start > 0) enumTruncated = true;
    for (let k = bal - 1; k >= start; k--) {
      enumCalls.push({
        npm,
        call: { to: npm, data: SEL.tokenOfOwnerByIndex + addrWord(wallet) + uintWord(k) },
      });
    }
  });
  if (enumCalls.length) {
    const ids = await multicall(enumCalls.map((e) => e.call));
    const posCalls = ids
      .map((r, i) => ({
        npm: enumCalls[i].npm,
        tokenId: r.ok ? toBigInt(wordAt(r.data, 0)) : null,
      }))
      .filter((x) => x.tokenId !== null);
    // state-file positions are always checked, even past the cap
    // (skip ones already found staked — the gauge holds those NFTs)
    for (const [id, market] of Object.entries(knownIds)) {
      if (
        !posCalls.some((p) => String(p.tokenId) === String(id)) &&
        !found.some((f) => String(f.tokenId) === String(id))
      ) {
        posCalls.push({ npm: MARKETS[market]?.npm || NPM_EQUITY, tokenId: BigInt(id) });
      }
    }
    const details = await multicall(
      posCalls.map((p) => ({ to: p.npm, data: SEL.positions + uintWord(p.tokenId) }))
    );
    posCalls.forEach((p, i) => {
      if (!details[i].ok) return;
      const d = details[i].data;
      const spacing = Number(toInt(wordAt(d, 4)));
      const liq = toBigInt(wordAt(d, 7));
      if (liq === 0n) return; // dust/burned
      const token1 = toAddr(wordAt(d, 3));
      const market = Object.keys(MARKETS).find(
        (m) =>
          MARKETS[m].tickSpacing === spacing &&
          MARKETS[m].token.toLowerCase() === token1.toLowerCase() &&
          MARKETS[m].npm === p.npm
      );
      if (market) found.push({ market, tokenId: p.tokenId, staked: false });
    });
  }
  found.truncated = enumTruncated;
  return found;
}

// ---------- valuation ----------
// One position: batched plain reads + two owner-simulated calls.
// Returns raw facts; P&L composition happens in the caller.

export async function readPosition(wallet, market, tokenId) {
  const M = MARKETS[market];
  const idW = uintWord(tokenId);

  const batch = await multicall([
    { to: M.pool, data: SEL.slot0 },
    { to: M.npm, data: SEL.positions + idW },
    { to: M.npm, data: SEL.ownerOf + idW },
    { to: M.gauge, data: SEL.earned + addrWord(wallet) + idW },
    { to: M.pool, data: SEL.liquidity },
    { to: M.pool, data: SEL.stakedLiquidity },
    { to: M.pool, data: SEL.unstakedFee },
    { to: M.gauge, data: SEL.rewardRate },
  ]);
  const [slot0, pos, owner, earned, poolLiq, poolStakedLiq, unstakedFee, rewardRate] =
    batch;

  if (!slot0.ok || !pos.ok || !owner.ok) {
    throw new Error(`core reads failed for ${market} #${tokenId}`);
  }

  const sqrtPriceX96 = toBigInt(wordAt(slot0.data, 0));
  const currentTick = Number(toInt(wordAt(slot0.data, 1)));
  const tickLower = Number(toInt(wordAt(pos.data, 5)));
  const tickUpper = Number(toInt(wordAt(pos.data, 6)));
  const liquidity = toBigInt(wordAt(pos.data, 7));
  const holder = toAddr(wordAt(owner.data, 0));
  const staked = holder.toLowerCase() === M.gauge.toLowerCase();

  // owner-only simulations (eth_call with spoofed from = current NFT holder)
  const simFrom = staked ? M.gauge : holder;
  const deadline = Math.floor(Date.now() / 1000) + 600;
  let principal0 = 0n,
    principal1 = 0n;
  if (liquidity > 0n) {
    const dec = await ethCall(
      M.npm,
      SEL.decreaseLiquidity +
        idW +
        uintWord(liquidity) +
        uintWord(0) +
        uintWord(0) +
        uintWord(deadline),
      simFrom
    );
    principal0 = toBigInt(wordAt(dec, 0));
    principal1 = toBigInt(wordAt(dec, 1));
  }
  let fees0 = 0n,
    fees1 = 0n;
  try {
    const col = await ethCall(
      M.npm,
      SEL.collect + idW + addrWord(simFrom) + uintWord(MAX_UINT128) + uintWord(MAX_UINT128),
      simFrom
    );
    fees0 = toBigInt(wordAt(col, 0));
    fees1 = toBigInt(wordAt(col, 1));
  } catch {
    // collect sim can revert on zero-fee positions; fees stay 0
  }

  const price = priceFromSqrtX96(sqrtPriceX96, M.decimals);
  return {
    market,
    tokenId: String(tokenId),
    staked,
    holder,
    currentTick,
    tickLower,
    tickUpper,
    inRange: inRange(currentTick, tickLower, tickUpper),
    liquidity,
    poolPrice: price,
    sqrtPriceX96,
    principalUsd: usdcUsd(principal0) + tokenUsd(principal1, price, M.decimals),
    feesUsd: usdcUsd(fees0) + tokenUsd(fees1, price, M.decimals),
    earnedAero: earned.ok ? Number(toBigInt(wordAt(earned.data, 0))) / 1e18 : 0,
    poolLiquidity: poolLiq.ok ? toBigInt(wordAt(poolLiq.data, 0)) : 0n,
    poolStakedLiquidity: poolStakedLiq.ok ? toBigInt(wordAt(poolStakedLiq.data, 0)) : 0n,
    unstakedFeePips: unstakedFee.ok ? Number(toBigInt(wordAt(unstakedFee.data, 0))) : 0,
    rewardRatePerSec: rewardRate.ok ? Number(toBigInt(wordAt(rewardRate.data, 0))) / 1e18 : 0,
  };
}

// Loose wallet balances (USDC + every market token + AERO) — real book money.
export async function looseBalances(wallet) {
  const tokens = [
    { key: "USDC", addr: USDC, decimals: 6 },
    ...Object.entries(MARKETS)
      .filter(([k]) => k !== "AERO")
      .map(([k, m]) => ({ key: k, addr: m.token, decimals: m.decimals })),
    { key: "AERO", addr: AERO, decimals: 18 },
  ];
  const res = await multicall(
    tokens.map((t) => ({ to: t.addr, data: SEL.balanceOf + addrWord(wallet) }))
  );
  const out = {};
  tokens.forEach((t, i) => {
    out[t.key] = res[i].ok ? Number(toBigInt(wordAt(res[i].data, 0))) / 10 ** t.decimals : 0;
  });
  return out;
}
