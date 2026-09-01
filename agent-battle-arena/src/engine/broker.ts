import type { AgentState, Order, TokenTick, Trade } from '../types.ts';

export interface Broker {
  readonly mode: 'sim' | 'real';
  // Execute an order for an agent at the given tick/price context.
  // Mutates agent state and returns the resulting trade, or null if skipped.
  execute(agent: AgentState, order: Order, tick: TokenTick, tickIndex: number): Promise<Trade | null>;
}

export const TRADING_FEE = 0.003; // 0.3% per fill, applied to both sides

export function newTradeId(): string {
  return 'tx_' + Math.random().toString(36).slice(2, 10);
}
