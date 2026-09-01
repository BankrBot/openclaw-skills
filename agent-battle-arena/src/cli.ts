#!/usr/bin/env node
import { rmSync } from 'node:fs';
import { PERSONALITIES, type Personality, type TradeMode } from './types.ts';
import { STRATEGIES } from './personalities/index.ts';
import { addAgent, createArena, runRounds } from './engine/arena.ts';
import { leaderboard, computeScore } from './metrics/leaderboard.ts';
import { hasState, loadState, saveState, seasonFor, statePath } from './store/store.ts';
import type { Broker } from './engine/broker.ts';

// ---------- tiny arg parser ----------
function parseArgs(argv: string[]): { _: string[]; flags: Record<string, string | boolean> } {
  const _: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i++;
      }
    } else {
      _.push(a);
    }
  }
  return { _, flags };
}

// ---------- formatting ----------
const usd = (n: number) => (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
const pct = (n: number) => (n >= 0 ? '+' : '') + (n * 100).toFixed(1) + '%';
const pad = (s: string, n: number) => (s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length));
const padL = (s: string, n: number) => (s.length >= n ? s : ' '.repeat(n - s.length) + s);

function die(msg: string): never {
  console.error('error: ' + msg);
  process.exit(1);
}

// ---------- commands ----------
function cmdNew(flags: Record<string, string | boolean>) {
  const seed = flags.seed ? Number(flags.seed) : Math.floor(Math.random() * 1e9);
  const ticks = flags.ticks ? Number(flags.ticks) : flags.weeks ? Number(flags.weeks) * 168 : 168;
  const state = createArena(seed, ticks);
  saveState(state);
  console.log(`Created arena ${state.seasonId}`);
  console.log(`  seed: ${seed}   season: ${ticks} ticks (${(ticks / 168).toFixed(1)} week)`);
  console.log(`  state: ${statePath()}`);
  console.log(`\nNext: arena add-agent --name "..." --personality <name> --owner you`);
}

function cmdSeedDemo(flags: Record<string, string | boolean>) {
  const seed = flags.seed ? Number(flags.seed) : 42;
  const ticks = flags.ticks ? Number(flags.ticks) : flags.weeks ? Number(flags.weeks) * 168 : 168;
  const state = createArena(seed, ticks);
  const names: Record<Personality, string> = {
    'meme-hunter': 'PepeRadar',
    'conservative-dca': 'SteadyHands',
    'degen-sniper': 'ApeFirst',
    'whale-follower': 'WhaleWatch',
    'ai-narrative-trader': 'NarrativeMax',
  };
  for (const p of PERSONALITIES) {
    addAgent(state, { name: names[p], owner: 'demo', personality: p, mode: 'sim', startingCashUsd: 1000 });
  }
  saveState(state);
  console.log(`Seeded demo arena ${state.seasonId} (seed ${seed}, ${ticks} ticks) with ${PERSONALITIES.length} agents:`);
  for (const p of PERSONALITIES) console.log(`  • ${pad(names[p], 14)} ${p}`);
  console.log(`\nNext: arena run --all   then   arena leaderboard`);
}

function cmdAddAgent(flags: Record<string, string | boolean>) {
  const state = loadState();
  const name = String(flags.name ?? '');
  const personality = String(flags.personality ?? '') as Personality;
  if (!name) die('--name is required');
  if (!PERSONALITIES.includes(personality)) die(`--personality must be one of: ${PERSONALITIES.join(', ')}`);
  const mode = (String(flags.mode ?? 'sim') as TradeMode);
  if (mode !== 'sim' && mode !== 'real') die('--mode must be sim or real');
  const owner = String(flags.owner ?? 'you');
  const cash = flags.cash ? Number(flags.cash) : 1000;
  const agent = addAgent(state, { name, owner, personality, mode, startingCashUsd: cash });
  saveState(state);
  console.log(`Added ${agent.name} [${agent.personality}] mode=${agent.mode} bankroll=${usd(cash)} → ${agent.id}`);
  if (mode === 'real') {
    console.log('  ⚠ real mode trades use actual funds via Bankr. Requires ARENA_LIVE=1 and BANKR_API_KEY at run time.');
  }
}

