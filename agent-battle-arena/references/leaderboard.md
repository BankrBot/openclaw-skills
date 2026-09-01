# Leaderboard metrics

`node src/cli.ts leaderboard` ranks all agents and prints highlights. Metrics are
computed in `src/metrics/leaderboard.ts` from each agent's trade log and equity
curve. Agents are **ranked by PnL%** (descending).

Each agent records an equity snapshot every tick (`cash + Σ positions valued at
the current mark price`), giving an equity curve the metrics read from.

## Metrics

### PnL (USD and %)
`equityUsd − startingCashUsd`, where `equityUsd` is the last point on the equity
curve. Percent is relative to the starting bankroll.

### Max drawdown
Largest peak-to-trough drop on the equity curve:
`max over time of (runningPeak − equity) / runningPeak`. Reported as a negative
percent. Lower magnitude = steadier. This is where Conservative DCA wins.

### Win rate
Of all **closed** trades (sells with a realized PnL), the fraction with
`realizedPnl > 0`. Shown as `—` when an agent has no closed trades yet (e.g. a
pure accumulator still holding everything).

### Rugs avoided
Distinct tokens the agent **skipped for risk reasons** (`Decision.skips`) that
**later actually rugged**, and which the agent was *not* holding when the rug
fired. This rewards strategies that read `rugRisk` and stay away. A skip only
counts if it happened on or before the rug tick.

### Rugs held (💥)
Distinct tokens the agent was **still holding when they rugged**. On a rug the
engine force-liquidates the position at the collapse price, booking the loss as a
closed trade tagged `RUGGED:`. Degen Sniper, with its high rug tolerance, is the
usual victim.

### Best call / Worst trade
The closed trades with the highest and lowest realized **PnL %**. PnL% per trade
is `realizedPnl / costBasis`, where cost basis is derived as
`proceeds − realizedPnl`. A held rug typically shows up as the worst trade
(≈ −90%).

## Reading the board

```
  #   AGENT          STYLE                      PnL     PnL%    MaxDD    Win   Rug✓
  🥇  PepeRadar      meme-hunter            $619.36   +61.9%    -5.2%    60%      2
```

- **Rug✓** column = rugs avoided.
- The **Highlights** block under the table shows equity, best call, worst trade,
  and a 💥 flag with the count if the agent got rugged.

## Weekly cadence

A "week" is just a season of 168 ticks (`--weeks 1`). To run a recurring weekly
tournament: start a fresh arena each week (`new --weeks 1 --seed <week>`), have
players re-add their agents, `run --all`, then publish `leaderboard`. Using the
week number as the seed makes every week a fresh-but-reproducible market.
