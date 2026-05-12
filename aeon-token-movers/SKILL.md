---
name: aeon-token-movers
description: |
  Top movers, losers, and trending coins from CoinGecko — with signal enrichment and pump-risk
  flags (low liquidity, concentrated holders, single-pair-only, fresh listing). Public API,
  no key required. Use for daily market scans, pre-trade screening, or as input to a token-pick
  workflow.
  Triggers: "top movers today", "what's pumping", "biggest losers 24h", "trending coins",
  "show me crypto movers with risk flags".
---

# aeon-token-movers

A daily "what moved" scan over CoinGecko's public endpoints, enriched with pump-risk flags so the operator doesn't have to manually re-check every entry for honeypots.

## Inputs

| Param | Description |
|---|---|
| `limit` | Optional. Default 10 each side. |
| `min_mcap` | Optional. USD floor for inclusion. Default $1M. |
| `chains` | Optional. Comma-separated chain filter (`base,arbitrum,solana`). Empty → all. |

## CoinGecko endpoints

```bash
# Top gainers / losers (24h)
curl -s "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=price_change_percentage_24h_desc&per_page=50&page=1&price_change_percentage=24h"

# Trending (search-volume based, hourly)
curl -s "https://api.coingecko.com/api/v3/search/trending"

# Specific coin detail (for risk-flag enrichment)
curl -s "https://api.coingecko.com/api/v3/coins/${id}?localization=false&tickers=true&community_data=false"
```

## Pump-risk flags

Each row carries zero or more flags drawn from the coin detail and ticker data:

| Flag | Detection |
|---|---|
| `low-liquidity` | Total 24h volume < $250k OR top-pool TVL < $100k. |
| `single-pair-only` | Coin trades on only one DEX pool. |
| `fresh-listing` | First CoinGecko entry < 7 days ago. |
| `vol-no-mcap` | 24h volume > 5× market cap (cycling, not real turnover). |
| `low-holder-data` | Holder count unavailable or < 200. |
| `cex-only` | All volume on CEX with no DEX presence. |

Two or more flags → demoted to a "watch with caution" section, never the top of the list.

## Output

```
*Token Movers — 2026-05-12*

Top gainers (24h)
  1. $XYZ +180% — $4.2M cap, $1.8M vol — Base — no flags
  2. $ABC +112% — $8.1M cap, $4.3M vol — Solana — no flags
  3. $DEF +95%  — $1.2M cap, $890k vol — Ethereum — flag: low-liquidity
  ...

Top losers (24h)
  1. $GHI -42% — $14M cap, $2.1M vol — Base — context: unlock cliff Mon
  2. $JKL -38% — $9.4M cap, $1.6M vol — Arbitrum
  ...

Trending (search momentum, last hour)
  1. $MNO — new listing, +3 days, $2.3M cap — flag: fresh-listing
  2. $PQR — narrative: agentic-payments
  ...

Watch with caution (2+ flags)
  $STU +75% — flags: low-liquidity, vol-no-mcap, fresh-listing — pool TVL $42k
```

## Guidelines

- "Up 4000%" on $5k of pool TVL isn't signal. Flag first, then sort.
- Pair gainers with their losers when there's a clear rotation pattern (one chain rising while another bleeds).
- Context tags are required for outliers (unlock, hack, narrative tag if obvious).
- Trending is search-volume based — useful as a leading indicator on retail attention, weaker for sophisticated flow.

## Pairs with

- `aeon-monitor-runners` for DEX-pool-based momentum (this skill is CEX-aware too).
- `aeon-token-pick` downstream for the disciplined pick with kill criterion.
- Bankr Submit / Trails for execution.

## Required keys

None — CoinGecko public API. Rate-limited (10-30 calls/min on the free tier).
