# Orlix API Reference

Base URL: `https://orlixai.xyz`  
Auth: None required on all endpoints

---

## Token Analyzer

### POST /api/analyze

Analyze any token on Base — live price, liquidity, buy/sell pressure, AI risk verdict.

**Request:**
```json
{
  "address": "0x799c28BAC95B3E0B26534D1e9A586511895EcBA3",
  "chain": "base"
}
```

**Response:**
```json
{
  "verdict": "SAFE",
  "price": "$0.00042",
  "marketCap": "$420,000",
  "liquidity": "$168,000",
  "fdv": "$420,000",
  "priceChange": { "h1": "+2.4%", "h6": "+8.1%", "h24": "+15.3%" },
  "volume": { "h1": "$12,400", "h6": "$54,200", "h24": "$210,800" },
  "liquidityRatio": "40%",
  "buySellRatio": "0.68",
  "aiAnalysis": "This token shows healthy liquidity relative to market cap..."
}
```

**Verdict values:** `SAFE` · `CAUTION` · `HIGH RISK`

---

## AI Chat

### POST /api/chat

Send a message to any of 19 supported AI models.

**Request:**
```json
{
  "model": "claude-sonnet-4-6",
  "messages": [
    { "role": "user", "content": "What is the best DeFi strategy on Base?" }
  ],
  "stream": false
}
```

**Supported model prefixes:**

| Prefix | Provider |
|--------|----------|
| `claude-*` | Anthropic |
| `gpt-*`, `o1`, `o3`, `o4-*` | OpenAI |
| `grok-*` | xAI |
| `gemini-*` | Google |
| `deepseek-*` | DeepSeek |
| `groq-*` | Groq |
| `mimo-*` | Mimo |

**Streaming:** Set `"stream": true` to receive SSE (Server-Sent Events).

---

## B20 Token API

All B20 actions use real Base RPC — gas, nonces, and balances are live, never mocked.

**Endpoint:** `POST https://orlixai.xyz/api/b20-skill`  
**Manifest:** `GET https://orlixai.xyz/api/b20-skill?action=manifest`

---

### GET ?action=info

```bash
curl 'https://orlixai.xyz/api/b20-skill?action=info'
```

Returns current block number, base fee, gas tips, B20 factory address, and variant descriptions.

---

### GET ?action=gas

```bash
curl 'https://orlixai.xyz/api/b20-skill?action=gas'
```

Returns EIP-1559 breakdown (base fee, maxFeePerGas, priority tips at 25/50/75th percentile) and estimated B20 deploy cost in ETH.

---

### POST balance

```json
{ "action": "balance", "address": "0xYOUR_WALLET" }
```

Returns ETH balance in wei and ether. Add `"token": "0x..."` to also check an ERC-20 balance.

---

### POST token_info

```json
{ "action": "token_info", "address": "0xTOKEN", "holder": "0xOPTIONAL_HOLDER" }
```

Reads name, symbol, decimals, and total supply via live `eth_call`. Add `"holder"` for a balance check.

---

### POST validate

```json
{
  "action": "validate",
  "name": "My Token",
  "symbol": "MTK",
  "variant": "asset",
  "decimals": 18,
  "admin": "0xYOUR_WALLET",
  "policies": { "blocklist": true }
}
```

Validates all config fields, then fetches the admin wallet's live ETH balance and compares against current deploy cost estimate.

---

### POST prepare

```json
{
  "action": "prepare",
  "name": "My Token",
  "symbol": "MTK",
  "variant": "asset",
  "decimals": 18,
  "supply_cap": "10000000",
  "admin": "0xYOUR_WALLET",
  "policies": { "blocklist": true },
  "network": "mainnet"
}
```

Returns ABI-encoded calldata for the B20 factory precompile and a complete unsigned EIP-1559 transaction with live gas and nonce from Base.

**Response:**
```json
{
  "ok": true,
  "status": "prepared",
  "txSummary": {
    "maxFeePerGas": "0.0025 gwei (0x...)",
    "maxPriorityFee": "0.001 gwei (0x...)",
    "estimatedCost": "~0.0005 ETH at current Base gas",
    "nonce": 4
  },
  "deployment": {
    "factory": "0x4200000000000000000000000000000000000B20",
    "tx": { "type": "0x02", "chainId": "0x2105", "to": "0x4200...0B20", "data": "0x..." }
  }
}
```

---

### POST receipt

```json
{ "action": "receipt", "tx_hash": "0xABC...", "network": "mainnet" }
```

Returns `success` / `pending` / `failed`, gas used, block number, and the deployed token address parsed from factory logs.

---

## Health Check

### GET /api/ping

```json
{ "ok": true }
```

---

## Data Sources

| Source | Usage |
|--------|-------|
| DexScreener API | Live price, volume, liquidity, buy/sell data |
| Base RPC (`mainnet.base.org`) | Gas prices, nonces, balances, ERC-20 reads |
| Anthropic Claude | AI analysis and risk verdict generation |

---

## $ORLIX Token

Contract on Base: `0x799c28BAC95B3E0B26534D1e9A586511895EcBA3`

- Explorer: https://basescan.org/token/0x799c28BAC95B3E0B26534D1e9A586511895EcBA3
- DexScreener: https://dexscreener.com/base/0x799c28BAC95B3E0B26534D1e9A586511895EcBA3
