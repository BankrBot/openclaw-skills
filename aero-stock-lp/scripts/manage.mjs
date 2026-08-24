#!/usr/bin/env node
// aero-stock-lp manage pass: ONE call reads everything, decides everything,
// executes NOTHING. Output is one JSON object: {ok, positions[], txs[], report[]}.
// Proposed txs are labeled with why; the agent confirms with the user where
// the skill requires it and submits via Bankr one at a time.
//
//   manage.mjs --wallet 0x… [--state-path p] [--quote-NVDA 182.10 --quote-AAPL 311.20 …]
//
// Real equity quotes are the AGENT's job (market data / web search at pass
// time); pass them as --quote-<MARKET>. Without a quote a market's recenter
// is BLOCKED (fail closed) but valuation/reporting still runs at pool price.

import {
  MARKETS,
  SEL,
  CL_GAUGE_FACTORY,
  MAX_UINT128,
} from "./lib/markets.mjs";
import {
  addrWord,
  uintWord,
  multicall,
  wordAt,
  toBigInt,
  geckoPool,
  aeroSpot,
  tx,
} from "./lib/chain.mjs";
import {
  discoverPositions,
  readPosition,
  looseBalances,
  loadState,
} from "./lib/positions.mjs";

const rest = process.argv.slice(2);
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

const wallet = args.wallet;
if (!wallet || wallet === true) out({ ok: false, gate: "args", detail: "--wallet required" }, 1);

const HYSTERESIS = 1.3; // other route must pay >= 1.3x current or hold

