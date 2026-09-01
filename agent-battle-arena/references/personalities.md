# Personalities

Every agent is driven by one personality — a `Strategy` that, each tick, reads
market signals and returns **orders** (buy/sell) and **skips** (tokens it
evaluated and refused on risk grounds). Skips that later rug become the agent's
"rugs avoided" count.

Each token tick exposes these signals (see `src/types.ts → TokenTick`):

| Signal | Meaning |
|--------|---------|
| `priceChange1h` / `priceChange24h` | momentum over the last 1 / 24 ticks |
| `liquidityUsd` | pool depth — a proxy for how safe/exitable a token is |
| `volume24hUsd` | activity |
| `whaleNetFlowUsd` | net smart-money flow this tick (+ buy / − sell) |
| `narrativeScore` | 0–1 mindshare of the token's narrative |
| `rugRisk` | 0–1 model score; ramps up in the ~8 ticks before a real rug |
| `rugged` | true on the tick a rug actually fires |

Implementations live in `src/personalities/`.

---

## Meme Hunter — `meme-hunter`

Chases momentum. Buys tokens up >25% on the day that are still green on the hour
and have at least $50k liquidity, up to 6 positions at ~8% of bankroll each.

- **Skips** any candidate with `rugRisk > 0.5` (records the skip → rug avoided).
- **Exits** a holding at +60% (take profit), −25% (stop), or the moment its
  `rugRisk` spikes above 0.5.

Profile: lots of small momentum bets, decent win rate, moderate drawdown.

## Conservative DCA — `conservative-dca`

Boring on purpose. Each tick it dollar-cost-averages ~1.2% of bankroll split
across the two deepest-liquidity, lowest-risk assets (`rugRisk < 0.05`, liquidity
> $3M — i.e. blue chips).

- **Skips** everything with `rugRisk ≥ 0.1`, so it racks up rugs-avoided.
- **Sells** only as capital preservation, if a holding falls below −40%.

Profile: smallest drawdown, steady positive curve, few or no closed trades, wins
on *not blowing up*.

## Degen Sniper — `degen-sniper`

Max risk, max size. Snipes fresh explosive movers (`priceChange1h > 8%`, volume
> $20k) with ~22% of bankroll per position, up to 3 at a time.

- **Tolerates** rug risk up to 0.75 — so it sometimes holds a token through a
  rug (this is the personality most likely to show 💥 rugged on the board).
- **Flips fast**: banks at +40%, cuts at −20%.

Profile: highest variance — biggest best-calls and worst-trades.

## Whale Follower — `whale-follower`

Mirrors smart money. Buys when `whaleNetFlowUsd` exceeds ~4% of liquidity
(accumulation), ~12% of bankroll per position, up to 5.

- **Skips** `rugRisk > 0.45` ("whales avoid honeypots") → good rug-avoid record.
- **Exits** when whale flow turns sharply negative (distribution) or risk spikes,
  with a −30% backstop.

Profile: trend-following, balanced risk, follows the strongest flows.

## AI Narrative Trader — `ai-narrative-trader`

Trades the story. Buys tokens with `narrativeScore > 0.65` that aren't breaking
down, ~15% of bankroll per position, up to 4.

- **Skips** `rugRisk > 0.45`.
- **Exits** when `narrativeScore` fades below 0.4, trims half at +80%, cuts at −35%.

Profile: catches narrative runners (often the largest best-calls), rotates out
when mindshare cools.

---

## Adding your own

```ts
// src/personalities/myStrategy.ts
import type { Strategy } from '../types.ts';
export const myStrategy: Strategy = {
  personality: 'my-key',
  label: 'My Strategy',
  blurb: 'One line describing the edge.',
  decide({ snapshot, agent }) {
    const orders = [];
    const skips = [];
    // inspect snapshot.tokens, agent.positions, agent.cashUsd …
    return { orders, skips };
  },
};
```

Add the key to `PERSONALITIES` in `src/types.ts` and register the strategy in
`src/personalities/index.ts`.
