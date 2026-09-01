import { Rng } from '../util/rng.ts';
import type { MarketSnapshot, TokenTick } from '../types.ts';

type Category = 'bluechip' | 'meme' | 'narrative' | 'micro';

interface TokenDef {
  symbol: string;
  category: Category;
  startPrice: number;
  drift: number; // per-tick mean return
  vol: number; // per-tick volatility
  liquidityUsd: number;
  rugTick: number | null; // tick at which this token rugs (null = never)
}

const UNIVERSE: { symbol: string; category: Category; startPrice: number }[] = [
  { symbol: 'WETH', category: 'bluechip', startPrice: 3400 },
  { symbol: 'SOL', category: 'bluechip', startPrice: 165 },
  { symbol: 'cbBTC', category: 'bluechip', startPrice: 68000 },
  { symbol: 'DEGEN', category: 'meme', startPrice: 0.012 },
  { symbol: 'BRETT', category: 'meme', startPrice: 0.09 },
  { symbol: 'MOG', category: 'meme', startPrice: 0.0000012 },
  { symbol: 'PEPE', category: 'meme', startPrice: 0.0000095 },
  { symbol: 'AIXBT', category: 'narrative', startPrice: 0.32 },
  { symbol: 'VIRTUAL', category: 'narrative', startPrice: 1.9 },
  { symbol: 'GAME', category: 'narrative', startPrice: 0.04 },
  { symbol: 'CLANKER', category: 'narrative', startPrice: 28 },
  { symbol: 'WIF', category: 'meme', startPrice: 2.1 },
  { symbol: 'SAFEMOONX', category: 'micro', startPrice: 0.00004 },
  { symbol: 'INUMAXX', category: 'micro', startPrice: 0.0007 },
  { symbol: 'GIGACHAD9000', category: 'micro', startPrice: 0.00002 },
  { symbol: 'MOONROCKET', category: 'micro', startPrice: 0.00011 },
];

// Occasional jump shocks per tier. Blue chips don't jump; speculative tiers do.
const JUMP: Record<Category, { prob: number; min: number; max: number; upBias: number }> = {
  bluechip: { prob: 0, min: 0, max: 0, upBias: 0.5 },
  meme: { prob: 0.05, min: 0.12, max: 0.5, upBias: 0.62 },
  narrative: { prob: 0.05, min: 0.1, max: 0.4, upBias: 0.62 },
  micro: { prob: 0.06, min: 0.15, max: 0.6, upBias: 0.55 },
};

const PARAMS: Record<Category, { drift: number; vol: number; liq: number; rugProb: number }> = {
  bluechip: { drift: 0.0006, vol: 0.012, liq: 8_000_000, rugProb: 0 },
  meme: { drift: 0.004, vol: 0.07, liq: 600_000, rugProb: 0.1 },
  narrative: { drift: 0.006, vol: 0.05, liq: 1_200_000, rugProb: 0.05 },
  micro: { drift: 0.01, vol: 0.13, liq: 45_000, rugProb: 0.75 },
};

export interface Season {
  seed: number;
  ticks: number;
  snapshots: MarketSnapshot[];
  rugs: { symbol: string; tick: number }[];
}

// How many ticks before the rug the risk score visibly ramps up. This is the
// window in which a careful strategy can detect and skip the token.
const RUG_WARNING_WINDOW = 8;

