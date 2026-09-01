---
title: Token Safety Scanner
description: |
  Comprehensive token security analysis for EVM contracts. Checks contract risks (honeypot,
  mintable supply, hidden owner, blacklist, tax), holder concentration, LP lock status,
  and smart money inflow activity. Returns a 0-100 risk score with detailed flags.
  Use this skill when users ask "is this token safe", "check this contract address",
  "is this a rug pull", "is this a honeypot", "check holder concentration",
  or provide any EVM contract address for security analysis.
metadata:
  author: Bob-QoQ
  version: "1.0"
license: MIT
---

# Token Safety Scanner

## Overview

| Step | Action | API |
|------|--------|-----|
| 1 | Contract security audit | GoPlus Security API |
| 2 | Holder concentration analysis | GoPlus Security API (same call) |
| 3 | Smart money inflow check | Binance Web3 API |
| 4 | Risk score calculation | Local calculation (no API) |

### Supported Chains

| Chain Name | GoPlus Chain ID | Binance chainId |
|------------|-----------------|-----------------|
| Ethereum | 1 | 1 |
| BNB Smart Chain | 56 | 56 |
| Polygon | 137 | 137 |
| Arbitrum One | 42161 | 42161 |
| Base | 8453 | 8453 |

---

## Step 1 & 2: Contract Audit + Holder Analysis

### Method: GET

**URL**:
```
https://api.gopluslabs.io/api/v1/token_security/{chain_id}?contract_addresses={address}
```

No authentication required.

### Example Request

```bash
curl 'https://api.gopluslabs.io/api/v1/token_security/1?contract_addresses=0x6982508145454ce325ddbe47a25d4ec3d2311933'
```

### Key Response Fields (`result.{contract_address}`)

**Contract Security**:

| Field | Type | Safe Value | Risk Meaning |
|-------|------|------------|--------------|
| is_open_source | string | "1" | "0" = unverified contract, high risk |
| is_honeypot | string | "0" | "1" = cannot sell, confirmed danger |
| is_mintable | string | "0" | "1" = owner can print unlimited tokens |
| hidden_owner | string | "0" | "1" = disguised ownership backdoor |
| can_take_back_ownership | string | "0" | "1" = owner can reclaim contract |
| selfdestruct | string | "0" | "1" = contract can be destroyed |
| owner_change_balance | string | "0" | "1" = owner can alter user balances |
| is_blacklisted | string | "0" | "1" = blacklist function exists |
| transfer_pausable | string | "0" | "1" = transfers can be frozen |
| cannot_buy | string | "0" | "1" = buying disabled |
| cannot_sell_all | string | "0" | "1" = cannot sell full position |
| slippage_modifiable | string | "0" | "1" = owner can change slippage |
| trading_cooldown | string | "0" | "1" = cooldown between trades |
| buy_tax | string | "0" | > "10" = high tax, > "50" = likely scam |
| sell_tax | string | "0" | > "10" = high tax, > "50" = likely scam |

**Token Info**:

| Field | Type | Description |
|-------|------|-------------|
| token_name | string | Token full name |
| token_symbol | string | Token symbol |
| holder_count | string | Total holder count |
| total_supply | string | Total token supply |

**Holder Data** (`holders[]` — top 10 wallets):

| Field | Type | Description |
|-------|------|-------------|
| address | string | Wallet address |
| percent | string | Percentage of total supply held (decimal, e.g. "0.05" = 5%) |
| is_contract | integer | 1 = contract wallet |
| is_locked | integer | 1 = tokens locked |
| tag | string | Label (e.g. "Binance 14") |

**LP Holder Data** (`lp_holders[]`):

| Field | Type | Description |
|-------|------|-------------|
| address | string | LP holder address |
| percent | string | LP percentage held (decimal) |
| is_locked | integer | 1 = LP tokens locked (good sign, reduces rug pull risk) |
| tag | string | Label |

**Creator / Owner Data**:

