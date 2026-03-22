# Zerion API Reference

## Authentication

### API Key (Header)
```
Authorization: Basic {base64(API_KEY:)}
```

### x402 Payment
```
X-402-Payment: {signed_erc3009_authorization}
```

## Wallets Endpoints

### GET /v1/wallets/{address}/portfolio

Returns aggregated portfolio value.

**Parameters:**
- `currency`: USD (default), EUR, BTC, ETH

**Response:**
```json
{
  "data": {
    "type": "portfolio",
    "id": "0x...",
    "attributes": {
      "positions_distribution_by_type": {
        "wallet": 44469.60,
        "deposited": 1234.56,
        "borrowed": 0,
        "locked": 0,
        "staked": 5678.90
      },
      "positions_distribution_by_chain": {
        "base": 27495.06,
        "ethereum": 6216.25
      },
      "total": {
        "positions": 51383.06
      },
      "changes": {
        "absolute_1d": 305.86,
        "percent_1d": 0.69
      }
    }
  }
}
```

### GET /v1/wallets/{address}/positions

Returns all positions (tokens, DeFi, NFTs).

**Parameters:**
- `filter[positions]`: `only_simple`, `only_defi`, `no_filter`
- `filter[chain_ids]`: Comma-separated chain IDs
- `filter[trash]`: `only_non_trash`, `only_trash`, `no_filter`
- `sort`: `value`, `-value`
- `page[size]`: Results per page (max 100)

**Response (single position):**
```json
{
  "type": "positions",
  "id": "...",
  "attributes": {
    "position_type": "wallet",
    "quantity": {
      "int": "6485257514999279000",
      "decimals": 18,
      "float": 6.485257514999279,
      "numeric": "6.485257514999279"
    },
    "value": 13968.45,
    "price": 2153.67,
    "fungible_info": {
      "name": "Ethereum",
      "symbol": "ETH",
      "icon": { "url": "https://cdn.zerion.io/eth.png" },
      "flags": { "verified": true }
    }
  },
  "relationships": {
    "chain": {
      "data": { "type": "chains", "id": "base" }
    }
  }
}
```

### GET /v1/wallets/{address}/transactions

Returns interpreted transaction history.

**Parameters:**
- `filter[chain_ids]`: Comma-separated chain IDs
- `filter[asset_types]`: `fungible`, `nft`
- `filter[trash]`: `only_non_trash`, `no_filter`
- `page[size]`: Results per page
- `page[after]`: Cursor for pagination

**Response (single transaction):**
```json
{
  "type": "transactions",
  "id": "...",
  "attributes": {
    "operation_type": "trade",
    "hash": "0x...",
    "mined_at": "2024-03-21T15:22:35Z",
    "status": "confirmed",
    "fee": {
      "fungible_info": { "symbol": "ETH" },
      "quantity": { "float": 0.001234 },
      "value": 2.65
    },
    "transfers": [
      {
        "direction": "out",
        "fungible_info": { "symbol": "USDC" },
        "quantity": { "float": 1000 },
        "value": 1000
      },
      {
        "direction": "in",
        "fungible_info": { "symbol": "ETH" },
        "quantity": { "float": 0.45 },
        "value": 970
      }
    ]
  }
}
```

### GET /v1/wallets/{address}/pnl

Returns profit & loss data.

**Parameters:**
- `currency`: USD (default)
- `filter[chain_ids]`: Comma-separated chain IDs

**Response:**
```json
{
  "data": {
    "type": "wallet_pnl",
    "id": "0x...",
    "attributes": {
      "total_gain": -15076.15,
      "realized_gain": 45328.28,
      "unrealized_gain": -60404.44,
      "relative_total_gain_percentage": -5.65,
      "relative_realized_gain_percentage": 28.08,
      "relative_unrealized_gain_percentage": -57.36,
      "total_fee": 681.81,
      "total_invested": 266672.34,
      "realized_cost_basis": 161370.01,
      "net_invested": 105302.33,
      "received_external": 128217.01,
      "sent_external": 67415.77
    }
  }
}
```

## Fungibles Endpoints

### GET /v1/fungibles/{fungible_id}

Returns token metadata.

### GET /v1/fungibles/{fungible_id}/charts

Returns price history.

**Parameters:**
- `filter[period]`: `hour`, `day`, `week`, `month`, `year`, `max`

## Chains Endpoint

### GET /v1/chains

Returns all supported chains with metadata.

## Rate Limits

| Access Type | Requests/Second | Requests/Day |
|-------------|-----------------|--------------|
| Free API Key | 10 | 10,000 |
| Paid API Key | 100 | Unlimited |
| x402 | Unlimited | Pay per request |

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad request - check parameters |
| 401 | Unauthorized - invalid API key |
| 402 | Payment required - x402 payment needed |
| 404 | Not found - invalid address format |
| 429 | Rate limited - back off and retry |
| 500 | Server error - retry with backoff |
