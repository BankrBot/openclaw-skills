// Core domain types for Agent Battle Arena.

export const PERSONALITIES = [
  'meme-hunter',
  'conservative-dca',
  'degen-sniper',
  'whale-follower',
  'ai-narrative-trader',
] as const;

export type Personality = (typeof PERSONALITIES)[number];

export type TradeMode = 'sim' | 'real';

export type Side = 'buy' | 'sell';

// A single token in the market universe at a given tick.
export interface TokenTick {
  symbol: string;
  price: number;
  liquidityUsd: number;
  volume24hUsd: number;
  priceChange1h: number; // fractional, e.g. 0.12 = +12%
  priceChange24h: number;
  ageHours: number; // how long the token has existed
  narrativeScore: number; // 0..1 — AI-narrative mindshare
  whaleNetFlowUsd: number; // net smart-money flow this tick (+ buy / - sell)
  rugRisk: number; // 0..1 model risk score (honeypot / drain likelihood)
  rugged: boolean; // true on the tick a rug actually happens
}

export interface MarketSnapshot {
  tick: number;
  tokens: Record<string, TokenTick>;
}

export interface Position {
  symbol: string;
  qty: number;
  avgPrice: number;
  openedTick: number;
}

// A skip is an explicit "I evaluated this token and chose NOT to hold it for
// risk reasons". If that token later rugs, it counts as a rug avoided.
export interface SkipEvent {
  symbol: string;
  tick: number;
  reason: string;
}

export interface Trade {
  id: string;
  agentId: string;
  tick: number;
  symbol: string;
  side: Side;
  qty: number;
  price: number;
  usd: number;
  reason: string;
  realizedPnl?: number; // set on sells (close)
}

export interface AgentState {
  id: string;
  name: string;
  owner: string;
  personality: Personality;
  mode: TradeMode;
  startingCashUsd: number;
  cashUsd: number;
  positions: Record<string, Position>;
  trades: Trade[];
  skips: SkipEvent[];
  equityCurve: { tick: number; equityUsd: number }[];
  createdAt: string;
}

export interface ArenaState {
  seasonId: string;
  seed: number;
  seasonTicks: number;
  tick: number;
  startedAt: string;
  agents: Record<string, AgentState>;
  ruggedTokens: { symbol: string; tick: number }[];
}

// An order a strategy wants to place this tick.
export interface Order {
  symbol: string;
  side: Side;
  usd: number; // notional to spend (buy) or position fraction handled by engine for sells
  fraction?: number; // for sells: fraction of held qty to sell (0..1). Defaults 1.
  reason: string;
}

// Decision returned by a strategy each tick.
export interface Decision {
  orders: Order[];
  skips: SkipEvent[];
}

// What a strategy sees when deciding.
export interface StrategyContext {
  snapshot: MarketSnapshot;
  agent: AgentState;
}

export interface Strategy {
  personality: Personality;
  label: string;
  blurb: string;
  decide(ctx: StrategyContext): Decision;
}

export interface AgentScore {
  agentId: string;
  name: string;
  owner: string;
  personality: Personality;
  mode: TradeMode;
  equityUsd: number;
  pnlUsd: number;
  pnlPct: number;
  maxDrawdownPct: number;
  winRate: number; // 0..1 over closed trades
  closedTrades: number;
  rugsAvoided: number;
  rugsHeld: number; // rugs the agent was holding when they blew up
  bestCall?: { symbol: string; pnlPct: number; usd: number };
  worstTrade?: { symbol: string; pnlPct: number; usd: number };
}
