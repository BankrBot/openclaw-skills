import type { AgentState, Order, TokenTick, Trade } from '../types.ts';
import { type Broker, newTradeId } from './broker.ts';

const API_URL = process.env.BANKR_API_URL ?? 'https://api.bankr.bot';

// Real-money broker. Executes through the Bankr Agent API. Heavily gated:
// nothing fires unless the operator has explicitly opted in via env flags.
//
//   ARENA_LIVE=1                 hard switch — without it, every call throws
//   BANKR_API_KEY=bk_...         a write-enabled Bankr API key
//   ARENA_MAX_TRADE_USD=25       per-trade USD cap (default 25)
//   ARENA_CHAIN=base             chain for trades (default base)
//
// Accounting is mirrored from the simulated mark price as a best-effort
// estimate; the source of truth for real balances is `bankr wallet portfolio`.
export class BankrBroker implements Broker {
  readonly mode = 'real' as const;

  private apiKey: string;
  private maxTradeUsd: number;
  private chain: string;

  constructor() {
    if (process.env.ARENA_LIVE !== '1') {
      throw new Error(
        'Real trading is disabled. Set ARENA_LIVE=1 to enable live Bankr execution (real funds at risk).',
      );
    }
    const key = process.env.BANKR_API_KEY;
    if (!key) {
      throw new Error('BANKR_API_KEY is required for real mode. Create a write-enabled key at https://bankr.bot/api');
    }
    this.apiKey = key;
    this.maxTradeUsd = Number(process.env.ARENA_MAX_TRADE_USD ?? 25);
    this.chain = process.env.ARENA_CHAIN ?? 'base';
  }

  async execute(agent: AgentState, order: Order, tick: TokenTick, tickIndex: number): Promise<Trade | null> {
    const price = tick.price;
    if (price <= 0) return null;

    let prompt: string;
    let estUsd: number;

    if (order.side === 'buy') {
      const spend = Math.min(order.usd, this.maxTradeUsd, agent.cashUsd);
      if (spend < 1) return null;
      estUsd = spend;
      prompt = `Buy $${spend.toFixed(2)} of ${order.symbol} on ${this.chain}`;
    } else {
      const pos = agent.positions[order.symbol];
      if (!pos || pos.qty <= 0) return null;
      const pct = Math.round((order.fraction ?? 1) * 100);
      estUsd = pos.qty * price;
      prompt = `Sell ${pct}% of my ${order.symbol} on ${this.chain}`;
    }

    const response = await this.runPrompt(prompt);

    // mirror accounting using the mark price (best-effort estimate)
    const synthetic: Order = order;
    this.mirror(agent, synthetic, price, tickIndex);

    const last = agent.trades[agent.trades.length - 1];
    if (last) {
      last.reason = `[LIVE] ${order.reason} — ${response.slice(0, 80)}`;
    }
    void estUsd;
    return last ?? null;
  }

  private mirror(agent: AgentState, order: Order, price: number, tickIndex: number) {
    if (order.side === 'buy') {
      const spend = Math.min(order.usd, this.maxTradeUsd, agent.cashUsd);
      const qty = spend / price;
      agent.cashUsd -= spend;
      const pos = agent.positions[order.symbol];
      if (pos && pos.qty > 0) {
        const cost = pos.avgPrice * pos.qty + price * qty;
        pos.qty += qty;
        pos.avgPrice = cost / pos.qty;
      } else {
        agent.positions[order.symbol] = { symbol: order.symbol, qty, avgPrice: price, openedTick: tickIndex };
      }
      agent.trades.push({ id: newTradeId(), agentId: agent.id, tick: tickIndex, symbol: order.symbol, side: 'buy', qty, price, usd: spend, reason: order.reason });
    } else {
      const pos = agent.positions[order.symbol];
      if (!pos) return;
      const qty = pos.qty * (order.fraction ?? 1);
      const proceeds = qty * price;
      const realizedPnl = (price - pos.avgPrice) * qty;
      agent.cashUsd += proceeds;
      pos.qty -= qty;
      if (pos.qty <= 1e-9) delete agent.positions[order.symbol];
      agent.trades.push({ id: newTradeId(), agentId: agent.id, tick: tickIndex, symbol: order.symbol, side: 'sell', qty, price, usd: proceeds, reason: order.reason, realizedPnl });
    }
  }

  private async runPrompt(prompt: string): Promise<string> {
    const submit = await fetch(`${API_URL}/agent/prompt`, {
      method: 'POST',
      headers: { 'X-API-Key': this.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    if (!submit.ok) throw new Error(`Bankr submit failed: ${submit.status} ${await submit.text()}`);
    const { jobId } = (await submit.json()) as { jobId: string };

    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2000));
      const res = await fetch(`${API_URL}/agent/job/${jobId}`, { headers: { 'X-API-Key': this.apiKey } });
      if (!res.ok) continue;
      const job = (await res.json()) as { status: string; response?: string };
      if (job.status === 'completed') return job.response ?? '';
      if (job.status === 'failed' || job.status === 'cancelled') {
        throw new Error(`Bankr job ${job.status}`);
      }
    }
    throw new Error('Bankr job timed out');
  }
}
