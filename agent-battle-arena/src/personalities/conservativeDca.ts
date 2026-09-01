import type { Decision, Order, SkipEvent, Strategy, StrategyContext } from '../types.ts';
import { positionPnlPct, size, tokensArray } from './helpers.ts';

// Boring on purpose. Buys a fixed slice of the two safest, deepest-liquidity
// assets every tick. Almost never sells. Wins on low drawdown, not fireworks.
export const conservativeDca: Strategy = {
  personality: 'conservative-dca',
  label: 'Conservative DCA',
  blurb: 'Dollar-cost-averages into blue chips. Lowest drawdown, steady curve.',

  decide(ctx: StrategyContext): Decision {
    const { snapshot, agent } = ctx;
    const orders: Order[] = [];
    const skips: SkipEvent[] = [];

    const safe = tokensArray(snapshot.tokens)
      .filter((t) => t.rugRisk < 0.05 && t.liquidityUsd > 3_000_000)
      .sort((a, b) => b.liquidityUsd - a.liquidityUsd)
      .slice(0, 2);

    // note the things it deliberately won't touch (anything risky in the book)
    for (const t of tokensArray(snapshot.tokens)) {
      if (t.rugRisk >= 0.1) {
        skips.push({ symbol: t.symbol, tick: snapshot.tick, reason: 'outside risk mandate' });
      }
    }

    // trim only if something blew up beyond -40% (capital preservation)
    for (const sym of Object.keys(agent.positions)) {
      const t = snapshot.tokens[sym];
      if (!t || agent.positions[sym].qty <= 0) continue;
      if (positionPnlPct(agent, t) < -0.4) {
        orders.push({ symbol: sym, side: 'sell', usd: 0, fraction: 1, reason: 'capital preservation exit' });
      }
    }

    // DCA a fixed slice this tick, split across the safe set
    const perTick = size(agent, 0.012); // ~1.2% of bankroll/tick
    if (perTick >= 2 && safe.length > 0) {
      const each = perTick / safe.length;
      for (const t of safe) {
        if (each < 1) continue;
        orders.push({ symbol: t.symbol, side: 'buy', usd: each, reason: 'scheduled DCA buy' });
      }
    }

    return { orders, skips };
  },
};
