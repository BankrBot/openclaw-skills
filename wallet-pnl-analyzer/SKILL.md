---
title: Wallet PnL Analyzer
description: |
  Analyzes any on-chain wallet address to show token holdings, total portfolio value,
  24h price changes, and profit/loss calculations. Supports multi-chain scanning
  (Ethereum, BSC, Arbitrum, Base, Polygon) with a single address. Calculates
  token-level PnL when user provides cost basis, and compares holdings against
  7d/30d historical prices. Works with Smart Money Tracker to verify a whale's
  portfolio performance before following their trades.
  Use when users ask "how much is this wallet worth", "what tokens does this address
  hold", "did this whale make money", "show my portfolio PnL", "track wallet
  performance", or "compare wallet across chains".
  Part of the five-skill workflow: Smart Money Tracker (discover) → Token Safety
  Scanner (verify) → Cross-Chain DEX Price Scanner (buy cheap) → DeFi Yield
  Scanner (earn yield) → Wallet PnL Analyzer (track results).
metadata:
  author: Bob-QoQ
  version: "1.0"
license: MIT
---

# Wallet PnL Analyzer

## Overview

| Step | Action | API |
|------|--------|-----|
| 1 | Fetch wallet token holdings on specified chain | Binance Web3 address token list |
| 2 | Calculate total portfolio value and 24h change | Local calculation from Step 1 data |
| 3 | Optional: calculate token-level PnL with user-provided cost | Local calculation |
| 4 | Optional: scan same address across multiple chains | Repeat Step 1-2 per chain |
| 5 | Optional: fetch historical price for PnL vs 7d/30d ago | Binance Web3 token search |

### Supported Chains

| Chain | chainId |
|-------|---------|
| BNB Smart Chain | 56 |
| Ethereum | 1 |
| Base | 8453 |
| Arbitrum | 42161 |
| Polygon | 137 |

---

## Step 1: Fetch Wallet Token Holdings

### Method: POST

**URL**:
```
https://web3.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/address/token/list
```

**Headers**:
```
Content-Type: application/json
Accept-Encoding: identity
```

No authentication required.

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| walletAddress | string | Yes | On-chain wallet address (e.g. `0xAb58...`) |
| chainId | string | Yes | Chain ID (e.g. `56`, `1`) |
| orderBy | string | No | Sort order — use `usdValue` |

### Example Request

```bash
curl -X POST 'https://web3.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/address/token/list' \
  -H 'Content-Type: application/json' \
  -H 'Accept-Encoding: identity' \
  -d '{
    "walletAddress": "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B",
    "chainId": "1",
    "orderBy": "usdValue"
  }'
```

### Response (`data[]`)

| Field | Type | Description |
|-------|------|-------------|
| contractAddress | string | Token contract (empty string for native token) |
| symbol | string | Token symbol (e.g. `ETH`, `USDC`) |
| name | string | Token full name |
| balance | string | Token balance (raw, need to divide by 10^decimals) |
| decimals | number | Token decimals |
| price | string | Current price in USD |
| usdValue | string | Balance × price in USD |
| priceChange24h | string | 24h price change percentage |
| iconUrl | string | Token icon URL |

### Example Response

```json
{
  "code": "000000",
  "data": [
    {
      "contractAddress": "",
      "symbol": "ETH",
      "name": "Ethereum",
      "balance": "145320000000000000000",
      "decimals": 18,
      "price": "2450.50",
      "usdValue": "356168.66",
      "priceChange24h": "2.30",
      "iconUrl": "https://..."
    },
    {
      "contractAddress": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      "symbol": "USDC",
      "name": "USD Coin",
      "balance": "50000000000",
      "decimals": 6,
      "price": "1.0001",
      "usdValue": "50005.00",
      "priceChange24h": "0.01",
      "iconUrl": "https://..."
    }
  ],
  "success": true
}
```

**Key behavior**: Returns all tokens with non-zero balance. Dust tokens (very small balances) may be filtered out by the API. The native token (ETH, BNB, MATIC) has an empty `contractAddress`.

---

## Step 2: Calculate Portfolio Value

Aggregate all token values from Step 1:

```
total_value = sum(float(token.usdValue) for token in holdings)

# Weighted 24h change
total_value_yesterday = sum(
    float(token.usdValue) / (1 + float(token.priceChange24h) / 100)
    for token in holdings
)
change_24h_usd = total_value - total_value_yesterday
change_24h_pct = (change_24h_usd / total_value_yesterday) * 100
```

Sort holdings by `usdValue` descending for display.

---

## Step 3: Token-Level PnL (Optional)

When the user provides their average buy price for a token:

