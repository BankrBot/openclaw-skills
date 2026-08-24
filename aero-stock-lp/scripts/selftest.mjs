#!/usr/bin/env node
// aero-stock-lp selftest: offline math/encoding vectors, plus --live for
// read-only checks against Base mainnet (no keys, no writes, no cost).
// Exit 0 = all pass; any failure exits 1 with the failing check named.

import { MARKETS, SEL } from "./lib/markets.mjs";
import { intWord, uintWord, addrWord, toInt, multicall, wordAt, toBigInt } from "./lib/chain.mjs";
import {
  priceFromSqrtX96,
  tickFromPrice,
  priceFromTick,
  ticksForBand,
  buildBand,
  stockShare,
  wFromIV,
} from "./lib/math.mjs";

const results = [];
function check(name, cond, detail = "") {
  results.push({ name, pass: !!cond, detail });
}
function approx(a, b, tolPct = 0.01) {
  return Math.abs(a / b - 1) < tolPct;
}

// --- encoding ---
check("int24 -100 two's complement", intWord(-100).endsWith("ff9c") && /^f+/.test(intWord(-100)));
check("int24 +10 plain", intWord(10) === uintWord(10));
check("sign-extend decode", toInt("f".repeat(62) + "9c") === -100n);
check("addr padding", addrWord("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913").length === 64);

// --- price math (dec 8 equities: USD/share = 100 / (sqrtP/2^96)^2) ---
// vector: price $300 -> sqrtP = 2^96 * sqrt(100/300)
const sqrtP300 = BigInt(Math.round(2 ** 96 * Math.sqrt(100 / 300)));
check("price from sqrtX96 (equity $300)", approx(priceFromSqrtX96(sqrtP300, 8), 300, 0.001));
// AERO (dec 18): USD/AERO = 1e12 / (sqrtP/2^96)^2 ; $1.20
const sqrtAero = BigInt(Math.round(2 ** 96 * Math.sqrt(1e12 / 1.2)));
check("price from sqrtX96 (AERO $1.20)", approx(priceFromSqrtX96(sqrtAero, 18), 1.2, 0.001));

// --- tick <-> price round trips ---
for (const [p, dec] of [[300, 8], [311.2, 8], [1.2, 18], [0.85, 18]]) {
  const t = Math.round(tickFromPrice(p, dec));
  check(`tick/price roundtrip ${p} (dec ${dec})`, approx(priceFromTick(t, dec), p, 0.001));
}

// --- band inversion + snapping ---
// tick and human price move in OPPOSITE directions: low price -> upper tick.
const band = ticksForBand(300, 322, 8, 10);
check("band tickLower < tickUpper", band.tickLower < band.tickUpper);
check("band ticks snapped to spacing", band.tickLower % 10 === 0 && band.tickUpper % 10 === 0);
check("band prices preserved-ish", band.bandLow <= 300.5 && band.bandHigh >= 321.4);
check(
  "inversion: high price -> lower tick",
  approx(priceFromTick(band.tickLower, 8), band.bandHigh, 0.001) &&
    approx(priceFromTick(band.tickUpper, 8), band.bandLow, 0.001)
);
// degenerate band gets the 1-spacing floor
const tiny = ticksForBand(310.0, 310.01, 8, 10);
check("1-spacing floor", tiny.tickUpper - tiny.tickLower === 10);

// --- band construction ---
const b2 = buildBand(310, 312, 0.035, "standard", 8, 10);
check("buildBand centers between pool and quote", b2.bandLow < 311 && b2.bandHigh > 311);
const b3 = buildBand(310, 312, 5.0, "wide", 8, 10); // absurd vol -> capped
check("buildBand caps at ±35%", b3.bandHigh / 311 < 1.36);
let threw = false;
try {
  buildBand(310, 312, 0, "standard", 8, 10);
} catch {
  threw = true;
}
check("no vol input -> throws (fail closed)", threw);

// --- stock share ---
check("share at center ~0.4-0.6", stockShare(311, 300, 322) > 0.4 && stockShare(311, 300, 322) < 0.6);
check("share below band = 1", stockShare(290, 300, 322) === 1);
check("share above band = 0", stockShare(330, 300, 322) === 0);
check("wFromIV(0.28) ~ 3.9%", approx(wFromIV(0.28), 0.0394, 0.02));

// --- calldata shape (static tuples: selector + N words) ---
const mintData =
  SEL.mint +
  addrWord("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913") +
  addrWord(MARKETS.AAPL.token) +
  intWord(10) +
  intWord(-115000) +
  intWord(-114000) +
  uintWord(50000000n) +
  uintWord(16000000n) +
  uintWord(0) +
  uintWord(0) +
  addrWord("0x" + "11".repeat(20)) +
  uintWord(1755800000) +
  uintWord(0);
check("mint calldata = 4 + 12*32 bytes", mintData.length === 2 + (4 + 12 * 32) * 2);
const swapData =
  SEL.exactInputSingle +
  addrWord("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913") +
  addrWord(MARKETS.AAPL.token) +
  intWord(10) +
  addrWord("0x" + "11".repeat(20)) +
  uintWord(1755800000) +
  uintWord(11000000n) +
  uintWord(3400000n) +
  uintWord(0);
check("exactInputSingle calldata = 4 + 8*32 bytes", swapData.length === 2 + (4 + 8 * 32) * 2);

// --- live (read-only) ---
if (process.argv.includes("--live")) {
  const names = Object.keys(MARKETS);
  const res = await multicall(
    names.flatMap((m) => [
      { to: MARKETS[m].pool, data: SEL.slot0 },
      { to: MARKETS[m].pool, data: SEL.gauge },
      { to: MARKETS[m].pool, data: SEL.tickSpacingCall },
      { to: MARKETS[m].gauge, data: SEL.rewardToken },
    ])
  );
  names.forEach((m, i) => {
    const [slot0, gauge, spacing, rewardToken] = res.slice(i * 4, i * 4 + 4);
    const price = slot0.ok ? priceFromSqrtX96(toBigInt(wordAt(slot0.data, 0)), MARKETS[m].decimals) : 0;
    const tick = slot0.ok ? Number(toInt(wordAt(slot0.data, 1))) : null;
    check(`live ${m} slot0 sane price`, price > 0 && price < 100000, `$${price.toFixed(2)}`);
    check(
      `live ${m} tick matches price`,
      tick !== null && approx(priceFromTick(tick, MARKETS[m].decimals), price, 0.001)
    );
    check(
      `live ${m} pool.gauge() matches table`,
      gauge.ok && ("0x" + gauge.data.slice(24)).toLowerCase() === MARKETS[m].gauge.toLowerCase()
    );
    check(
      `live ${m} tickSpacing matches table`,
      spacing.ok && Number(toInt(wordAt(spacing.data, 0))) === MARKETS[m].tickSpacing
    );
    check(
      `live ${m} gauge pays AERO`,
      rewardToken.ok &&
        ("0x" + rewardToken.data.slice(24)).toLowerCase() ===
          "0x940181a94a35a4569e4529a3cdfb74e38fd98631"
    );
  });
}

// --- report ---
const failed = results.filter((r) => !r.pass);
for (const r of results) {
  console.error(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  (${r.detail})` : ""}`);
}
console.log(JSON.stringify({ ok: failed.length === 0, checks: results.length, failed: failed.map((f) => f.name) }));
process.exit(failed.length === 0 ? 0 : 1);
