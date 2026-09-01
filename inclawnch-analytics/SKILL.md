---
name: inclawnch-analytics
description: >
  Real-time INCLAWNCH token analytics on Base. Price, volume, liquidity, staking TVL,
  UBI APY, distribution rates, and platform metrics in a single API call. No API key needed.
  Use when: (1) user asks about INCLAWNCH price or market data, (2) checking UBI staking
  yields, (3) monitoring ecosystem health, (4) building dashboards or alerts.
version: 1.0.0
metadata:
  openclaw:
    emoji: "📊"
    homepage: "https://inclawbate.com/skills"
    requires:
      bins: ["curl"]
---

# INCLAWNCH Analytics — Token & Ecosystem Data for AI Agents

Real-time analytics for the INCLAWNCH token ecosystem on Base. One endpoint returns everything: token price with 1h/6h/24h changes, volume, liquidity, market cap, UBI staking TVL, staker count, APY estimate, distribution rates, and platform growth metrics.

No API key. No auth. Public and open.

## Quick Start

```bash
# Get full ecosystem analytics
curl "https://inclawbate.com/api/inclawbate/analytics"

# Read the machine-readable skill spec
curl "https://inclawbate.com/api/inclawbate/skill/analytics"
```

## What You Get

### Token Data
| Field | Description |
|-------|-------------|
| `price_usd` | Current INCLAWNCH price in USD |
| `price_change_1h` | 1-hour price change % |
| `price_change_6h` | 6-hour price change % |
| `price_change_24h` | 24-hour price change % |
| `volume_24h` | 24h trading volume (USD) |
| `volume_6h` | 6h trading volume (USD) |
| `liquidity_usd` | Pool liquidity (USD) |
| `market_cap` | Market capitalization |
| `fdv` | Fully diluted valuation |

### Staking Data
| Field | Description |
|-------|-------------|
| `total_stakers` | Number of unique staking wallets |
| `total_staked` | Total INCLAWNCH staked |
| `tvl_usd` | Total value locked (USD) |
| `weekly_distribution_rate` | INCLAWNCH distributed per week |
| `daily_distribution_rate` | INCLAWNCH distributed per day |
| `total_distributed` | All-time INCLAWNCH distributed as UBI |
| `estimated_apy` | Current estimated staking APY % |
| `wallet_cap_pct` | Max % any single wallet receives per distribution |

### Platform Data
| Field | Description |
|-------|-------------|
| `total_humans` | Total registered humans on Inclawbate |
| `wallets_connected` | Humans with connected wallets |
| `top_skills` | Array of `{skill, count}` — most listed skills |

## Example Response

```json
{
  "token": {
    "name": "INCLAWNCH",
    "symbol": "INCLAWNCH",
    "address": "0xa1F72459dfA10BAD200Ac160eCd78C6b77a747be",
    "chain": "Base",
    "price_usd": 0.025,
    "price_change_24h": -2.1,
    "volume_24h": 45000,
    "liquidity_usd": 120000,
    "market_cap": 2500000
  },
  "staking": {
    "total_stakers": 42,
    "total_staked": 1500000,
    "tvl_usd": 37500,
    "weekly_distribution_rate": 1000,
    "daily_distribution_rate": 142.86,
    "estimated_apy": 24.5
  },
  "platform": {
    "total_humans": 85,
    "wallets_connected": 62,
    "top_skills": [
      {"skill": "design", "count": 18},
      {"skill": "content", "count": 15}
    ]
  },
  "updated_at": "2026-02-18T12:00:00.000Z"
}
```

## Data Sources

- **DexScreener** — token price, volume, liquidity (real-time)
- **Supabase** — staking positions, treasury stats, platform profiles

## Token Info

| Detail | Value |
|--------|-------|
| Token | INCLAWNCH |
| Chain | Base |
| Contract | `0xa1F72459dfA10BAD200Ac160eCd78C6b77a747be` |
| BaseScan | https://basescan.org/token/0xa1F72459dfA10BAD200Ac160eCd78C6b77a747be |

## Links

- **Skill Spec (JSON):** https://inclawbate.com/api/inclawbate/skill/analytics
- **Data Endpoint:** https://inclawbate.com/api/inclawbate/analytics
- **Skills Directory:** https://inclawbate.com/skills
- **Homepage:** https://inclawbate.com