| Field | Type | Description |
|-------|------|-------------|
| creators[].address | string | Creator wallet address |
| owners[].address | string | Current owner wallet address |

### How to Calculate Holder Metrics

```
top10_concentration = sum of holders[0..9].percent × 100  (as percentage)
lp_locked = any lp_holders[].is_locked == 1
insider_addresses = set of creators[].address + owners[].address
insider_pct = sum of holders[].percent × 100 where address in insider_addresses
```

---

## Step 3: Smart Money Inflow Check

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
| period | string | No | `"5m"`, `"1h"`, `"4h"`, `"24h"` (default `"24h"`) |
| tagType | integer | No | `2` = smart money wallets |

### Example Request

```bash
curl -X POST 'https://web3.binance.com/bapi/defi/v1/public/wallet-direct/tracker/wallet/token/inflow/rank/query' \
-H 'Content-Type: application/json' \
-H 'Accept-Encoding: identity' \
-d '{"chainId":"56","period":"24h","tagType":2}'
```

### Response (`data[]`)

| Field | Type | Description |
|-------|------|-------------|
| ca | string | Contract address |
| tokenName | string | Token name |
| inflow | number | Net smart money inflow (USD, can be negative) |
| countBuy | string | Buy transaction count from smart money |
| countSell | string | Sell transaction count from smart money |
| holders | string | Total holder count |
| holdersTop10Percent | string | Top 10 holder percentage |
| price | string | Current price (USD) |
| marketCap | string | Market cap (USD) |
| tokenRiskLevel | integer | Risk level: -1=unknown, 1=low, 2=medium, 3=high |

To check if a specific token is on the smart money radar, search `data[]` for an item where `ca` matches the contract address (case-insensitive).

---

## Step 4: Risk Score Calculation

Calculate a score from 0–100 (higher = safer) using the following deductions:

**Contract Risks:**

| Condition | Deduct |
|-----------|--------|
| `is_honeypot` == "1" | −50 |
| `is_open_source` == "0" | −15 |
| `is_mintable` == "1" | −15 |
| `hidden_owner` == "1" | −15 |
| `can_take_back_ownership` == "1" | −10 |
| `selfdestruct` == "1" | −10 |
| `owner_change_balance` == "1" | −10 |
| `transfer_pausable` == "1" | −8 |
| `is_blacklisted` == "1" | −8 |
| `cannot_sell_all` == "1" | −8 |
| `slippage_modifiable` == "1" | −5 |
| buy_tax or sell_tax > 10% | −10 |
| buy_tax or sell_tax > 5% | −5 |

**Holder Concentration:**

| Condition | Deduct |
|-----------|--------|
| top10_concentration > 80% | −15 |
| top10_concentration > 50% | −8 |
| insider_pct > 20% | −15 |
| insider_pct > 10% | −8 |
| holder_count < 100 | −5 |
| lp_locked == false | −5 |

**Rating Scale:**

| Score | Rating |
|-------|--------|
| 80–100 | SAFE |
| 60–79 | CAUTION |
| 40–59 | RISKY |
| 0–39 | DANGER |

---

## Output Format

Present the final analysis in this structure:

1. **Token name, symbol, contract address, chain**
2. **Risk Score** (0–100) with rating (SAFE / CAUTION / RISKY / DANGER)
3. **Contract Audit** — list each risk field with pass/fail
4. **Holder Analysis** — top-10 concentration %, insider %, LP locked status
5. **Smart Money** — whether the token appeared in inflow ranking, net inflow amount
6. **Flags** — plain-language description of each risk found
7. **Disclaimer** — "For informational purposes only. Not financial advice. DYOR."

---

## Notes

1. GoPlus API is free and requires no authentication
2. Binance Web3 inflow API is free and requires no authentication
3. All GoPlus flag fields return `"0"` (safe) or `"1"` (risk present) as strings
4. Holder `percent` fields are decimals (e.g. `"0.05"` means 5%) — multiply by 100 for display
5. If GoPlus returns no data for a contract, it may not be indexed yet — report as "insufficient data"
