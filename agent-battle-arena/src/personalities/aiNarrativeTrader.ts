import type { Decision, Order, SkipEvent, Strategy, StrategyContext } from '../types.ts';
import { holds, openPositionCount, positionPnlPct, size, tokensArray } from './helpers.ts';

// Trades the narrative. Rotates into whatever has rising mindshare and exits
// when the story fades. Disciplined on risk — a fading narrative is a sell.
export const aiNarrativeTrader: Strategy = {
  personality: 'ai-narrative-trader',
  label: 'AI Narrative Trader',
  blurb: 'Rotates into rising-mindshare narratives, exits when the story fades.',

  decide(ctx: StrategyContext): Decision {
    const { snapshot, agent } = ctx;
    const orders: Order[] = [];
    const skips: SkipEvent[] = [];

    for (const sym of Object.keys(agent.positions)) {
      const t = snapshot.tokens[sym];
      if (!t || agent.positions[sym].qty <= 0) continue;
      const pnl = positionPnlPct(agent, t);
      if (t.narrativeScore < 0.4 || t.rugRisk > 0.5) {
        orders.push({ symbol: sym, side: 'sell', usd: 0, fraction: 1, reason: 'narrative faded' });
      } else if (pnl > 0.8) {
        orders.push({ symbol: sym, side: 'sell', usd: 0, fraction: 0.5, reason: `trimmed winner +${(pnl * 100).toFixed(0)}%` });
      } else if (pnl < -0.35) {
        orders.push({ symbol: sym, side: 'sell', usd: 0, fraction: 1, reason: `thesis wrong ${(pnl * 100).toFixed(0)}%` });
      }
    }

    const candidates = tokensArray(snapshot.tokens)
      .filter((t) => t.narrativeScore > 0.65 && t.priceChange24h > -0.05)
      .sort((a, b) => b.narrativeScore - a.narrativeScore);

    for (const t of candidates) {
      if (openPositionCount(agent) >= 4) break;
      if (holds(agent, t.symbol)) continue;
      if (t.rugRisk > 0.45) {
        skips.push({ symbol: t.symbol, tick: snapshot.tick, reason: 'narrative ≠ safe contract' });
        continue;
      }
      const usd = size(agent, 0.15);
      if (usd < 5) break;
      orders.push({ symbol: t.symbol, side: 'buy', usd, reason: `narrative ${(t.narrativeScore * 100).toFixed(0)}/100` });
    }

    return { orders, skips };
  },
};