function cmdList() {
  const state = loadState();
  const agents = Object.values(state.agents);
  if (!agents.length) return console.log('No agents yet. Add one with: arena add-agent ...');
  console.log(`Arena ${state.seasonId} — tick ${state.tick}/${state.seasonTicks}\n`);
  console.log(pad('ID', 12) + pad('NAME', 16) + pad('PERSONALITY', 20) + pad('MODE', 6) + pad('OWNER', 12));
  for (const a of agents) {
    console.log(pad(a.id, 12) + pad(a.name, 16) + pad(a.personality, 20) + pad(a.mode, 6) + pad(a.owner, 12));
  }
}

async function cmdRun(flags: Record<string, string | boolean>) {
  const state = loadState();
  const season = seasonFor(state);
  const remaining = season.snapshots.length - state.tick;
  if (remaining <= 0) return console.log('Season already complete. Start a new one with: arena new');
  const rounds = flags.all ? remaining : flags.rounds ? Number(flags.rounds) : Math.min(24, remaining);

  let realBroker: Broker | undefined;
  const needsReal = Object.values(state.agents).some((a) => a.mode === 'real');
  if (needsReal) {
    const { BankrBroker } = await import('./engine/bankrBroker.ts');
    realBroker = new BankrBroker(); // throws clearly if not opted-in
    console.log('⚠ real-mode agents present — executing live trades via Bankr.');
  }

  const processed = await runRounds(state, season, rounds, realBroker);
  saveState(state);
  console.log(`Ran ${processed} ticks → now at ${state.tick}/${state.seasonTicks}.`);
  if (state.tick >= state.seasonTicks) console.log('Season complete. Run: arena leaderboard');
}

function rankBadge(i: number): string {
  return ['🥇', '🥈', '🥉'][i] ?? ` ${i + 1}.`;
}

function cmdLeaderboard() {
  const state = loadState();
  const board = leaderboard(state);
  if (!board.length) return console.log('No agents to rank yet.');

  console.log(`\n  AGENT BATTLE ARENA — ${state.seasonId}`);
  console.log(`  tick ${state.tick}/${state.seasonTicks}  ·  seed ${state.seed}  ·  rugs this season: ${state.ruggedTokens.length}\n`);

  const header =
    '  ' + pad('#', 4) + pad('AGENT', 15) + pad('STYLE', 19) +
    padL('PnL', 11) + padL('PnL%', 9) + padL('MaxDD', 9) + padL('Win', 7) + padL('Rug✓', 7);
  console.log(header);
  console.log('  ' + '─'.repeat(header.length - 2));

  board.forEach((s, i) => {
    const winStr = s.closedTrades ? (s.winRate * 100).toFixed(0) + '%' : '—';
    const row =
      '  ' + pad(rankBadge(i), 4) + pad(s.name, 15) + pad(s.personality, 19) +
      padL(usd(s.pnlUsd), 11) + padL(pct(s.pnlPct), 9) +
      padL(pct(-s.maxDrawdownPct), 9) + padL(winStr, 7) +
      padL(String(s.rugsAvoided), 7);
    console.log(row);
  });

  console.log('\n  Highlights');
  for (const s of board) {
    const best = s.bestCall ? `${s.bestCall.symbol} ${pct(s.bestCall.pnlPct)}` : '—';
    const worst = s.worstTrade ? `${s.worstTrade.symbol} ${pct(s.worstTrade.pnlPct)}` : '—';
    const rug = s.rugsHeld > 0 ? `  💥 rugged ${s.rugsHeld}` : '';
    console.log(`  • ${pad(s.name, 14)} equity ${padL(usd(s.equityUsd), 11)}   best: ${pad(best, 22)} worst: ${pad(worst, 22)}${rug}`);
  }
  console.log('');
}

