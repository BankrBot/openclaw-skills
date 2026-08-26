// hood-stock-lp: price/tick/band/liquidity math, ORIENTATION-AWARE.
// Robinhood pools sort tokens by address, so USDG (6 dec) can land on either
// side. usdgIs0 = USDG is token0/currency0. That flips the price<->tick map
// AND swaps which band edge maps to which tick. The flip lives HERE, once.
//
// Stock tokens are 18 dec, USDG 6 dec, so the raw pool ratio differs from the
// human USD price by 1e12 in one direction or the other:
//   stock-first (usdgIs0=false): priceUsd = rawRatio * 1e12  (tick up = price up)
//   USDG-first  (usdgIs0=true):  priceUsd = 1e12 / rawRatio  (tick up = price DOWN)

const Q96 = 2 ** 96;

export function priceFromSqrtX96(sqrtPriceX96, usdgIs0) {
  const r = Number(sqrtPriceX96) / Q96;
  const raw = r * r;
  return usdgIs0 ? 1e12 / raw : raw * 1e12;
}

// unsnapped, fractional tick for a human USD price
export function tickFromPrice(price, usdgIs0) {
  const raw = usdgIs0 ? 1e12 / price : price * 1e-12;
  return Math.log(raw) / Math.log(1.0001);
}

export function priceFromTick(tick, usdgIs0) {
  return usdgIs0 ? 1e12 / 1.0001 ** tick : 1.0001 ** tick * 1e12;
}

function snapDown(tick, spacing) {
  return Math.floor(tick / spacing) * spacing;
}

function snapUp(tick, spacing) {
  return Math.ceil(tick / spacing) * spacing;
}

// band prices -> ticks. In USDG-first pools the LOW price maps to the UPPER
// tick (and vice versa); getting this backwards mints an instantly-out-of-
// range position. Snapping always widens the band so [low, high] stays inside.
export function ticksForBand(bandLow, bandHigh, usdgIs0, spacing) {
  let tickLower, tickUpper;
  if (usdgIs0) {
    tickLower = snapDown(tickFromPrice(bandHigh, usdgIs0), spacing);
    tickUpper = snapUp(tickFromPrice(bandLow, usdgIs0), spacing);
  } else {
    tickLower = snapDown(tickFromPrice(bandLow, usdgIs0), spacing);
    tickUpper = snapUp(tickFromPrice(bandHigh, usdgIs0), spacing);
  }
  if (tickUpper <= tickLower) tickUpper = tickLower + spacing; // 1-spacing floor
  const pA = priceFromTick(tickLower, usdgIs0);
  const pB = priceFromTick(tickUpper, usdgIs0);
  return {
    tickLower,
    tickUpper,
    bandLow: Math.min(pA, pB),
    bandHigh: Math.max(pA, pB),
  };
}

export function inRange(currentTick, tickLower, tickUpper) {
  return tickLower <= currentTick && currentTick < tickUpper;
}

// band prices of an existing position's ticks
export function bandFromTicks(tickLower, tickUpper, usdgIs0) {
  const pA = priceFromTick(tickLower, usdgIs0);
  const pB = priceFromTick(tickUpper, usdgIs0);
  return { low: Math.min(pA, pB), high: Math.max(pA, pB) };
}

// Band construction: center = midpoint of pool price and real quote (the pool
// follows the market, not the other way around), half-width = w (5-session
// expected move) x width factor, capped at 35%.
export const WIDTH_FACTOR = { wide: 2, standard: 1, tight: 0.5 };

export function buildBand(poolPrice, quote, w, width, usdgIs0, spacing) {
  const factor = WIDTH_FACTOR[width];
  if (!factor) throw new Error(`width must be one of ${Object.keys(WIDTH_FACTOR)}`);
  if (!(w > 0)) throw new Error("no honest vol input -> no band -> no entry");
  const center = (poolPrice + quote) / 2;
  const half = Math.min(w * factor, 0.35);
  return ticksForBand(center * (1 - half), center * (1 + half), usdgIs0, spacing);
}

// Stock-value share of a band [pl, pu] at price P (all human USD prices —
// orientation-independent by construction).
export function stockShare(P, pl, pu) {
  if (P <= pl) return 1; // below band: all stock
  if (P >= pu) return 0; // above band: all USDG
  const a = Math.sqrt(P) - P / Math.sqrt(pu);
  const b = Math.sqrt(P) - Math.sqrt(pl);
  return a / (a + b);
}

// Annualized w from IV: w = IV x sqrt(5/252)
export function wFromIV(iv) {
  return iv * Math.sqrt(5 / 252);
}

// ---------- raw-terms liquidity math (v4 mints need an explicit L) ----------

export const sqrtOfTick = (t) => Math.pow(1.0001, t / 2);

// L that stays under both amount caps for ANY execution sqrt price in
// [sLo, sHi] (raw sqrt prices, raw amounts in currency0/currency1 order).
// amount0 demand is worst at the low end, amount1 at the high end; both are
// capped by the range edges. 0.5% haircut so settle never exceeds holdings.
export function liquidityForInterval(sLo, sHi, tickLower, tickUpper, amount0Raw, amount1Raw) {
  const sa = sqrtOfTick(tickLower), sb = sqrtOfTick(tickUpper);
  const s0 = Math.min(Math.max(sLo, sa), sb);
  const s1 = Math.min(Math.max(sHi, sa), sb);
  const L0 = s0 < sb ? Number(amount0Raw) / (1 / s0 - 1 / sb) : Infinity;
  const L1 = s1 > sa ? Number(amount1Raw) / (s1 - sa) : Infinity;
  const L = Math.min(L0, L1);
  return Number.isFinite(L) && L > 0 ? BigInt(Math.floor(L * 0.995)) : 0n;
}

// Sizing at one price, padded ±padPct to survive drift between the size
// read and the mint mining (the 2026-08-13 MaximumAmountExceeded lesson:
// a mint sized at the read price reverts when the pool moves before it lands).
export function liquidityForAmounts(sqrtP, tickLower, tickUpper, amount0Raw, amount1Raw, padPct = 0.002) {
  return liquidityForInterval(
    sqrtP * (1 - padPct),
    sqrtP * (1 + padPct),
    tickLower,
    tickUpper,
    amount0Raw,
    amount1Raw
  );
}

// position composition (raw floats) from liquidity between ticks
export function amountsForLiquidity(liquidity, currentTick, sqrtP, tickLower, tickUpper) {
  const sa = sqrtOfTick(tickLower), sb = sqrtOfTick(tickUpper);
  const Lf = Number(liquidity);
  let amt0 = 0, amt1 = 0;
  if (currentTick >= tickUpper) amt1 = Lf * (sb - sa);
  else if (currentTick < tickLower) amt0 = Lf * (1 / sa - 1 / sb);
  else {
    amt1 = Lf * (sqrtP - sa);
    amt0 = Lf * (1 / sqrtP - 1 / sb);
  }
  return { amt0, amt1 };
}

// raw units -> USD
export function stockUsd(rawFloat, price) {
  return (rawFloat / 1e18) * price;
}

export function usdgUsd(rawFloat) {
  return rawFloat / 1e6;
}
