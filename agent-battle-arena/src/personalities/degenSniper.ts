import type { Decision, Order, SkipEvent, Strategy, StrategyContext } from '../types.ts';
import { holds, openPositionCount, positionPnlPct, size, tokensArray } from './helpers.ts';

// Max risk, max size, fastest finger. Snipes fresh explosive movers with huge
// position sizes and a high rug tolerance — sometimes that means holding a rug.
export const degenSniper: Strategy = {
  personality: 'degen-sniper',
  label: 'Degen Sniper',
  blurb: 'Apes fresh runners with size and a high rug tolerance. High variance.',

  decide(ctx: StrategyContext): Decision {
    const { snapshot, agent } = ctx;
    const orders: Order[] = [];
    const skips: SkipEvent[] = [];

    // fast flips: cut or bank quickly
    for (const sym of Object.keys(agent.positions)) {
      const t = snapshot.tokens[sym];
      if (!t || agent.positions[sym].qty <= 0) continue;
      const pnl = positionPnlPct(agent, t);
      if (pnl > 0.4) orders.push({ symbol: sym, side: 'sell', usd: 0, fraction: 1, reason: `flipped +${(pnl * 100).toFixed(0)}%` });
      else if (pnl < -0.2) orders.push({ symbol: sym, side: 'sell', usd: 0, fraction: 1, reason: `cut ${(pnl * 100).toFixed(0)}%` });
    }

    const candidates = tokensArray(snapshot.tokens)
      .filter((t) => t.priceChange1h > 0.08 && t.volume24hUsd > 20_000)
      .sort((a, b) => b.priceChange1h - a.priceChange1h);

    for (const t of candidates) {
      if (openPositionCount(agent) >= 3) break;
      if (holds(agent, t.symbol)) continue;
      // degen only blinks at near-certain rugs; otherwise sends it
      if (t.rugRisk > 0.75) {
        skips.push({ symbol: t.symbol, tick: snapshot.tick, reason: 'even degen says no' });
        continue;
      }
      const usd = size(agent, 0.22);
      if (usd < 5) break;
      orders.push({ symbol: t.symbol, side: 'buy', usd, reason: `aped +${(t.priceChange1h * 100).toFixed(0)}% / 1h` });
    }

    return { orders, skips };
  },
};
