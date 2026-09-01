---
title: Cross-Chain DEX Price Scanner
description: |
  Scans the same token across multiple EVM chains to find price differences
  and cross-chain arbitrage opportunities. Calculates spread between cheapest
  and most expensive chain, applies actionability filters (spread > 0.5% AND
  both sides have $100K+ liquidity to cover bridge fees and gas), and supports
  batch scanning of Binance Alpha tokens for multi-chain price comparison.
  Designed to work with Smart Money Tracker (find what to buy) and Token Safety
  Scanner (verify safety) for a complete discover-verify-execute workflow.
  Use when users ask "where is the cheapest place to buy X", "cross-chain price
  difference", "DEX arbitrage", "compare token price across chains", or
  "find arbitrage opportunities".
metadata:
  author: Bob-QoQ
  version: "1.0"
license: MIT
---

# Cross-Chain DEX Price Scanner

## Overview

| Step | Action | API |
|------|--------|-----|
| 1 | Search token across all chains simultaneously | Binance Web3 v5 search |
| 2 | Group results by chain, pick best match per chain | Local calculation |
| 3 | Calculate spread (cheapest vs most expensive chain) | Local calculation |
| 4 | Apply actionability filter (spread + liquidity check) | Local calculation |
| 5 | Optional: batch scan Binance Alpha token list | Binance Alpha list API |

### Supported Chains

| Chain | chainId |
|-------|---------|
| BNB Smart Chain | 56 |
| Ethereum | 1 |
| Base | 8453 |
| Arbitrum | 42161 |
| Polygon | 137 |

---

## Step 1: Cross-Chain Token Search

One API call returns the token's price on all specified chains simultaneously.

### Method: GET

**URL**:
```
https://web3.binance.com/bapi/defi/v5/public/wallet-direct/buw/wallet/market/token/search
```

**Headers**: `Accept-Encoding: identity`

No authentication required.

### Query Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| keyword | string | Yes | Token symbol or name (e.g. `USDC`, `CAKE`) |
| chainIds | string | Yes | Comma-separated chain IDs (e.g. `56,1,8453,42161,137`) |
| orderBy | string | No | Sort order — use `volume24h` |

### Example Request

```bash
curl 'https://web3.binance.com/bapi/defi/v5/public/wallet-direct/buw/wallet/market/token/search?keyword=USDC&chainIds=56,1,8453,42161,137&orderBy=volume24h' \
  -H 'Accept-Encoding: identity'
```

### Response (`data[]`)

| Field | Type | Description |
|-------|------|-------------|
| chainId | string | Chain ID |
| contractAddress | string | Token contract address on this chain |
| symbol | string | Token symbol |
| name | string | Token full name |
| price | string | Current price (USD) |
| volume24h | string | 24h trading volume (USD) |
| liquidity | string | DEX liquidity (USD) |
| marketCap | string | Market cap (USD) |

### Example Response

```json
{
  "data": [
    {
      "chainId": "1",
      "contractAddress": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      "symbol": "USDC",
      "name": "USDC Token",
      "price": "1.000057205914773",
      "volume24h": "611677340.24",
      "liquidity": "294933748.18",
      "marketCap": "54020280000"
    },
    {
      "chainId": "56",
      "contractAddress": "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
      "symbol": "USDC",
      "name": "USD Coin",
      "price": "0.999948",
      "volume24h": "46908824.71",
      "liquidity": "87120000.00",
      "marketCap": "54020280000"
    }
  ]
}
```

**Key behavior**: The same `keyword` search returns results across all requested chains in one call. Group by `chainId` to compare prices.

---

## Step 2: Best Match Per Chain

When multiple results exist for the same chain (e.g. wrapped vs native versions), select the one with the highest `volume24h` — it represents the most liquid and legitimate deployment.

```
for each chain_id in results:
    pick item with highest volume24h
```

---

## Step 3: Spread Calculation

After collecting one price per chain:

```
sorted_chains = sort by price ascending (cheapest first)

cheapest       = sorted_chains[0]
most_expensive = sorted_chains[-1]

spread_usd = most_expensive.price - cheapest.price
spread_pct = (spread_usd / cheapest.price) × 100
```

---

## Step 4: Actionability Filter

A spread alone does not mean profit. Apply both conditions:

| Condition | Threshold | Reason |
|-----------|-----------|--------|
| spread_pct | > 0.5% | Covers typical bridge fee + gas costs |
| cheapest.liquidity | > $100,000 | Enough depth to buy |
| most_expensive.liquidity | > $100,000 | Enough depth to sell |

```
is_actionable = (
    spread_pct > 0.5
    AND cheapest.liquidity > 100_000
    AND most_expensive.liquidity > 100_000
)
```

---

## Step 5: Batch Scan (Binance Alpha List)

To scan multiple tokens automatically, first fetch the Binance Alpha token list.

### Method: GET

**URL**:
```
https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/cex/alpha/all/token/list
```

**Headers**: `Accept-Encoding: identity`

Response: `data[]` — key fields: `tokenSymbol` (or `symbol`), `chainId`

For each unique symbol in the list: run Steps 1-4. Sort results by `spread_pct` descending.

Add a 200ms delay between requests to avoid rate limiting.

---

## Output Format

### Token Scan Output

```
================================================================
  CROSS-CHAIN DEX PRICE SCANNER
  Token: USDC (USD Coin)
================================================================

  PRICE COMPARISON  (cheapest to most expensive)
  Chain      Price        Liquidity    Volume 24h
  POLYGON    $0.999466    $12.29M      $29.64M
  ARB        $0.999852    $109.91M     $265.15M
  ETH        $0.999904    $342.30M     $611.81M
  BASE       $0.999945    $182.79M     $486.84M
  BSC        $0.999948    $87.12M      $46.90M

  SPREAD: $0.000482 (0.048%)
  Cheapest  : POLYGON @ $0.999466
  Most Exp. : BSC @ $0.999948
  [!] NOT ACTIONABLE -- Spread < 0.5%
```

### Batch Scan Output

```
  #   Token    Chains  Spread   Buy On     Sell On    OK?
  1   DEGEN    3       2.34%    BASE       BSC        [OK]
  2   BRETT    2       1.87%    BASE       ETH        [OK]
  3   PEPE     3       0.45%    BSC        ETH        [NO]
```

---

## Notes

1. All APIs are free and require no authentication
2. One search call returns all chains — no need to call per-chain
3. Pick highest-volume result when multiple matches exist for the same chain
4. Spread of 0.5% is a conservative threshold — actual profitability depends on bridge choice, gas, and trade size
5. `price`, `volume24h`, and `liquidity` fields are strings in the API response — cast to float before calculation
6. Batch scan is limited to 50 tokens per run to avoid rate limiting
7. The Alpha List API uses `www.binance.com` as base URL — different from all other APIs in this skill which use `web3.binance.com`. Handle them with separate base URL constants in your adapter.
8. Solana (CT_501) is intentionally excluded — cross-chain arbitrage between Solana and EVM chains requires specialized bridges and has a different liquidity structure. This skill covers EVM-only arbitrage.
9. Pair output with Token Safety Scanner: https://github.com/Bob-QoQ/token-safety-scanner
10. Part of the three-skill workflow: Smart Money Tracker → Token Safety Scanner → DEX Price Scanner
