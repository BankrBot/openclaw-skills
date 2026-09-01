import type { AgentState, ArenaState, Personality, TradeMode } from '../types.ts';
import type { Season } from '../market/market.ts';
import { getStrategy } from '../personalities/index.ts';
import { type Broker, newTradeId } from './broker.ts';
import { SimBroker } from './simBroker.ts';

export function createArena(seed: number, seasonTicks: number): ArenaState {
  return {
    seasonId: 'season_' + Math.random().toString(36).slice(2, 8),
    seed,
    seasonTicks,
    tick: 0,
    startedAt: new Date().toISOString(),
    agents: {},
    ruggedTokens: [],
  };
}

export function addAgent(
  state: ArenaState,
  opts: { name: string; owner: string; personality: Personality; mode?: TradeMode; startingCashUsd?: number },
): AgentState {
  const id = 'agt_' + Math.random().toString(36).slice(2, 8);
  const starting = opts.startingCashUsd ?? 1000;
  const agent: AgentState = {
    id,
    name: opts.name,
    owner: opts.owner,
    personality: opts.personality,
    mode: opts.mode ?? 'sim',
    startingCashUsd: starting,
    cashUsd: starting,
    positions: {},
    trades: [],
    skips: [],
    equityCurve: [],
    createdAt: new Date().toISOString(),
  };
  state.agents[id] = agent;
  return agent;
}

export function equityOf(agent: AgentState, prices: Record<string, number>): number {
  let eq = agent.cashUsd;
  for (const pos of Object.values(agent.positions)) {
    if (pos.qty > 0) eq += pos.qty * (prices[pos.symbol] ?? 0);
  }
  return eq;
}

// Advance the season up to `rounds` ticks. `realBroker` is only constructed by
// the caller when at least one agent runs in real mode.
export async function runRounds(
  state: ArenaState,
  season: Season,
  rounds: number,
  realBroker?: Broker,
): Promise<number> {
  const sim = new SimBroker();
  const ruggedSet = new Set(state.ruggedTokens.map((r) => r.symbol));
  let processed = 0;

  for (let step = 0; step < rounds; step++) {
    const idx = state.tick;
    if (idx >= season.snapshots.length) break;
    const snap = season.snapshots[idx];

    // 1) settle rugs that fire this tick — holders get liquidated at the collapse price
    for (const t of Object.values(snap.tokens)) {
      if (!t.rugged) continue;
      if (!ruggedSet.has(t.symbol)) {
        ruggedSet.add(t.symbol);
        state.ruggedTokens.push({ symbol: t.symbol, tick: idx });
      }
      for (const agent of Object.values(state.agents)) {
        const pos = agent.positions[t.symbol];
        if (pos && pos.qty > 0) {
          const realizedPnl = (t.price - pos.avgPrice) * pos.qty;
          agent.cashUsd += pos.qty * t.price;
          agent.trades.push({
            id: newTradeId(),
            agentId: agent.id,
            tick: idx,
            symbol: t.symbol,
            side: 'sell',
            qty: pos.qty,
            price: t.price,
            usd: pos.qty * t.price,
            reason: 'RUGGED: liquidated at rug price',
            realizedPnl,
          });
          delete agent.positions[t.symbol];
        }
      }
    }

    // 2) each agent decides and trades
    for (const agent of Object.values(state.agents)) {
      const strat = getStrategy(agent.personality);
      const decision = strat.decide({ snapshot: snap, agent });

      // record distinct skips (first time a symbol is skipped)
      const seen = new Set(agent.skips.map((s) => s.symbol));
      for (const sk of decision.skips) {
        if (!seen.has(sk.symbol)) {
          seen.add(sk.symbol);
          agent.skips.push(sk);
        }
      }

      const broker = agent.mode === 'real' ? realBroker : sim;
      if (!broker) {
        throw new Error(`Agent ${agent.name} is in real mode but no real broker is available.`);
      }

      for (const order of decision.orders) {
        const t = snap.tokens[order.symbol];
        if (!t) continue;
        await broker.execute(agent, order, t, idx);
      }
    }

    // 3) mark-to-market equity snapshot for every agent
    const prices: Record<string, number> = {};
    for (const t of Object.values(snap.tokens)) prices[t.symbol] = t.price;
    for (const agent of Object.values(state.agents)) {
      agent.equityCurve.push({ tick: idx, equityUsd: equityOf(agent, prices) });
    }

    state.tick = idx + 1;
    processed++;
  }

  return processed;
}
