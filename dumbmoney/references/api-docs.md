# DumbMoney API Reference

Base URL: `https://dumbmoney.win/api`

## Endpoints

### GET /api/tokens

List all DumbMoney reflection tokens.

**Response:**
```json
[
  {
    "mint": "ABC123...",
    "name": "PepeCoin",
    "symbol": "PEPE",
    "reflectionBps": 500,
    "burnBps": 200,
    "creatorFeeBps": 100,
    "status": "bonding_curve",
    "solReserves": 45.2,
    "marketCapSol": 89.5,
    "circulatingSupply": "450000000000000000",
    "reflectionPoolSol": 2.34,
    "reflectionPoolUsd": 468.0,
    "totalBurned": 12345678.0,
    "bondingCurveProgress": 53.2,
    "price": {
      "solPerToken": 0.0000001,
      "usdPerToken": 0.00002
    },
    "createdAt": 1707400000
  }
]
```

### GET /api/tokens/:mint

Get detailed info about a specific token by its mint address.

**Parameters:**
- `mint` (path) - The token's Solana mint address

**Response:** Same fields as above, plus `tokenId` and `totalShares`.

### GET /api/tokens/:mint/earnings?wallet=WALLET

Check a wallet's pending reflection earnings for a specific token.

**Parameters:**
- `mint` (path) - The token's Solana mint address
- `wallet` (query) - The holder's Solana wallet address

**Response:**
```json
{
  "wallet": "XYZ789...",
  "token": "ABC123...",
  "pendingSol": 0.042,
  "pendingUsd": 8.40,
  "sharePercent": 2.3,
  "holderShares": 15000000,
  "totalShares": 650000000
}
```

### GET /api/top-earners

Get top 10 tokens ranked by total reflections paid to holders.

**Response:**
```json
[
  {
    "mint": "ABC123...",
    "name": "PepeCoin",
    "symbol": "PEPE",
    "reflectionPoolSol": 5.67,
    "reflectionPoolUsd": 1134.0,
    "reflectionBps": 500,
    "solReserves": 45.2,
    "totalBurned": 12345678.0,
    "creator": "DEF456..."
  }
]
```

## Notes

- All SOL amounts are in SOL (not lamports)
- `reflectionBps` is in basis points (500 = 5%)
- `status` is one of: `bonding_curve`, `graduated`, `paused`
- `bondingCurveProgress` is 0-100 (percentage of tokens sold from curve)
- Responses are cached for 10 seconds with 30-second stale-while-revalidate
- Token-2022 standard on Solana
