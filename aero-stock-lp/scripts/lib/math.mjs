// aero-stock-lp: price/tick/band math.
// USDC is token0 in every pool, so tick and human price move in OPPOSITE
// directions: the band's LOW price maps to the UPPER tick and vice versa.
// That inversion lives HERE, once, and nowhere else.

const Q96 = 2 ** 96;

// human USD price of 1 token1, from sqrtPriceX96 (token dec = 8 or 18)
export function priceFromSqrtX96(sqrtPriceX96, decimals) {
  const r = Number(sqrtPriceX96) / Q96;
  return 10 ** (decimals - 6) / (r * r);
}

export function tickFromPrice(price, decimals) {
  return Math.log(10 ** (decimals - 6) / price) / Math.log(1.0001);
}

export function priceFromTick(tick, decimals) {
  return 10 ** (decimals - 6) / 1.0001 ** tick;
}

function snapDown(tick, spacing) {
  return Math.floor(tick / spacing) * spacing;
}

function snapUp(tick, spacing) {
  return Math.ceil(tick / spacing) * spacing;
}

// band prices -> ticks (inversion + snapping handled here)
export function ticksForBand(bandLow, bandHigh, decimals, spacing) {
  let tickLower = snapDown(tickFromPrice(bandHigh, decimals), spacing);
  let tickUpper = snapUp(tickFromPrice(bandLow, decimals), spacing);
  if (tickUpper <= tickLower) tickUpper = tickLower + spacing; // 1-spacing floor
  return {
    tickLower,
    tickUpper,
    // actual prices after snapping (low <-> upper tick, high <-> lower tick)
    bandLow: priceFromTick(tickUpper, decimals),
    bandHigh: priceFromTick(tickLower, decimals),
  };
}

export function inRange(currentTick, tickLower, tickUpper) {
  return tickLower <= currentTick && currentTick < tickUpper;
}

// Band construction (§4): center = midpoint of pool price and real quote,
// half-width = w (5-session expected move) x width factor, capped at 35%.
export const WIDTH_FACTOR = { wide: 2, standard: 1, tight: 0.5 };

export function buildBand(poolPrice, quote, w, width, decimals, spacing) {
  const factor = WIDTH_FACTOR[width];
  if (!factor) throw new Error(`width must be one of ${Object.keys(WIDTH_FACTOR)}`);
  if (!(w > 0)) throw new Error("no honest vol input -> no band -> no entry");
  const center = (poolPrice + quote) / 2;
  const half = Math.min(w * factor, 0.35);
  return ticksForBand(center * (1 - half), center * (1 + half), decimals, spacing);
}

// Stock-value share of a band [pl, pu] at price P (all human USD prices).
// share = (sqrtP - P/sqrt(pu)) / ((sqrtP - P/sqrt(pu)) + (sqrtP - sqrt(pl)))
export function stockShare(P, pl, pu) {
  if (P <= pl) return 1; // below band: all stock
  if (P >= pu) return 0; // above band: all USDC
  const a = Math.sqrt(P) - P / Math.sqrt(pu);
  const b = Math.sqrt(P) - Math.sqrt(pl);
  return a / (a + b);
}

// Annualized w from IV: w = IV x sqrt(5/252)
export function wFromIV(iv) {
  return iv * Math.sqrt(5 / 252);
}

// w for AERO from hourly candles ([time, low, high, open, close, vol] newest first):
// sigma_hourly of log returns x sqrt(24) x sqrt(5)
export function wFromHourlyCandles(candles) {
  const closes = candles
    .slice(0, 24 * 7)
    .map((c) => Number(c[4]))
    .filter((x) => x > 0)
    .reverse();
  if (closes.length < 24) throw new Error("not enough candles for vol");
  const rets = [];
  for (let i = 1; i < closes.length; i++) rets.push(Math.log(closes[i] / closes[i - 1]));
  const mean = rets.reduce((s, x) => s + x, 0) / rets.length;
  const varr = rets.reduce((s, x) => s + (x - mean) ** 2, 0) / (rets.length - 1);
  return Math.sqrt(varr) * Math.sqrt(24) * Math.sqrt(5);
}

// token amount (raw units) -> USD, given human price and decimals
export function tokenUsd(rawAmount, price, decimals) {
  return (Number(rawAmount) / 10 ** decimals) * price;
}

export function usdcUsd(rawAmount) {
  return Number(rawAmount) / 1e6;
}
