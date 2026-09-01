import type { Decision, Order, SkipEvent, Strategy, StrategyContext } from '../types.ts';
import { holds, openPositionCount, positionPnlPct, size, tokensArray } from './helpers.ts';

// Follows smart money. Buys where whales are net-buying, exits when they leave.
// Whales don't touch honeypots, so neither does it — good rug-avoid record.
export const whaleFollower: Strategy = {
  personality: 'whale-follower',
  label: 'Whale Follower',
  blurb: 'Mirrors smart-money flow. Buys whale accumulation, exits distribution.',

  decide(ctx: StrategyContext): Decision {
    const { snapshot, agent } = ctx;
    const orders: Order[] = [];
    const skips: SkipEvent[] = [];

    // exit when whales rotate out or risk shows up
    for (const sym of Object.keys(agent.positions)) {
      const t = snapshot.tokens[sym];
      if (!t || agent.positions[sym].qty <= 0) continue;
      const pnl = positionPnlPct(agent, t);
      if (t.whaleNetFlowUsd < -t.liquidityUsd * 0.03 || t.rugRisk > 0.5) {
        orders.push({ symbol: sym, side: 'sell', usd: 0, fraction: 1, reason: 'smart money exiting' });
      } else if (pnl < -0.3) {
        orders.push({ symbol: sym, side: 'sell', usd: 0, fraction: 1, reason: `stop ${(pnl * 100).toFixed(0)}%` });
      }
    }

    const candidates = tokensArray(snapshot.tokens)
      .filter((t) => t.whaleNetFlowUsd > t.liquidityUsd * 0.04)
      .sort((a, b) => b.whaleNetFlowUsd - a.whaleNetFlowUsd);

    for (const t of candidates) {
      if (openPositionCount(agent) >= 5) break;
      if (holds(agent, t.symbol)) continue;
      if (t.rugRisk > 0.45) {
        skips.push({ symbol: t.symbol, tick: snapshot.tick, reason: 'whales avoid honeypots' });
        continue;
      }
      const usd = size(agent, 0.12);
      if (usd < 5) break;
      orders.push({ symbol: t.symbol, side: 'buy', usd, reason: `whale inflow $${(t.whaleNetFlowUsd / 1000).toFixed(0)}k` });
    }

    return { orders, skips };
  },
};
