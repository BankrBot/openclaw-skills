---
name: aeon-monitor-runners
description: |
  Top 5 tokens that ran hardest in the past 24h across major chains via GeckoTerminal — with
  pump-risk filters (low liquidity, wash volume, concentrated holders, fresh pools). Chain
  leaderboard at the top doubles as a rotation signal. No API key required. Use for intraday
  momentum scans or short-horizon pre-trade discovery.
  Triggers: "top runners today", "what's pumping on Base", "biggest movers",
  "chain rotation check".
---

# aeon-monitor-runners

The "what's moving right now" signal. Top 24h runners across configured chains with risk filters that drop honeypots and one-wallet pumps.

## Inputs

| Param | Description |
|---|---|
| `chain` | Optional. `base`, `eth`, `arbitrum`, `optimism`, `solana`. Empty → all. |
| `pool_min_tvl` | Liquidity floor in USD. Default $100k. |

## Selection rules

- 24h price change ≥ +20% (configurable).
- Pool TVL ≥ liquidity floor.
- 24h volume / pool TVL ≤ 50× (above = wash-volume flag).
- Holder count > 200.
- Pool age > 24h.

Two or more failures → excluded. One failure → included with the flag named.

## Pump-risk flags

`low-liquidity`, `wash-vol`, `concentrated-holders`, `fresh-pool`, `single-pair-only`, `bridge-locked`. Two or more flags → demoted to "Watch with caution" section.

## GeckoTerminal API

```bash
# Trending pools per network
curl -s "https://api.geckoterminal.com/api/v2/networks/${network}/trending_pools?duration=24h"

# Top movers per network
curl -s "https://api.geckoterminal.com/api/v2/networks/${network}/pools?sort=h24_price_change_percentage"
```

Networks: `base`, `eth`, `arbitrum`, `optimism`, `solana`, `polygon_pos`, `unichain`, etc.

## Output

Chain leaderboard at the top (movers above threshold per chain — useful as a rotation signal). Then per-chain top 5 with 24h delta, volume, pool TVL, holder count, narrative tag if known, risk flags.

Persistence check: cross-reference prior 7 days. Persistent movers (multiple days in top 5) are higher-quality signal than one-day candles.

## Rules

- Liquidity floor is non-negotiable. "Up 4000%" on $5k of pool TVL is not a real signal.
- One-line context per token — narrative tag if known, "no obvious driver" otherwise.
