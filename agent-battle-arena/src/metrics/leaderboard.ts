import type { AgentScore, AgentState, ArenaState } from '../types.ts';

interface ClosedTrade {
  symbol: string;
  pnlUsd: number;
  pnlPct: number;
  proceeds: number;
}

function closedTrades(agent: AgentState): ClosedTrade[] {
  const out: ClosedTrade[] = [];
  for (const t of agent.trades) {
    if (t.side !== 'sell' || t.realizedPnl === undefined) continue;
    const cost = t.usd - t.realizedPnl; // proceeds - pnl ≈ cost basis
    const pnlPct = cost > 0 ? t.realizedPnl / cost : t.realizedPnl < 0 ? -1 : 0;
    out.push({ symbol: t.symbol, pnlUsd: t.realizedPnl, pnlPct, proceeds: t.usd });
  }
  return out;
}

function maxDrawdownPct(agent: AgentState): number {
  let peak = -Infinity;
  let maxDd = 0;
  for (const p of agent.equityCurve) {
    if (p.equityUsd > peak) peak = p.equityUsd;
    if (peak > 0) {
      const dd = (peak - p.equityUsd) / peak;
      if (dd > maxDd) maxDd = dd;
    }
  }
  return maxDd;
}

export function computeScore(state: ArenaState, agent: AgentState): AgentScore {
  const lastEq = agent.equityCurve.length ? agent.equityCurve[agent.equityCurve.length - 1].equityUsd : agent.cashUsd;
  const pnlUsd = lastEq - agent.startingCashUsd;
  const pnlPct = agent.startingCashUsd > 0 ? pnlUsd / agent.startingCashUsd : 0;

  const closed = closedTrades(agent);
  const wins = closed.filter((c) => c.pnlUsd > 0).length;
  const winRate = closed.length ? wins / closed.length : 0;

  const ruggedSet = new Set(state.ruggedTokens.map((r) => r.symbol));
  const rugTickBySymbol = new Map(state.ruggedTokens.map((r) => [r.symbol, r.tick]));

  const heldRugSymbols = new Set(
    agent.trades.filter((t) => t.reason.startsWith('RUGGED:')).map((t) => t.symbol),
  );
  const rugsHeld = heldRugSymbols.size;

  const avoided = new Set<string>();
  for (const sk of agent.skips) {
    if (!ruggedSet.has(sk.symbol)) continue;
    if (heldRugSymbols.has(sk.symbol)) continue;
    const rugTick = rugTickBySymbol.get(sk.symbol) ?? Infinity;
    if (sk.tick <= rugTick) avoided.add(sk.symbol);
  }
  const rugsAvoided = avoided.size;

  let bestCall: AgentScore['bestCall'];
  let worstTrade: AgentScore['worstTrade'];
  for (const c of closed) {
    if (!bestCall || c.pnlPct > bestCall.pnlPct) bestCall = { symbol: c.symbol, pnlPct: c.pnlPct, usd: c.pnlUsd };
    if (!worstTrade || c.pnlPct < worstTrade.pnlPct) worstTrade = { symbol: c.symbol, pnlPct: c.pnlPct, usd: c.pnlUsd };
  }

  return {
    agentId: agent.id,
    name: agent.name,
    owner: agent.owner,
    personality: agent.personality,
    mode: agent.mode,
    equityUsd: lastEq,
    pnlUsd,
    pnlPct,
    maxDrawdownPct: maxDrawdownPct(agent),
    winRate,
    closedTrades: closed.length,
    rugsAvoided,
    rugsHeld,
    bestCall,
    worstTrade,
  };
}

export function leaderboard(state: ArenaState): AgentScore[] {
  return Object.values(state.agents)
    .map((a) => computeScore(state, a))
    .sort((a, b) => b.pnlPct - a.pnlPct);
}
