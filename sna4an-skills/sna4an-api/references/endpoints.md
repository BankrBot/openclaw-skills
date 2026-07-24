# Sna4an API - Endpoint Reference

Full documentation for all 7 endpoints.

Base URL: `https://x402.bankr.bot/0x98db0a1690f487d14eb45153e5c61f64693a2799`

---

## 1. bridge-route ($0.005)

Find optimal cross-chain bridge route. Aggregates multiple bridge providers for best rates.

**POST** `/bridge-route`

### Request Body

```json
{
  "fromChain": "ethereum",
  "toChain": "base",
  "fromToken": "USDC",
  "toToken": "USDC",
  "amount": "1000"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| fromChain | string | Yes | Source chain (ethereum, base, polygon, arbitrum, optimism, avalanche, bsc, solana) |
| toChain | string | Yes | Destination chain |
| fromToken | string | Yes | Source token symbol or address |
| toToken | string | Yes | Destination token symbol or address |
| amount | string | Yes | Amount to bridge (human-readable, e.g. "100") |

### Response

```json
{
  "bestRoute": {
    "bridge": "Li.fi",
    "provider": "stargate",
    "amountOut": "999500000",
    "estimatedGas": "0.50",
    "estimatedTime": 300,
    "steps": 1,
    "source": "li.fi"
  },
  "allRoutes": [...],
  "savings": "$0.50 vs worst route",
  "fromChain": "ethereum",
  "toChain": "base",
  "timestamp": "2026-07-25T06:00:00.000Z"
}
```

---

## 2. whale-alerts ($0.001)

Real-time whale transaction alerts. Track large transfers across EVM chains.

**POST** `/whale-alerts`

### Request Body

```json
{
  "chain": "ethereum",
  "minAmountUSD": 100000,
  "token": "USDC",
  "limit": 10
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| chain | string | Yes | - | Blockchain to monitor |
| minAmountUSD | number | No | 100000 | Minimum transaction value in USD |
| token | string | No | - | Filter by token symbol |
| limit | number | No | 10 | Number of alerts (1-50) |

### Response

```json
{
  "alerts": [
    {
      "hash": "0xabc...",
      "from": "0x123...",
      "to": "0x456...",
      "value": "1000000000",
      "asset": "USDC",
      "category": "erc20",
      "blockNum": "0x1234",
      "timestamp": "2026-07-25T06:00:00.000Z",
      "chain": "ethereum"
    }
  ],
  "totalAlerts": 1,
  "chain": "ethereum",
  "timestamp": "2026-07-25T06:00:00.000Z"
}
```

---

## 3. defi-yields ($0.001)

Find best DeFi yields across 100+ protocols. Powered by DefiLlama.

**POST** `/defi-yields`

### Request Body

```json
{
  "chain": "Base",
  "token": "USDC",
  "minAPY": 5,
  "maxRisk": "medium",
  "limit": 10
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| chain | string | No | all | Filter by chain |
| token | string | No | all | Filter by token symbol |
| minAPY | number | No | - | Minimum APY (e.g. 5 for 5%) |
| maxRisk | string | No | medium | Risk level: low, medium, high |
| limit | number | No | 10 | Number of results (1-50) |

### Response

```json
{
  "yields": [
    {
      "protocol": "aave-v3",
      "chain": "Base",
      "symbol": "USDC",
      "apy": 5.23,
      "apyBase": 4.5,
      "apyReward": 0.73,
      "tvl": 50000000,
      "pool": "abc-123",
      "url": "https://defillama.com/yields/pool/abc-123",
      "risk": "low",
      "stablecoin": true
    }
  ],
  "totalPools": 1,
  "timestamp": "2026-07-25T06:00:00.000Z"
}
```

---

## 4. blockchain-rpc ($0.01)

JSON-RPC proxy to 57+ blockchain networks via Alchemy.

**POST** `/blockchain-rpc`

### Request Body

```json
{
  "chain": "base",
  "method": "eth_getBalance",
  "params": ["0x1234567890abcdef", "latest"]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| chain | string | Yes | Chain name (ethereum, base, polygon, arbitrum, solana, etc.) |
| method | string | Yes | RPC method (eth_getBalance, eth_blockNumber, eth_call, etc.) |
| params | array | No | RPC method parameters |

### Response

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "0x1234",
  "chain": "base",
  "method": "eth_getBalance"
}
```

---

## 5. nft-data ($0.01)

NFT data API via Alchemy. Get ownership, metadata, floor prices, and sales.

**POST** `/nft-data`

### Request Body

```json
{
  "chain": "base",
  "action": "by-owner",
  "owner": "0x1234567890abcdef",
  "limit": 50
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| chain | string | Yes | Chain name |
| action | string | Yes | Action: by-owner, metadata, floor-price, sales |
| owner | string | For by-owner | Wallet address |
| contractAddress | string | For metadata/floor-price/sales | NFT contract address |
| tokenId | string | For metadata | Token ID |
| limit | number | No | Results limit (1-100) |

### Response

```json
{
  "data": {
    "ownedNfts": [...],
    "totalCount": 100
  },
  "chain": "base",
  "action": "by-owner",
  "timestamp": "2026-07-25T06:00:00.000Z"
}
```

---

## 6. token-data ($0.01)

ERC-20 token data via Alchemy. Get balances, metadata, and transfers.

**POST** `/token-data`

### Request Body

```json
{
  "chain": "base",
  "action": "balances",
  "owner": "0x1234567890abcdef"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| chain | string | Yes | Chain name |
| action | string | Yes | Action: balances, metadata, transfers |
| owner | string | For balances/transfers | Wallet address |
| contractAddress | string | For metadata | Token contract address |
| limit | number | No | Results limit (1-100) |

### Response

```json
{
  "data": {
    "address": "0x123...",
    "tokenBalances": [...]
  },
  "chain": "base",
  "action": "balances",
  "timestamp": "2026-07-25T06:00:00.000Z"
}
```

---

## 7. tx-history ($0.01)

Transaction history via Alchemy. Get historical transactions for any address.

**POST** `/tx-history`

### Request Body

```json
{
  "chain": "base",
  "fromAddress": "0x1234567890abcdef",
  "category": ["external", "erc20"],
  "maxCount": 100,
  "order": "desc"
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| chain | string | Yes | - | Chain name |
| fromAddress | string | No | - | Filter by sender |
| toAddress | string | No | - | Filter by receiver |
| category | array | No | all | Transfer types: external, erc20, erc721, erc1155, internal |
| maxCount | number | No | 100 | Max results (1-1000) |
| order | string | No | desc | Sort order: asc, desc |

### Response

```json
{
  "transfers": [
    {
      "hash": "0xabc...",
      "from": "0x123...",
      "to": "0x456...",
      "value": "1000000",
      "asset": "USDC",
      "category": "erc20",
      "blockNum": "0x1234",
      "metadata": {
        "blockTimestamp": "2026-07-25T06:00:00.000Z"
      }
    }
  ],
  "chain": "base",
  "totalTransfers": 1,
  "timestamp": "2026-07-25T06:00:00.000Z"
}
```
