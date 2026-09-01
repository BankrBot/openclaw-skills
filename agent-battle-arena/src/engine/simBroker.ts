import type { AgentState, Order, TokenTick, Trade } from '../types.ts';
import { type Broker, TRADING_FEE, newTradeId } from './broker.ts';

// Paper-trading broker. No real funds — pure in-memory accounting against the
// simulated market price. Applies a flat fee on each fill.
export class SimBroker implements Broker {
  readonly mode = 'sim' as const;

  async execute(agent: AgentState, order: Order, tick: TokenTick, tickIndex: number): Promise<Trade | null> {
    const price = tick.price;
    if (price <= 0) return null;

    if (order.side === 'buy') {
      const spend = Math.min(order.usd, agent.cashUsd);
      if (spend < 1) return null;
      const fee = spend * TRADING_FEE;
      const qty = (spend - fee) / price;
      if (qty <= 0) return null;

      agent.cashUsd -= spend;
      const pos = agent.positions[order.symbol];
      if (pos && pos.qty > 0) {
        const totalCost = pos.avgPrice * pos.qty + price * qty;
        pos.qty += qty;
        pos.avgPrice = totalCost / pos.qty;
      } else {
        agent.positions[order.symbol] = { symbol: order.symbol, qty, avgPrice: price, openedTick: tickIndex };
      }

      const trade: Trade = {
        id: newTradeId(),
        agentId: agent.id,
        tick: tickIndex,
        symbol: order.symbol,
        side: 'buy',
        qty,
        price,
        usd: spend,
        reason: order.reason,
      };
      agent.trades.push(trade);
      return trade;
    }

    // sell
    const pos = agent.positions[order.symbol];
    if (!pos || pos.qty <= 0) return null;
    const fraction = order.fraction ?? 1;
    const qty = pos.qty * Math.min(1, Math.max(0, fraction));
    if (qty <= 0) return null;

    const gross = qty * price;
    const fee = gross * TRADING_FEE;
    const proceeds = gross - fee;
    const realizedPnl = (price - pos.avgPrice) * qty - fee;

    agent.cashUsd += proceeds;
    pos.qty -= qty;
    if (pos.qty <= 1e-9) delete agent.positions[order.symbol];

    const trade: Trade = {
      id: newTradeId(),
      agentId: agent.id,
      tick: tickIndex,
      symbol: order.symbol,
      side: 'sell',
      qty,
      price,
      usd: proceeds,
      reason: order.reason,
      realizedPnl,
    };
    agent.trades.push(trade);
    return trade;
  }
}