```
user_cost = 6.20            # user-provided average buy price
current_price = 8.45        # from Step 1
holding_amount = 3200       # from Step 1 (balance / 10^decimals)

cost_basis = user_cost * holding_amount
current_value = current_price * holding_amount
pnl_usd = current_value - cost_basis
pnl_pct = (pnl_usd / cost_basis) * 100
```

When the user does NOT provide cost, show relative performance instead:

```
# Compare current price vs historical price from token search
# Use Binance Web3 token search to get the current price
# Show: vs 7d ago, vs 30d ago (if available from priceChange fields)
```

---

## Step 4: Multi-Chain Scan (Optional)

When the user asks for portfolio across all chains, iterate through all supported chains:

```
CHAINS = ["1", "56", "8453", "42161", "137"]
CHAIN_NAMES = {"1": "Ethereum", "56": "BSC", "8453": "Base", "42161": "Arbitrum", "137": "Polygon"}

for chain_id in CHAINS:
    holdings = fetch_holdings(wallet_address, chain_id)
    chain_value = sum(float(t.usdValue) for t in holdings)
    # Store results per chain

# Add 200ms delay between chain requests
```

Aggregate total across all chains.

---

## Step 5: Historical Price Comparison (Optional)

To show "vs 7d ago" or "vs 30d ago", use the token dynamic info endpoint:

### Method: GET

**URL**:
```
https://web3.binance.com/bapi/defi/v4/public/wallet-direct/buw/wallet/market/token/dynamic/info
```

**Query Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| chainId | string | Yes | Chain ID |
| contractAddress | string | Yes | Token contract address |

### Response (relevant fields)

| Field | Type | Description |
|-------|------|-------------|
| price | string | Current price |
| priceChange24h | string | 24h price change % |
| priceChange7d | string | 7-day price change % (if available) |

Use price change percentages to back-calculate historical prices:

```
price_7d_ago = current_price / (1 + priceChange7d / 100)
```

---

## Output Format

### Portfolio Overview

```
================================================================
  WALLET PNL ANALYZER
  Address: 0xAb58...eC9B
  Chain: Ethereum
================================================================

  TOKEN HOLDINGS  (sorted by USD value)

  #  Token     Balance          Price       USD Value    24h
  1  ETH       145.32           $2,450.50   $356,168     +2.3%
  2  USDC      50,000.00        $1.00       $50,005      +0.0%
  3  UNI       3,200.00         $8.45       $27,040      -1.2%
  4  LINK      1,500.00         $15.20      $22,800      +4.5%
  5  AAVE      120.00           $95.00      $11,400      +0.8%

  TOTAL PORTFOLIO VALUE: $467,413
  24h CHANGE: +$8,234 (+1.79%)
================================================================
  Disclaimer: For informational purposes only. Not financial advice.
  PnL does not include gas fees, taxes, or slippage. DYOR.
```

### Token PnL (with user-provided cost)

```
================================================================
  TOKEN PNL
  Token: UNI  |  Chain: Ethereum
  Address: 0xAb58...eC9B
================================================================

  Current Price:     $8.45
  Your Avg Cost:     $6.20  (user-provided)
  Holding:           3,200.00 UNI
  Cost Basis:        $19,840.00
  Current Value:     $27,040.00

  PnL:               +$7,200.00 (+36.3%)
================================================================
```

### Multi-Chain Summary

```
================================================================
  MULTI-CHAIN PORTFOLIO
  Address: 0xAb58...eC9B
================================================================

  Chain        Tokens    Total Value     24h Change
  Ethereum     5         $467,413        +1.79%
  BSC          3         $12,450         -0.50%
  Arbitrum     2         $8,200          +3.10%
  Base         1         $2,100          +0.20%
  Polygon      4         $5,800          -1.20%

  TOTAL ACROSS ALL CHAINS: $495,963
  24h CHANGE: +$7,890 (+1.62%)
================================================================
```

---

## Notes

1. All APIs are free and require no authentication
2. The address token list API may not return tokens with zero or dust-level balances
3. `balance` is returned as a raw integer string — divide by `10^decimals` to get human-readable amount
4. `price`, `usdValue`, `priceChange24h` are strings — cast to float before calculation
5. Multi-chain scan requires one API call per chain — add 200ms delay between requests
6. Native tokens (ETH, BNB, MATIC) have empty `contractAddress` in the response
7. This skill does NOT access private keys, sign transactions, or modify wallet state — read-only queries only
8. PnL calculations exclude gas fees, bridge costs, taxes, and slippage
9. For precise historical PnL, users can optionally provide their average buy price per token
10. Pair with Smart Money Tracker to discover whale addresses, then use this skill to verify their performance
11. Part of the five-skill workflow: Smart Money Tracker → Token Safety Scanner → Cross-Chain DEX Price Scanner → DeFi Yield Scanner → Wallet PnL Analyzer