export function generateSeason(seed: number, ticks: number): Season {
  const rng = new Rng(seed);

  const defs: TokenDef[] = UNIVERSE.map((u) => {
    const p = PARAMS[u.category];
    const rugTick =
      p.rugProb > 0 && rng.chance(p.rugProb * 1.2)
        ? rng.int(Math.floor(ticks * 0.15), Math.floor(ticks * 0.85))
        : null;
    return {
      symbol: u.symbol,
      category: u.category,
      startPrice: u.startPrice,
      drift: p.drift,
      vol: p.vol,
      liquidityUsd: p.liq,
      rugTick,
    };
  });

  const snapshots: MarketSnapshot[] = [];
  const rugs: { symbol: string; tick: number }[] = [];

  // running state per token
  const price: Record<string, number> = {};
  const narrative: Record<string, number> = {};
  const liquidity: Record<string, number> = {};
  const dead: Record<string, boolean> = {};
  const history: Record<string, number[]> = {};
  for (const d of defs) {
    price[d.symbol] = d.startPrice;
    narrative[d.symbol] = d.category === 'narrative' ? rng.range(0.3, 0.55) : rng.range(0.05, 0.25);
    liquidity[d.symbol] = d.liquidityUsd;
    dead[d.symbol] = false;
    history[d.symbol] = [d.startPrice];
  }

  for (let t = 0; t < ticks; t++) {
    const tokens: Record<string, TokenTick> = {};

    for (const d of defs) {
      const sym = d.symbol;
      let rugged = false;

      if (!dead[sym]) {
        if (d.rugTick !== null && t >= d.rugTick) {
          // the rug fires: liquidity pulled, price collapses ~90-98%
          price[sym] = price[sym] * rng.range(0.02, 0.1);
          liquidity[sym] = liquidity[sym] * 0.02;
          dead[sym] = true;
          rugged = true;
          rugs.push({ symbol: sym, tick: t });
        } else {
          // normal random walk with occasional pumps. Blue chips grind; the
          // speculative tiers get violent jumps (the source of meme/degen edge).
          let ret = d.drift + d.vol * rng.gauss();
          const jump = JUMP[d.category];
          if (jump.prob > 0 && rng.chance(jump.prob)) {
            ret += rng.range(jump.min, jump.max) * (rng.chance(jump.upBias) ? 1 : -1);
          }
          price[sym] = Math.max(price[sym] * (1 + ret), 1e-12);
          // liquidity drifts with activity
          liquidity[sym] = Math.max(liquidity[sym] * rng.range(0.97, 1.04), 1000);
        }
      } else {
        // dead token bleeds toward zero
        price[sym] = price[sym] * rng.range(0.85, 1.0);
      }

      history[sym].push(price[sym]);
      const hist = history[sym];
      const p1h = hist.length > 1 ? price[sym] / hist[hist.length - 2] - 1 : 0;
      const idx24 = Math.max(0, hist.length - 25);
      const p24h = price[sym] / hist[idx24] - 1;

      // narrative score evolves; narrative tokens can spike on "news"
      let nv = narrative[sym];
      nv += 0.04 * rng.gauss();
      if (d.category === 'narrative' && rng.chance(0.06)) nv += rng.range(0.15, 0.35);
      nv = Math.min(1, Math.max(0, nv));
      narrative[sym] = nv;

      // whale net flow — smart money. bigger, persistent prints near real moves.
      let whale = liquidity[sym] * 0.01 * rng.gauss();
      if (rng.chance(0.08)) whale += liquidity[sym] * rng.range(0.05, 0.2) * (rng.chance(0.55) ? 1 : -1);

      // rug risk score: ramps up in the warning window before a scheduled rug
      let rugRisk = baseRisk(d.category);
      if (d.rugTick !== null && !dead[sym]) {
        const dist = d.rugTick - t;
        if (dist >= 0 && dist <= RUG_WARNING_WINDOW) {
          rugRisk = Math.min(0.97, rugRisk + (1 - dist / RUG_WARNING_WINDOW) * 0.8);
        }
      }
      if (dead[sym]) rugRisk = 0.99;

      tokens[sym] = {
        symbol: sym,
        price: price[sym],
        liquidityUsd: liquidity[sym],
        volume24hUsd: liquidity[sym] * rng.range(0.2, 2.5),
        priceChange1h: p1h,
        priceChange24h: p24h,
        ageHours: t,
        narrativeScore: nv,
        whaleNetFlowUsd: whale,
        rugRisk,
        rugged,
      };
    }

    snapshots.push({ tick: t, tokens });
  }

  return { seed, ticks, snapshots, rugs };
}

function baseRisk(c: Category): number {
  switch (c) {
    case 'bluechip':
      return 0.02;
    case 'narrative':
      return 0.12;
    case 'meme':
      return 0.22;
    case 'micro':
      return 0.45;
  }
}
