import type { AgentState, TokenTick } from '../types.ts';

export function tokensArray(tokens: Record<string, TokenTick>): TokenTick[] {
  return Object.values(tokens).filter((t) => !t.rugged && t.price > 0);
}

export function holds(agent: AgentState, symbol: string): boolean {
  const p = agent.positions[symbol];
  return !!p && p.qty > 0;
}

export function positionPnlPct(agent: AgentState, t: TokenTick): number {
  const p = agent.positions[t.symbol];
  if (!p || p.qty <= 0) return 0;
  return t.price / p.avgPrice - 1;
}

// Notional sized as a fraction of the agent's *starting* bankroll, clamped to
// available cash. Keeps sizing stable as equity swings.
export function size(agent: AgentState, fraction: number): number {
  const want = agent.startingCashUsd * fraction;
  return Math.max(0, Math.min(want, agent.cashUsd));
}

export function openPositionCount(agent: AgentState): number {
  return Object.values(agent.positions).filter((p) => p.qty > 0).length;
}