async function main() {
  const state = loadState(args["state-path"]);
  const knownIds = Object.fromEntries(
    (state.positions || []).map((p) => [p.tokenId, p.market])
  );
  const [found, loose, spot] = await Promise.all([
    discoverPositions(wallet, knownIds),
    looseBalances(wallet),
    aeroSpot().catch(() => null),
  ]);

  // gecko + minStakeTimes once per market that has a position
  const marketsInBook = [...new Set(found.map((f) => f.market))];
  const gecko = {};
  await Promise.all(
    marketsInBook.map(async (m) => {
      gecko[m] = await geckoPool(MARKETS[m].pool).catch(() => null);
    })
  );
  const minStakeRes = await multicall(
    marketsInBook.map((m) => ({
      to: CL_GAUGE_FACTORY,
      data: SEL.minStakeTimes + addrWord(MARKETS[m].pool),
    }))
  );
  const minStake = {};
  marketsInBook.forEach((m, i) => {
    minStake[m] = minStakeRes[i].ok ? Number(toBigInt(wordAt(minStakeRes[i].data, 0))) : 300;
  });

  const positions = [];
  const txs = [];
  const report = [];
  let totalUsd = 0;
  let totalPnl = 0;
  let pnlKnown = true;

  const reads = await Promise.all(
    found.map((f) => readPosition(wallet, f.market, f.tokenId))
  );

  for (let fi = 0; fi < found.length; fi++) {
    const f = found[fi];
    const M = MARKETS[f.market];
    const p = reads[fi];
    const rec = (state.positions || []).find((s) => s.tokenId === String(f.tokenId));
    const g = gecko[f.market];

    const earnedUsd = spot ? p.earnedAero * spot : 0;
    const value = p.principalUsd + p.feesUsd + earnedUsd;
    totalUsd += value;

    const basis = rec?.entryUsd ?? null;
    const pnl = basis !== null ? value - basis : null;
    if (pnl !== null) totalPnl += pnl;
    else pnlKnown = false;

    // projected APR (gross, in-range-conditional, "at this epoch's rate")
    let apr = null;
    if (p.inRange && value > 0) {
      if (rec?.enteredAt) {
        const days = Math.max((Date.now() - Date.parse(rec.enteredAt)) / 8.64e7, 0.04);
        const measured = ((p.feesUsd + earnedUsd) / days) * 365;
        apr = (measured / value) * 100;
      }
      if (apr === null || apr === 0) {
        const potShare = p.staked
          ? spot && p.poolStakedLiquidity > 0n
            ? ((Number(p.liquidity) / Number(p.poolStakedLiquidity)) *
                p.rewardRatePerSec *
                31536000 *
                spot *
                100) /
              value
            : null
          : g && p.poolLiquidity > 0n
            ? ((g.vol24hUsd * M.fee * (Number(p.liquidity) / Number(p.poolLiquidity)) *
                (1 - p.unstakedFeePips / 1e6) *
                365) /
                value) *
              100
            : null;
        apr = potShare;
      }
    }

    const bandLow = 10 ** (M.decimals - 6) / 1.0001 ** p.tickUpper;
    const bandHigh = 10 ** (M.decimals - 6) / 1.0001 ** p.tickLower;

    const entry = {
      market: f.market,
      tokenId: String(f.tokenId),
      route: p.staked ? "staked (earning AERO)" : "unstaked (earning fees)",
      inRange: p.inRange,
      valueUsd: +value.toFixed(2),
      principalUsd: +p.principalUsd.toFixed(2),
      feesUsd: +p.feesUsd.toFixed(2),
      earnedAero: +p.earnedAero.toFixed(4),
      earnedAeroUsd: +earnedUsd.toFixed(2),
      band: { low: +bandLow.toFixed(2), high: +bandHigh.toFixed(2) },
      poolPrice: +p.poolPrice.toFixed(2),
      basisUsd: basis,
      basisEstimated: rec ? rec.entryUsd === null : true,
      pnlUsd: pnl !== null ? +pnl.toFixed(2) : null,
      projectedAprPct: apr !== null ? +apr.toFixed(1) : null,
    };

    if (p.inRange) {
      // route comparison with 1.3x hysteresis
      if (g && spot) {
        const skim = 1 - p.unstakedFeePips / 1e6;
        const feePerL =
          p.poolLiquidity > 0n ? (g.vol24hUsd * M.fee * 365 * skim) / Number(p.poolLiquidity) : 0;
        const emisDen = p.staked ? p.poolStakedLiquidity : p.poolStakedLiquidity + p.liquidity;
        const emisPerL =
          emisDen > 0n ? (p.rewardRatePerSec * 31536000 * spot) / Number(emisDen) : 0;
        const current = p.staked ? emisPerL : feePerL;
        const other = p.staked ? feePerL : emisPerL;
        if (current > 0 && other >= HYSTERESIS * current) {
          entry.routeSwitchProposed = p.staked ? "unstake -> collect fees" : "stake -> earn AERO";
          if (p.staked) {
            txs.push(
              tx(M.gauge, SEL.gaugeWithdraw + uintWord(f.tokenId), `#${f.tokenId} unstake (route switch, ${(other / current).toFixed(2)}x; withdraw also claims AERO)`)
            );
          } else {
            txs.push(
              tx(M.npm, SEL.collect + uintWord(f.tokenId) + addrWord(wallet) + uintWord(MAX_UINT128) + uintWord(MAX_UINT128), `#${f.tokenId} collect fees BEFORE staking (they stop being claimable in the gauge)`),
              tx(M.npm, SEL.approve + addrWord(M.gauge) + uintWord(f.tokenId), `#${f.tokenId} approve NFT -> gauge`),
              tx(M.gauge, SEL.gaugeDeposit + uintWord(f.tokenId), `#${f.tokenId} stake (route switch, ${(other / current).toFixed(2)}x)`)
            );
          }
        }
      }
      // compound: only per recorded consent
      if (
        state.compound === "sell" &&
        p.staked &&
        spot &&
        earnedUsd >= 10 &&
        rec?.enteredAt &&
        Date.now() - Date.parse(rec.enteredAt) > (minStake[f.market] || 300) * 1000
      ) {
        entry.compoundProposed = `claim + sell ${p.earnedAero.toFixed(2)} AERO (~$${earnedUsd.toFixed(2)})`;
        txs.push(
          tx(M.gauge, SEL.getReward + uintWord(f.tokenId), `#${f.tokenId} claim ${p.earnedAero.toFixed(2)} AERO`)
          // the AERO -> USDC sell is built by exit.mjs sell-aero after the claim mines
        );
      }
      report.push(
        `${f.market}: $${value.toFixed(2)}${pnl !== null ? ` (${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)})` : ""}, in range $${bandLow.toFixed(2)} – $${bandHigh.toFixed(2)} (now $${p.poolPrice.toFixed(2)}), ${entry.route}${apr ? ` — ~${apr.toFixed(0)}% APR at this epoch's rate` : ""}.`
      );
    } else {
      // out of range: earns zero on either route. Exit/re-enter through BOTH brakes.
      const earningsSinceMint = p.feesUsd + earnedUsd;
      const reentryCost = value * (M.fee * 0.5 + 0.005) + 0.05;
      const hurdleMet = earningsSinceMint >= 2 * reentryCost;
      const recents = (rec?.recenters || []).filter(
        (r) => Date.now() - Date.parse(r.at) < 7 * 8.64e7
      );
      const direction = p.currentTick >= p.tickUpper ? "down" : "up"; // price direction (tick inverse)
      const trendBrake =
        recents.length >= 2 && recents.slice(-2).every((r) => r.direction === direction);
      const quote = args[`quote-${f.market}`] ? Number(args[`quote-${f.market}`]) : null;

      entry.outOfRange = {
        earningsSinceMintUsd: +earningsSinceMint.toFixed(2),
        reentryCostEstUsd: +reentryCost.toFixed(2),
        costHurdleMet: hurdleMet,
        trendBrake,
        quoteProvided: quote !== null || f.market === "AERO",
        action: !hurdleMet
          ? "hold — waiting out the cost hurdle"
          : trendBrake
            ? "stand aside in cash — trend brake (2+ same-direction recenters)"
            : quote === null && f.market !== "AERO"
              ? "exit-ready, but re-entry BLOCKED: no fresh quote passed (--quote-" + f.market + ")"
              : "exit and re-enter: run exit.mjs begin, then entry.mjs plan",
      };
      report.push(
        `${f.market}: $${value.toFixed(2)}, OUT of range ($${bandLow.toFixed(2)} – $${bandHigh.toFixed(2)}, now $${p.poolPrice.toFixed(2)}), earning nothing — ${entry.outOfRange.action}.`
      );
    }
    positions.push(entry);
  }

  // loose balances are real book money
  const looseUsd =
    loose.USDC +
    (spot ? loose.AERO * spot : 0) +
    Object.keys(MARKETS)
      .filter((m) => m !== "AERO" && loose[m] > 0)
      .reduce((s, m) => {
        const pos = positions.find((p) => p.market === m);
        return s + loose[m] * (pos ? pos.poolPrice : 0);
      }, 0);

  report.push(
    `Total: $${(totalUsd).toFixed(2)} in positions${pnlKnown && positions.length ? `, ${totalPnl >= 0 ? "+" : ""}$${totalPnl.toFixed(2)} net` : ""}; loose wallet balances ~$${looseUsd.toFixed(2)}. Emissions reset Thursday.`
  );

  out({
    ok: true,
    wallet,
    positions,
    loose,
    aeroSpot: spot,
    txs,
    report,
    notes: [
      positions.length === 0 ? "No LP positions found on-chain for this wallet." : null,
      found.truncated
        ? "wallet holds many position NFTs — enumeration capped at the most recent 400; state-file positions were checked directly regardless"
        : null,
      state.compound == null
        ? "compound preference unset — ask the user once before any auto-sell (record compound: sell|hold in the state file)"
        : `compound: ${state.compound}`,
      "APR figures are gross, in-range-conditional, at this epoch's rate (resets Thursday) — never promise them.",
    ].filter(Boolean),
  });
}

main().catch((e) => out({ ok: false, gate: "error", detail: String(e?.message || e) }, 1));
