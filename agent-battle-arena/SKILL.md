---
name: agent-battle-arena
description: Run a trading-agent competition. Players create an AI trading agent, pick a personality (meme hunter, conservative DCA, degen sniper, whale follower, AI narrative trader), and a weekly leaderboard ranks them on PnL, drawdown, win rate, rugs avoided, best call, and worst trade. Defaults to safe paper-trading; real trades are an opt-in via the Bankr Agent API. Use when the user wants an agent battle/arena/tournament, a trading leaderboard, to "raise" or pick a trading-bot personality, or to compare trading strategies head-to-head.
metadata:
  {
    "clawdbot":
      {
        "emoji": "⚔️",
        "homepage": "https://github.com/BankrBot/skills",
        "requires": { "bins": ["node"] },
      },
  }
---

# Agent Battle Arena

A competition where AI agents trade against each other. Each player creates one
agent and picks a **personality** — they don't need to know how to trade. Every
season (default one week) a **leaderboard** ranks the agents.

The point: you raise an agent and choose its character. The strategy does the
trading; you watch it climb (or tank) the board.

- **Default mode is paper-trading** — real market dynamics, simulated money, zero
  financial risk. Perfect for tournaments and demos.
- **Real trading is opt-in** — flip an agent to `--mode real` and the orders
  route through the [Bankr Agent API](https://github.com/BankrBot/skills/tree/main/bankr).
  Gated behind explicit env flags so nobody trades real funds by accident.

## Requirements

- Node.js ≥ 22.6 (runs the TypeScript engine directly — no build step, no runtime deps).
- For real mode only: a write-enabled Bankr API key (`bk_...`) from
  [bankr.bot/api](https://bankr.bot/api) and the `bankr` CLI / Agent API.

## Quick start

```bash
# from the skill directory
node src/cli.ts seed-demo      # create an arena with all 5 demo personalities
node src/cli.ts run --all      # play out the whole season (paper trades)
node src/cli.ts leaderboard    # see the ranked board + weekly highlights
```

Or in one shot: `npm run demo`.

## The five personalities

| Key | Character | One-liner |
|-----|-----------|-----------|
| `meme-hunter` | Meme Hunter | Chases momentum memecoins; skips anything that smells like a rug. |
| `conservative-dca` | Conservative DCA | DCAs into blue chips. Lowest drawdown, steady curve. |
| `degen-sniper` | Degen Sniper | Apes fresh runners with size and high rug tolerance. High variance. |
| `whale-follower` | Whale Follower | Mirrors smart-money flow. Buys accumulation, exits distribution. |
| `ai-narrative-trader` | AI Narrative Trader | Rotates into rising-mindshare narratives, exits when the story fades. |

Full strategy logic and the signals each one reads: [references/personalities.md](references/personalities.md).

## Creating agents

```bash
node src/cli.ts new --weeks 1                      # fresh empty arena (seeded market)
node src/cli.ts add-agent --name "PepeRadar" \
  --personality meme-hunter --owner alice --cash 1000
node src/cli.ts list                               # who's in the arena
```

Each player runs `add-agent` once with their chosen `--personality`. Same arena,
same seeded market → fair head-to-head.

## Running a season

```bash
node src/cli.ts run --rounds 24    # advance 24 ticks (≈ 1 day at hourly resolution)
node src/cli.ts run --all          # finish the season
```

A "tick" is one market step (think hourly). A 1-week season = 168 ticks. The
market is **deterministic from a seed**, so a season is reproducible and the
same for every agent — see [references/arena-workflow.md](references/arena-workflow.md).

## The leaderboard

`node src/cli.ts leaderboard` ranks agents by PnL% and reports, per agent:

- **PnL** (USD and %) — equity vs starting bankroll
- **Max drawdown** — worst peak-to-trough on the equity curve
- **Win rate** — share of closed trades that were profitable
- **Rugs avoided** — risky tokens the agent flagged and skipped that later rugged
- **Best call** / **Worst trade** — top and bottom closed trades by %

Exact definitions and how each is computed: [references/leaderboard.md](references/leaderboard.md).

`node src/cli.ts agent <name>` shows one agent's full card: positions, recent
trades with reasons, and its highlights.

## Real trading (opt-in)

Paper is the default. To let an agent trade **real funds** through Bankr:

```bash
export ARENA_LIVE=1
export BANKR_API_KEY=bk_your_write_enabled_key
export ARENA_MAX_TRADE_USD=25      # per-trade cap (default 25)
node src/cli.ts add-agent --name LiveBot --personality whale-follower --mode real
node src/cli.ts run --rounds 1
```

Without `ARENA_LIVE=1` **and** a key, real mode refuses to run. Orders become
natural-language Bankr prompts (`Buy $25 of WETH on base`) executed via the
Agent API. **Start tiny, use a dedicated agent wallet.** Full safety guidance:
[references/trading-modes.md](references/trading-modes.md).

## Command reference

| Command | Description |
|---------|-------------|
| `seed-demo [--seed N] [--weeks W\|--ticks T]` | Create an arena with all 5 demo agents |
| `new [--seed N] [--weeks W\|--ticks T]` | Create an empty arena |
| `add-agent --name <n> --personality <p> [--owner o] [--mode sim\|real] [--cash N]` | Add an agent |
| `list` | List agents |
| `run [--rounds N \| --all]` | Advance the season (default 24 ticks) |
| `leaderboard` (alias `lb`) | Ranked board + highlights |
| `agent <id\|name>` | Inspect one agent |
| `personalities` | List the 5 personalities |
| `reset` | Delete the current arena |

State persists to `.arena/state.json`. Override the location with `ARENA_DIR`.

## Extending

Add a personality by implementing the `Strategy` interface in
`src/personalities/` and registering it in `src/personalities/index.ts`. A
strategy reads market signals (momentum, liquidity, whale flow, narrative score,
rug risk) and returns buy/sell **orders** plus **skips** (tokens it refused on
risk grounds — the basis of the "rugs avoided" metric).
