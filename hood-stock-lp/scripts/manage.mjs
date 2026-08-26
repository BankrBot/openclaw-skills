#!/usr/bin/env node
// hood-stock-lp manage pass: ONE call reads everything, decides everything,
// executes NOTHING. Output is one JSON object: {ok, positions[], report[]}.
// Uniswap pays fees only (no gauges, no emissions, no route decisions) — the
// pass is: value honestly, check range, and gate any recenter through the
// cost hurdle + trend brake.
//
//   manage.mjs --wallet 0x… [--state-path p] [--quote-TSLA 311.20 --quote-GME 22.10 …]
//
// Real equity quotes are the AGENT's job (market data / web search at pass
// time); pass them as --quote-<MARKET>. Without a quote a market's recenter
// is BLOCKED (fail closed) but valuation/reporting still runs at pool price.

import { MARKETS } from "./lib/markets.mjs";
import { geckoPool } from "./lib/chain.mjs";
import { bandFromTicks } from "./lib/math.mjs";
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

async function main() {
  const state = loadState(args["state-path"]);
  const knownIds = Object.fromEntries(
    (state.positions || []).map((p) => [p.tokenId, { market: p.market, venue: p.venue }])
  );
  const [found, loose] = await Promise.all([
    discoverPositions(wallet, knownIds),
    looseBalances(wallet),
  ]);

  const marketsInBook = [...new Set(found.map((f) => f.market))];
  const gecko = {};
  await Promise.all(
    marketsInBook.map(async (m) => {
      gecko[m] = await geckoPool(MARKETS[m].pool).catch(() => null);
    })
  );

  const positions = [];
  const report = [];
  let totalUsd = 0;
  let totalPnl = 0;
  let pnlKnown = true;

  const reads = await Promise.all(found.map((f) => readPosition(f.market, f.tokenId)));

  for (let fi = 0; fi < found.length; fi++) {
    const f = found[fi];
    const M = MARKETS[f.market];
    const p = reads[fi];
    const rec = (state.positions || []).find((s) => s.tokenId === String(f.tokenId));
    const g = gecko[f.market];

    const value = p.principalUsd + p.feesUsd;
    totalUsd += value;

    const basis = rec?.entryUsd ?? null;
    const pnl = basis !== null ? value - basis : null;
    if (pnl !== null) totalPnl += pnl;
    else pnlKnown = false;

    // projected APR: gross, in-range-conditional, at TODAY's volume — never a promise
    let apr = null;
    if (p.inRange && value > 0) {
      if (rec?.enteredAt) {
        const days = Math.max((Date.now() - Date.parse(rec.enteredAt)) / 8.64e7, 0.04);
        const measured = ((p.feesUsd) / days) * 365;
        apr = (measured / value) * 100;
      }
      if ((apr === null || apr === 0) && g && p.poolLiquidity > 0n) {
        apr =
          ((g.vol24hUsd * (M.fee / 1e6) * (Number(p.liquidity) / Number(p.poolLiquidity)) * 365) /
            value) *
          100;
      }
    }

    const band = bandFromTicks(p.tickLower, p.tickUpper, M.usdgIs0);
    const entry = {
      market: f.market,
      venue: p.venue,
      tokenId: String(f.tokenId),
      inRange: p.inRange,
      valueUsd: +value.toFixed(2),
      principalUsd: +p.principalUsd.toFixed(2),
      feesUsd: +p.feesUsd.toFixed(2),
      band: { low: +band.low.toFixed(2), high: +band.high.toFixed(2) },
      poolPrice: +p.poolPrice.toFixed(2),
      basisUsd: basis,
      basisEstimated: rec ? rec.entryUsd === null : true,
      pnlUsd: pnl !== null ? +pnl.toFixed(2) : null,
      projectedAprPct: apr !== null ? +apr.toFixed(1) : null,
    };

    if (p.inRange) {
      report.push(
        `${f.market}: $${value.toFixed(2)}${pnl !== null ? ` (${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)})` : ""}, in range $${band.low.toFixed(2)} – $${band.high.toFixed(2)} (now $${p.poolPrice.toFixed(2)}), earning fees${apr ? ` — ~${apr.toFixed(0)}% APR at today's volume` : ""}.`
      );
    } else {
      // out of range = earning nothing. Exit/re-enter only through BOTH brakes.
      const earningsSinceMint = p.feesUsd;
      const reentryCost = value * ((M.fee / 1e6) * 0.5 + 0.005) + 0.05;
      const hurdleMet = earningsSinceMint >= 2 * reentryCost;
      // price direction out of range — tick direction inverts in USDG-first pools
      const direction =
        p.currentTick >= p.tickUpper ? (M.usdgIs0 ? "down" : "up") : M.usdgIs0 ? "up" : "down";
      const recents = (state.recenters?.[f.market] || []).filter(
        (r) => Date.now() - Date.parse(r.at) < 7 * 8.64e7
      );
      const trendBrake =
        recents.length >= 2 && recents.slice(-2).every((r) => r.dir === direction);
      const quote = args[`quote-${f.market}`] ? Number(args[`quote-${f.market}`]) : null;

      entry.outOfRange = {
        direction,
        earningsSinceMintUsd: +earningsSinceMint.toFixed(2),
        reentryCostEstUsd: +reentryCost.toFixed(2),
        costHurdleMet: hurdleMet,
        trendBrake,
        quoteProvided: quote !== null,
        action: !hurdleMet
          ? "hold — waiting out the cost hurdle"
          : trendBrake
            ? "stand aside in cash — trend brake (2+ same-direction recenters this week)"
            : quote === null
              ? `exit-ready, but re-entry BLOCKED: no fresh quote passed (--quote-${f.market})`
              : `exit and re-enter: exit.mjs begin (then finish --keep-stock), then entry.mjs plan; pass --recenter-dir ${direction} to settle`,
      };
      report.push(
        `${f.market}: $${value.toFixed(2)}, OUT of range ($${band.low.toFixed(2)} – $${band.high.toFixed(2)}, now $${p.poolPrice.toFixed(2)}), earning nothing — ${entry.outOfRange.action}.`
      );
    }
    positions.push(entry);
  }

  // loose balances are real book money
  let looseUsd = loose.USDG || 0;
  for (const m of Object.keys(MARKETS)) {
    if (!(loose[m] > 0)) continue;
    const pos = positions.find((p) => p.market === m);
    looseUsd += loose[m] * (pos ? pos.poolPrice : 0);
  }

  report.push(
    `Total: $${totalUsd.toFixed(2)} in positions${pnlKnown && positions.length ? `, ${totalPnl >= 0 ? "+" : ""}$${totalPnl.toFixed(2)} net` : ""}; loose wallet balances ~$${looseUsd.toFixed(2)}.`
  );

  out({
    ok: true,
    wallet,
    positions,
    loose,
    report,
    notes: [
      positions.length === 0 ? "No LP positions found on-chain for this wallet." : null,
      found.flags?.v4ScanFailed
        ? "v4 discovery log-scan FAILED on every RPC — only state-file v4 positions were checked. Do not conclude the v4 book is empty."
        : null,
      found.flags?.truncated
        ? "wallet holds many v3 position NFTs — enumeration capped at the most recent 400; state-file positions were checked directly regardless"
        : null,
      "APR figures are gross, in-range-conditional, at today's volume — never promise them.",
      "Equity note: pools trade 24/7 but real quotes go stale off-hours — prefer exiting to cash off-hours and re-entering when the quote is live.",
    ].filter(Boolean),
  });
}

main().catch((e) => out({ ok: false, gate: "error", detail: String(e?.message || e) }, 1));
