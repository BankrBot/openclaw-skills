# Batch Payments Reference

## Overview

Spraay batch payments let you send tokens to up to 200+ recipients in a single on-chain transaction. Supported on all 13 EVM chains plus Solana. Protocol fee: 0.3%.

## EVM Batch Payment

### Endpoint
```
POST https://gateway.spraay.app/api/payments/batch
```

### Request Body
```json
{
  "chain": "base",
  "token": "USDC",
  "recipients": [
    {"address": "0xABC...", "amount": "100"},
    {"address": "0xDEF...", "amount": "50.5"},
    {"address": "0x123...", "amount": "75"}
  ],
  "memo": "Q1 contributor payouts"
}
```

### Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| chain | string | Yes | Target chain: base, ethereum, arbitrum, polygon, bnb, avalanche, unichain, plasma, bob |
| token | string | Yes | Token symbol (USDC, ETH, WETH) or contract address |
| recipients | array | Yes | Array of {address, amount} objects |
| memo | string | No | On-chain memo / description |

### Response
```json
{
  "txHash": "0xabc123...",
  "chain": "base",
  "token": "USDC",
  "totalAmount": "225.5",
  "recipientCount": 3,
  "fee": "0.6765",
  "status": "confirmed",
  "blockNumber": 12345678
}
```

## Solana Batch Payment

### Endpoint
```
POST https://gateway.spraay.app/api/payments/batch
```

### Request Body
```json
{
  "chain": "solana",
  "token": "USDC",
  "recipients": [
    {"address": "7xKX...", "amount": "100"},
    {"address": "9yLM...", "amount": "50"}
  ]
}
```

Solana uses SPL token transfer instructions bundled into a single transaction.

## CSV Import

For large payouts, upload a CSV file:

```
POST https://gateway.spraay.app/api/payments/batch-csv
Content-Type: multipart/form-data
```

CSV format:
```csv
address,amount
0xABC...,100
0xDEF...,50.5
0x123...,75
```

## Supported Chains

| Chain | Chain ID | Native Token | Status |
|-------|----------|-------------|--------|
| Base | 8453 | ETH | Live |
| Ethereum | 1 | ETH | Live |
| Arbitrum | 42161 | ETH | Live |
| Polygon | 137 | MATIC | Live |
| BNB Chain | 56 | BNB | Live |
| Avalanche | 43114 | AVAX | Live |
| Unichain | 130 | ETH | Live |
| Plasma | — | ETH | Live |
| BOB | 60808 | ETH | Live |
| Solana | — | SOL | Live |
| Bittensor | — | TAO | Live |
| Stacks | — | STX | Live |
| Bitcoin | — | BTC | Live (PSBT) |

## Smart Contract

Base mainnet: `0xAd62f03C7514bb8c51f1eA70C2b75C37404695c8`

The contract accepts an array of recipients and amounts, executes all transfers atomically (all succeed or all revert), and collects a 0.3% protocol fee.

## Error Handling

| Error Code | Meaning | Resolution |
|-----------|---------|------------|
| INSUFFICIENT_BALANCE | Sender balance too low | Top up wallet |
| INVALID_ADDRESS | Malformed recipient address | Check address format |
| TOKEN_NOT_SUPPORTED | Token not recognized on chain | Use contract address instead of symbol |
| BATCH_TOO_LARGE | Over 200 recipients | Split into multiple batches |
| CHAIN_NOT_SUPPORTED | Invalid chain parameter | Check supported chains list |

## Bankr Integration Example

After Bankr executes a profitable trade:

```javascript
// Bankr sells ETH for USDC, then distributes profits
const profitDistribution = {
  chain: "base",
  token: "USDC",
  recipients: [
    {address: "0xTeamLead...", amount: "500"},
    {address: "0xDev1...", amount: "300"},
    {address: "0xDev2...", amount: "200"},
    {address: "0xTreasury...", amount: "1000"}
  ],
  memo: "ETH trade profit distribution"
};

await fetch("https://gateway.spraay.app/api/payments/batch", {
  method: "POST",
  headers: {"Content-Type": "application/json"},
  body: JSON.stringify(profitDistribution)
});
```
