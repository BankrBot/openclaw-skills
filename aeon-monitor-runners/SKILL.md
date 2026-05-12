---
name: aeon-monitor-runners
description: |
  Top 5 tokens that ran hardest in the past 24h across major chains via GeckoTerminal —
  momentum-ranked with pump-risk filters (low liquidity, wash volume, concentrated holders,
  fresh pools). Pure alpha-discovery primitive. Use intraday for momentum scans, pre-trade
  discovery for short-horizon plays, or as a chain rotation signal.
  Triggers: "top runners today", "what's pumping on Base", "biggest movers", "find me momentum",
  "chain rotation check", "what 24h runners pass the liquidity filter".
---

# aeon-monitor-runners

The "what's moving right now" signal. Pulls 24h hardest runners across Base, Ethereum, Arbitrum, Optimism, Solana (and configurable additions) from GeckoTerminal, applies pump-risk filters, and returns the top 5 worth a closer look.

Paired with `aeon-narrative-tracker` for the *why*, and `aeon-token-pick` for the disciplined pick with size and kill criterion.

## Inputs

| Param | Description |
|---|---|
| `chain` | Optional. Single chain (`base`, `eth`, `arbitrum`, `optimism`, `solana`). Empty → all configured. |
| `pool_min_tvl` | Optional. Liquidity floor in USD. Default $100k. |

## Selection rules

A candidate must satisfy:

- **24h price change** ≥ +20% (or operator-configured threshold).
- **Pool TVL** ≥ liquidity floor — filters empty pools.
- **24h volume / pool TVL** ≤ 50× — flags wash-volume patterns above this.
- **Holder count** > 200 — filters one-wallet pumps.
- **Pool age** > 24h — drops freshly-deployed honey traps.

Tokens failing two or more filters are excluded entirely. Tokens failing one are included with the failing flag named explicitly.

## Pump-risk flags

Each entry carries zero or more:

| Flag | Meaning |
|---|---|
| `low-liquidity` | Pool TVL near the configured floor. |
| `wash-vol` | Volume / TVL ratio implies churn, not natural turnover. |
| `concentrated-holders` | Top-10 holder share > 60%. |
| `fresh-pool` | Pool created < 7 days ago. |
| `single-pair-only` | Token has only one tradeable pool. |
| `bridge-locked` | TVL is bridge-locked, not freely tradeable. |

Two or more flags → demoted visually but still listed.

## GeckoTerminal API

```bash
# Trending pools per network
curl -s "https://api.geckoterminal.com/api/v2/networks/${network}/trending_pools?duration=24h"

# Top-gainer pools per network (alternative path)
curl -s "https://api.geckoterminal.com/api/v2/networks/${network}/pools?sort=h24_price_change_percentage"

# Specific pool details
curl -s "https://api.geckoterminal.com/api/v2/networks/${network}/pools/${pool_address}"
```

Networks: `base`, `eth`, `arbitrum`, `optimism`, `solana`, `polygon_pos`, `unichain`, etc.

## Output

A chain leaderboard at the top — useful as a rotation signal — then per-chain top 5:

```
*Monitor Runners — 2026-05-12*

Chain leaderboard (movers above +20% / above $100k pool TVL):
  base: 12   arbitrum: 4   solana: 3   optimism: 2   ethereum: 1

base — top 5
  1. $XYZ  +180% — $1.2M vol, $410k TVL, 850 holders — narrative: agentic-payments
     pool: WETH/XYZ on Aerodrome — [GT link]
  2. $ABC  +95%  — $820k vol, $260k TVL — flag: concentrated-holders (62% in top 10)
     pool: USDC/ABC on Uniswap V3
  3. $DEF  +62%  — $510k vol, $310k TVL — no obvious driver
  ...

arbitrum — top 5
  1. ...
```

## Persistence detection

Cross-reference with the prior 7 days of `monitor-runners` runs. Flag persistent movers (appearing in the top 5 multiple days in a row) — those are multi-day trends, not one-day candles. Persistent movers are higher-quality signal than today-only spikes.

## Guidelines

- Liquidity floor is non-negotiable. "Up 4000%" on $5k of pool TVL is not a real signal.
- Wash-vol detection beats raw volume ranking.
- One-line context per token — narrative tag if known, "no obvious driver" otherwise. No filler.
- Chain leaderboard at the top — rotation is often the more valuable signal than the individual movers.

## Required keys

None — GeckoTerminal public API. Rate-limited but generous for read-only.

## Pairs with

- `aeon-narrative-tracker` (the *why* behind the moves).
- `aeon-token-pick` (the disciplined entry with kill criterion).
- Bankr Submit for execution once the call is made.
