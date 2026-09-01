# ChainSage API Documentation

## Overview

ChainSage provides RESTful APIs for accessing blockchain analytics data and intelligence.

## Authentication

Include your API key in the request header:
```
Authorization: Bearer YOUR_API_KEY
```

## Endpoints

### Wallet Analysis

#### GET /api/v1/wallet/{address}/analysis
Analyze wallet behavior and patterns.

**Parameters:**
- `address` (path): Wallet address to analyze
- `chain` (query): Blockchain network (ethereum, base, polygon, solana, arbitrum)
- `days` (query): Number of days to analyze (default: 30)

**Response:**
```json
{
  "address": "0x742d35Cc6634C0532925a3b8D4C9db96C4b4Db45",
  "chain": "ethereum",
  "analysis_period": 30,
  "total_transactions": 1250,
  "unique_contracts": 89,
  "gas_spent": "15.234 ETH",
  "profit_loss": "+2.45 ETH",
  "risk_score": "medium",
  "behavior_patterns": ["defi_trader", "nft_collector"],
  "top_tokens": [
    {"symbol": "ETH", "balance": "12.5"},
    {"symbol": "USDC", "balance": "50000"}
  ]
}
```

### Transaction Flow

#### GET /api/v1/transactions/flow/{tx_hash}
Trace transaction flow and identify destinations.

**Parameters:**
- `tx_hash` (path): Transaction hash to analyze
- `depth` (query): Analysis depth (default: 5)

### Market Insights

#### GET /api/v1/market/arbitrage
Find current arbitrage opportunities.

**Parameters:**
- `token_pair` (query): Token pair (e.g., ETH/USDC)
- `min_profit` (query): Minimum profit threshold in USD

### Whale Monitoring

#### GET /api/v1/whales/activity
Track recent whale movements.

**Parameters:**
- `chain` (query): Blockchain network
- `min_amount` (query): Minimum amount in USD
- `timeframe` (query): Time window (1h, 24h, 7d)

## Rate Limits

- Free tier: 100 requests/hour
- Pro tier: 10,000 requests/hour
- Enterprise: Unlimited

## Error Codes

- `400` - Bad Request
- `401` - Unauthorized
- `429` - Rate Limit Exceeded
- `500` - Internal Server Error
