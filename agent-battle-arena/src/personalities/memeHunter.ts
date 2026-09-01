import type { Decision, Order, SkipEvent, Strategy, StrategyContext } from '../types.ts';
import { holds, openPositionCount, positionPnlPct, size, tokensArray } from './helpers.ts';

// Chases momentum memes. Loves a runner, but bails the moment risk spikes —
// a near-rug is exactly the kind of token it records as "avoided".
export const memeHunter: Strategy = {
  personality: 'meme-hunter',
  label: 'Meme Hunter',
  blurb: 'Chases momentum memecoins; skips anything that smells like a rug.',

  decide(ctx: StrategyContext): Decision {
    const { snapshot, agent } = ctx;
    const orders: Order[] = [];
    const skips: SkipEvent[] = [];

    // exits first
    for (const sym of Object.keys(agent.positions)) {
      const t = snapshot.tokens[sym];
      if (!t || agent.positions[sym].qty <= 0) continue;
      const pnl = positionPnlPct(agent, t);
      if (t.rugRisk > 0.5) {
        orders.push({ symbol: sym, side: 'sell', usd: 0, fraction: 1, reason: 'risk spiked — dumping' });
      } else if (pnl > 0.6) {
        orders.push({ symbol: sym, side: 'sell', usd: 0, fraction: 1, reason: `took profit +${(pnl * 100).toFixed(0)}%` });
      } else if (pnl < -0.25) {
        orders.push({ symbol: sym, side: 'sell', usd: 0, fraction: 1, reason: `stopped out ${(pnl * 100).toFixed(0)}%` });
      }
    }

    // entries — momentum movers with real liquidity
    const candidates = tokensArray(snapshot.tokens)
      .filter((t) => t.priceChange24h > 0.25 && t.priceChange1h > 0 && t.liquidityUsd > 50_000)
      .sort((a, b) => b.priceChange24h - a.priceChange24h);

    for (const t of candidates) {
      if (openPositionCount(agent) >= 6) break;
      if (holds(agent, t.symbol)) continue;
      if (t.rugRisk > 0.5) {
        skips.push({ symbol: t.symbol, tick: snapshot.tick, reason: `rugRisk ${t.rugRisk.toFixed(2)} too high` });
        continue;
      }
      const usd = size(agent, 0.08);
      if (usd < 5) break;
      orders.push({ symbol: t.symbol, side: 'buy', usd, reason: `momentum +${(t.priceChange24h * 100).toFixed(0)}% / 24h` });
    }

    return { orders, skips };
  },
};
