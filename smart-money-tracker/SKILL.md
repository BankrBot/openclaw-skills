---
title: Smart Money Tracker
description: |
  Cross-dimensional alpha discovery engine. Tracks smart money inflow across multiple
  timeframes (1h/4h/24h), calculates inflow acceleration, scores smart money consensus
  (how many independent wallets buying), and detects cross-signal resonance
  (smart money x social hype x trending x meme rank).
  Goes beyond simple rankings — finds tokens where multiple signals converge simultaneously.
  Designed to work with Token Safety Scanner for a complete discover-and-verify workflow.
  Use when users ask "what are whales buying", "smart money moves", "what's accelerating",
  "which tokens have strongest smart money consensus", "cross-check signals",
  "what should I research", or any alpha discovery question.
metadata:
  author: Bob-QoQ
  version: "1.0"
license: MIT
---

# Smart Money Tracker

## Overview

| Step | Action | API |
|------|--------|-----|
| 1 | Fetch smart money inflow across 1h / 4h / 24h | Binance Web3 inflow rank |
| 2 | Calculate inflow acceleration (speeding up or slowing down?) | Local calculation |
| 3 | Score consensus (how many independent wallets buying) | From `traders` field |
| 4 | Fetch cross-signal sources (hype, trending, meme) | Binance Web3 APIs |
| 5 | Detect resonance (tokens appearing in 3+ signal dimensions) | Local calculation |

### Supported Chains

| Chain | chainId |
|-------|---------|
| BNB Smart Chain | 56 |
| Ethereum | 1 |
| Base | 8453 |
| Solana | CT_501 |

---

## Step 1: Smart Money Inflow (Multi-timeframe)

Call this API **three times** with different periods to get 1h, 4h, and 24h data.

### Method: POST

**URL**:
```
https://web3.binance.com/bapi/defi/v1/public/wallet-direct/tracker/wallet/token/inflow/rank/query
```

**Headers**: `Content-Type: application/json`, `Accept-Encoding: identity`

No authentication required.

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| chainId | string | Yes | Chain ID (e.g. `"56"` for BSC) |
| period | string | Yes | `"1h"`, `"4h"`, or `"24h"` |
| tagType | integer | No | `2` = smart money wallets |

### Example Requests

```bash
# 24h (primary)
curl -X POST 'https://web3.binance.com/bapi/defi/v1/public/wallet-direct/tracker/wallet/token/inflow/rank/query' \
-H 'Content-Type: application/json' -H 'Accept-Encoding: identity' \
-d '{"chainId":"56","period":"24h","tagType":2}'

# 4h
curl -X POST 'https://web3.binance.com/bapi/defi/v1/public/wallet-direct/tracker/wallet/token/inflow/rank/query' \
-H 'Content-Type: application/json' -H 'Accept-Encoding: identity' \
-d '{"chainId":"56","period":"4h","tagType":2}'

# 1h
curl -X POST 'https://web3.binance.com/bapi/defi/v1/public/wallet-direct/tracker/wallet/token/inflow/rank/query' \
-H 'Content-Type: application/json' -H 'Accept-Encoding: identity' \
-d '{"chainId":"56","period":"1h","tagType":2}'
```

### Response (`data[]`)

| Field | Type | Description |
|-------|------|-------------|
| ca | string | Contract address |
| tokenName | string | Token name |
| inflow | number | Net smart money inflow USD (negative = outflow) |
| countBuy | string | Buy transaction count |
| countSell | string | Sell transaction count |
| traders | integer | Number of distinct smart money wallets trading this token |
| holders | string | Total holder count |
| holdersTop10Percent | string | Top 10 holder % |
| price | string | Current price (USD) |
| marketCap | string | Market cap (USD) |
| tokenRiskLevel | integer | Risk: -1=unknown, 1=low, 2=medium, 3=high |

### Example Response

```json
{
  "data": [
    {
      "ca": "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82",
      "tokenName": "PancakeSwap Token",
      "inflow": 2340000,
      "countBuy": "312",
      "countSell": "87",
      "traders": 34,
      "holders": "1250000",
      "holdersTop10Percent": "28.5",
      "price": "2.41",
      "marketCap": "650000000",
      "tokenRiskLevel": 1
    }
  ]
}
```