function cmdAgent(args: string[]) {
  const state = loadState();
  const q = (args[0] ?? '').toLowerCase();
  if (!q) die('usage: arena agent <id|name>');
  const agent = Object.values(state.agents).find((a) => a.id.toLowerCase() === q || a.name.toLowerCase() === q);
  if (!agent) die(`no agent matching "${q}"`);
  const s = computeScore(state, agent);

  console.log(`\n${agent.name}  [${agent.personality}]  mode=${agent.mode}  owner=${agent.owner}`);
  console.log(STRATEGIES[agent.personality].blurb);
  console.log(`\n  equity      ${usd(s.equityUsd)}  (start ${usd(agent.startingCashUsd)})`);
  console.log(`  PnL         ${usd(s.pnlUsd)}  (${pct(s.pnlPct)})`);
  console.log(`  max drawdown ${pct(-s.maxDrawdownPct)}`);
  console.log(`  win rate    ${s.closedTrades ? (s.winRate * 100).toFixed(0) + '%' : '—'}  over ${s.closedTrades} closed trades`);
  console.log(`  rugs avoided ${s.rugsAvoided}   rugs held ${s.rugsHeld}`);
  if (s.bestCall) console.log(`  best call   ${s.bestCall.symbol} ${pct(s.bestCall.pnlPct)} (${usd(s.bestCall.usd)})`);
  if (s.worstTrade) console.log(`  worst trade ${s.worstTrade.symbol} ${pct(s.worstTrade.pnlPct)} (${usd(s.worstTrade.usd)})`);

  const open = Object.values(agent.positions).filter((p) => p.qty > 0);
  if (open.length) {
    console.log('\n  open positions:');
    for (const p of open) console.log(`    ${pad(p.symbol, 14)} qty ${p.qty.toPrecision(4)} @ avg ${p.avgPrice.toPrecision(4)}`);
  }
  const recent = agent.trades.slice(-8);
  if (recent.length) {
    console.log('\n  recent trades:');
    for (const t of recent) {
      const pnl = t.realizedPnl !== undefined ? `  pnl ${usd(t.realizedPnl)}` : '';
      console.log(`    t${padL(String(t.tick), 3)} ${pad(t.side.toUpperCase(), 4)} ${pad(t.symbol, 12)} ${usd(t.usd)}${pnl}  — ${t.reason}`);
    }
  }
  console.log('');
}

function cmdPersonalities() {
  console.log('\nAvailable personalities:\n');
  for (const p of PERSONALITIES) {
    const s = STRATEGIES[p];
    console.log(`  ${pad(p, 20)} ${s.label}`);
    console.log(`  ${' '.repeat(20)} ${s.blurb}\n`);
  }
}

function cmdReset() {
  const path = statePath();
  if (!hasState()) return console.log('Nothing to reset.');
  rmSync(path, { force: true });
  console.log(`Removed ${path}`);
}

function help() {
  console.log(`
Agent Battle Arena — agents compete with simulated or real trading strategies.

Usage: arena <command> [options]

Commands:
  seed-demo [--seed N] [--ticks T|--weeks W]   Create an arena with all 5 demo agents
  new [--seed N] [--ticks T|--weeks W]         Create an empty arena (default 1 week = 168 ticks)
  add-agent --name <n> --personality <p>       Add an agent
            [--owner o] [--mode sim|real] [--cash N]
  list                                         List agents
  run [--rounds N | --all]                     Advance the season (default 24 ticks)
  leaderboard                                  Show the ranked board + highlights
  agent <id|name>                              Inspect one agent
  personalities                                List the 5 personalities
  reset                                        Delete the current arena state
  help                                         This message

Personalities: ${PERSONALITIES.join(', ')}

Real trading (opt-in): set ARENA_LIVE=1 and BANKR_API_KEY, then add agents with --mode real.
Quick start:  arena seed-demo && arena run --all && arena leaderboard
`);
}

// ---------- dispatch ----------
async function main() {
  const argv = process.argv.slice(2);
  const { _, flags } = parseArgs(argv);
  const cmd = _[0] ?? 'help';
  switch (cmd) {
    case 'new': return cmdNew(flags);
    case 'seed-demo': return cmdSeedDemo(flags);
    case 'add-agent': return cmdAddAgent(flags);
    case 'list': return cmdList();
    case 'run': return cmdRun(flags);
    case 'leaderboard': case 'lb': return cmdLeaderboard();
    case 'agent': return cmdAgent(_.slice(1));
    case 'personalities': return cmdPersonalities();
    case 'reset': return cmdReset();
    case 'help': case '--help': case '-h': return help();
    default:
      console.error(`unknown command: ${cmd}`);
      help();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error('error: ' + (err instanceof Error ? err.message : String(err)));
  process.exit(1);
});
