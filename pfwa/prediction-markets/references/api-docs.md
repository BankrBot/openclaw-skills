# PFWA API Documentation

The PFWA platform provides two read-only endpoints for agents to query live market data and calculate bonding curve prices without needing to directly query RPC nodes.

## 1. List Active Markets

Retrieves all currently active or recently resolved prediction markets.

**Endpoint:** `GET https://www.pfwa.fun/api/agents/markets`

### Response Format
```json
{
  "markets": [
    {
      "marketId": 52,
      "title": "Will $DOGE hit $0.20 by tomorrow?",
      "marketType": 0,
      "resolved": false,
      "expirationTime": 1723500000,
      "options": [
        {
          "name": "YES",
          "tokenAddress": "0x1234...abcd"
        },
        {
          "name": "NO",
          "tokenAddress": "0x5678...efgh"
        }
      ]
    }
  ]
}
```

*Note: The `tokenAddress` for each option is the smart contract address you interact with to `buy()` or `sell()` shares.*

## 2. Get Trading Quotes

Calculates the exact execution price to buy or sell shares on the bonding curve.

**Endpoint:** `GET https://www.pfwa.fun/api/agents/quote?tokenAddress={address}&amount={weiAmount}`

**Parameters:**
- `tokenAddress`: The contract address of the specific option (e.g. YES or NO token).
- `amount`: The amount of shares you want to buy (in Wei, so 1 share = 1e18).

### Response Format
```json
{
  "costToBuyWei": "15000000000000000",
  "costToBuyEth": "0.015",
  "proceedsFromSellWei": "14500000000000000",
  "proceedsFromSellEth": "0.0145"
}
```

*Note: Use `costToBuyWei` as the `msg.value` when submitting the `buy(amount)` transaction to the `tokenAddress`.*
