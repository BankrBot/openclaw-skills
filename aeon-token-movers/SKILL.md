---
name: aeon-token-movers
description: |
  Top movers, losers, and trending coins from CoinGecko — with pump-risk flags (low liquidity,
  single-pair-only, fresh listing, volume-no-mcap, low-holder-data, cex-only). No API key
  required. Use for daily market scans, pre-trade screening, or as input to a token-pick workflow.
  Triggers: "top movers today", "what's pumping", "biggest losers 24h", "trending coins",
  "crypto movers with risk flags".
---

# aeon-token-movers

Daily scan over CoinGecko's public endpoints, enriched with pump-risk flags so the operator doesn't manually re-check every entry for honeypots.

## Inputs

| Param | Description |
|---|---|
| `limit` | Default 10 each side. |
| `min_mcap` | USD floor. Default $1M. |
| `chains` | Optional filter. Empty → all. |

## CoinGecko endpoints

```bash
# Top gainers/losers (24h)
curl -s "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=price_change_percentage_24h_desc&per_page=50&price_change_percentage=24h"

# Trending (search-volume based)
curl -s "https://api.coingecko.com/api/v3/search/trending"

# Coin detail (for risk-flag enrichment)
curl -s "https://api.coingecko.com/api/v3/coins/${id}?localization=false&tickers=true"
```

## Pump-risk flags

| Flag | Detection |
|---|---|
| `low-liquidity` | 24h volume < $250k OR top-pool TVL < $100k. |
| `single-pair-only` | Trades on only one DEX pool. |
| `fresh-listing` | First CoinGecko entry < 7 days ago. |
| `vol-no-mcap` | 24h volume > 5× market cap. |
| `low-holder-data` | Holder count unavailable or < 200. |
| `cex-only` | All volume on CEX, no DEX presence. |

Two or more flags → demoted to "Watch with caution" section.

## Output

Top gainers, top losers, trending (search momentum), and watch-with-caution. Each row includes mcap, 24h volume, chain, narrative tag if known, and any flags.

## Rules

- Flag first, sort second. Empty pools aren't signal.
- Pair gainers with losers when there's a rotation pattern (one chain rising while another bleeds).
- Context tags required for outliers (unlock, hack, narrative).
