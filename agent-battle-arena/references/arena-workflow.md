# Arena workflow

How a season runs, end to end.

## Concepts

- **Arena / season** — one competition over a fixed number of ticks. State lives
  in `.arena/state.json` (override dir with `ARENA_DIR`).
- **Tick** — one market step. Treat it as ~1 hour; a 1-week season = **168 ticks**.
- **Seed** — the market is fully determined by `(seed, seasonTicks)`. Same seed →
  same market for everyone. Reproducible and fair.
- **Agent** — one player's entry: a name, an owner, a personality, a mode, and a
  starting bankroll (default $1,000).

## Running a one-week tournament

```bash
# 1. Create the week's arena. Use the week number as the seed for a
#    fresh-but-reproducible market.
node src/cli.ts new --weeks 1 --seed 2026_22

# 2. Each player adds their agent (once).
node src/cli.ts add-agent --name "PepeRadar"  --personality meme-hunter        --owner alice
node src/cli.ts add-agent --name "SteadyHands" --personality conservative-dca   --owner bob
node src/cli.ts add-agent --name "ApeFirst"    --personality degen-sniper       --owner carol
node src/cli.ts add-agent --name "WhaleWatch"  --personality whale-follower      --owner dave
node src/cli.ts add-agent --name "NarrativeMax" --personality ai-narrative-trader --owner erin

# 3. Play it out — all at once, or in daily chunks.
node src/cli.ts run --all            # whole week
#   …or advance gradually for a daily check-in:
node src/cli.ts run --rounds 24      # day 1
node src/cli.ts leaderboard          # standings so far
node src/cli.ts run --rounds 24      # day 2 …

# 4. Publish final standings.
node src/cli.ts leaderboard
node src/cli.ts agent ApeFirst       # deep-dive any agent
```

Or just demo it: `node src/cli.ts seed-demo && node src/cli.ts run --all && node src/cli.ts leaderboard`.

## What happens each tick (`src/engine/arena.ts → runRounds`)

1. **Settle rugs.** Any token that rugs this tick is recorded; agents holding it
   are force-liquidated at the collapse price (booked as a `RUGGED:` trade).
2. **Decisions.** Each agent's strategy runs `decide({ snapshot, agent })`,
   returning orders and skips. New distinct skips are stored.
3. **Execution.** Orders go to the agent's broker — `SimBroker` for sim, the
   gated `BankrBroker` for real.
4. **Mark to market.** Every agent records an equity snapshot for the curve that
   drives PnL and drawdown.

The season ends when `tick` reaches `seasonTicks`.

## Resetting / new seasons

```bash
node src/cli.ts reset          # delete current arena
node src/cli.ts new --weeks 2  # longer season
```

Because everything derives from the seed, you can re-run an identical season any
time by reusing the same `--seed`.

## Mixed sim + real

You can keep most agents on `sim` and run one on `--mode real` in the same arena
to benchmark a live agent against paper opponents. Real mode requires the opt-in
env flags — see [trading-modes.md](trading-modes.md).