---

## Step 2: Acceleration Calculation

After fetching 1h and 4h inflow for the same token, calculate whether smart money is accelerating:

```
pace_ratio = (inflow_1h × 4) / inflow_4h

if pace_ratio > 1.5  → ACCELERATING  (recent 1h pace is 1.5x faster than 4h average)
if pace_ratio < 0.5  → DECELERATING  (recent 1h pace is less than half of 4h average)
otherwise            → STEADY
```

Only calculate when both `inflow_1h > 0` and `inflow_4h > 0`.

---

## Step 3: Consensus Scoring

Use the `traders` field (number of distinct smart money wallets) from the inflow API:

| traders | Consensus Label | Signal Strength |
|---------|----------------|-----------------|
| 50+ | VERY HIGH | Extremely broad agreement |
| 30-49 | HIGH | Strong agreement |
| 15-29 | MEDIUM | Moderate agreement |
| 5-14 | LOW | Weak agreement |
| <5 | MINIMAL | Single actor, low conviction |

**Why this matters**: 1 whale buying $2M is weaker signal than 30 independent wallets each buying $67K. Consensus measures breadth, not just size.

---

## Step 4: Cross-Signal Sources

### Social Hype Leaderboard

**Method**: GET

```
https://web3.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/pulse/social/hype/rank/leaderboard?chainId=56&sentiment=All&socialLanguage=ALL&targetLanguage=en&timeRange=1
```

Response: `data.leaderBoardList[]` — key field: `metaInfo.contractAddress`

---

### Trending Tokens Rank

**Method**: POST

```
https://web3.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/pulse/unified/rank/list
```

```json
{"rankType": 10, "chainId": "56", "period": 50, "sortBy": 70, "orderAsc": false, "page": 1, "size": 20}
```

Response: `data.tokens[]` — key field: `contractAddress`

---

### Meme Breakout Rank (BSC only)

**Method**: GET

```
https://web3.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/pulse/exclusive/rank/list?chainId=56
```

Response: `data.tokens[]` — key field: `contractAddress`

---

## Step 5: Resonance Detection

For each token in the smart money inflow list, check how many signal sources it appears in:

| Signal | Source |
|--------|--------|
| SMART_MONEY | Appears in inflow rank (always true for tokens in the list) |
| HYPE | Appears in social hype leaderboard |
| TRENDING | Appears in unified trending rank |
| MEME | Appears in meme breakout rank |

**resonance_count** = number of signals present (1-4)

Tokens with **resonance_count >= 3** = high-conviction multi-signal candidates.

---

## Output Format

Present the analysis in three sections:

### Section 1: Cross-Signal Resonance
List tokens with 3+ signals. For each:
- Token name + contract address
- Which signals triggered (SMART_MONEY / HYPE / TRENDING / MEME)
- 24h net inflow USD
- Consensus label + wallet count
- Acceleration status

### Section 2: Top Smart Money Inflows Table
Top 20 tokens by 24h inflow. Columns:
- Rank, token name, 24h inflow, 1h inflow, 4h inflow, wallet count, acceleration, risk level

### Section 3: Acceleration Alert
List only ACCELERATING tokens with their 1h / 4h / 24h inflow progression.

### Footer
Always include:
- "Use Token Safety Scanner to verify any token before acting."
- "For informational purposes only. Not financial advice. DYOR."

---

## Notes

1. All APIs are free and require no authentication
2. Call the inflow API 3 times (1h, 4h, 24h) to enable acceleration analysis
3. Build a contract address set from each signal source, then check membership
4. Meme rank endpoint only returns data for BSC (chainId 56)
5. `inflow` field is a number (not string) — can be negative for net outflow
6. `traders` field counts distinct smart money wallets, not total transactions
7. When no cross-signal resonance tokens are found, skip Section 1 and note it
8. Pair output with Token Safety Scanner: https://github.com/Bob-QoQ/token-safety-scanner
