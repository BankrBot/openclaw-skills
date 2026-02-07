# PNP SDK API Reference

Complete API documentation for the PNP Protocol SDK.

## Installation

```bash
npm install pnp-evm ethers
```

## PNPClient

Main entry point for all operations.

```typescript
import { PNPClient } from "pnp-evm";

const client = new PNPClient({
  rpcUrl: string,           // RPC endpoint (defaults to Base mainnet)
  privateKey: string,       // Wallet private key
  contractAddresses?: {     // Optional custom addresses
    marketFactory: string,
    usdcToken: string,
    feeManager: string,
  }
});
```

## Market Module (`client.market`)

### createMarket(params)

Create a new prediction market.

```typescript
const { conditionId, hash, receipt } = await client.market.createMarket({
  question: string,           // Prediction question
  endTime: number,            // Unix timestamp when trading ends
  initialLiquidity: string,   // Amount in wei
  collateralToken?: string,   // ERC20 address (defaults to USDC)
});
```

**Returns:**
- `conditionId`: Unique market identifier
- `hash`: Transaction hash
- `receipt`: Full transaction receipt

### getMarketInfo(conditionId)

Get market details.

```typescript
const info = await client.market.getMarketInfo(conditionId);
// Returns:
// {
//   question: string,
//   endTime: string,
//   isCreated: boolean,
//   isSettled: boolean,
//   reserve: string,
//   collateral: string,
//   winningToken: string
// }
```

### getMarketPrices(conditionId)

Get current YES/NO token prices.

```typescript
const prices = await client.market.getMarketPrices(conditionId);
// Returns:
// {
//   yesPrice: string,        // e.g., "0.65"
//   noPrice: string,         // e.g., "0.35"
//   yesPricePercent: string, // e.g., "65.00%"
//   noPricePercent: string,  // e.g., "35.00%"
//   yesPriceRaw: string,
//   noPriceRaw: string
// }
```

### settleMarket(conditionId, winningTokenId)

Settle a market with the winning outcome. Only callable by market creator after end time.

```typescript
const winningTokenId = await client.trading.getTokenId(conditionId, "YES");
const result = await client.market.settleMarket(conditionId, winningTokenId);
```

## Trading Module (`client.trading`)

### getTokenId(conditionId, outcome)

Get the token ID for a specific outcome.

```typescript
const yesTokenId = await client.trading.getTokenId(conditionId, "YES");
const noTokenId = await client.trading.getTokenId(conditionId, "NO");
```

### buy(conditionId, amount, outcome, minTokensOut?)

Buy outcome tokens with collateral.

```typescript
import { ethers } from "ethers";

const amount = ethers.parseUnits("10", 6); // 10 USDC
const minTokensOut = 0n; // Slippage protection (0 = no limit)

const result = await client.trading.buy(
  conditionId,
  amount,
  "YES",        // or "NO"
  minTokensOut
);
```

**Parameters:**
- `conditionId`: Market identifier
- `amount`: Collateral amount in wei
- `outcome`: "YES" or "NO"
- `minTokensOut`: Minimum tokens to receive (slippage protection)

### sell(conditionId, amount, outcome, minCollateralOut?)

Sell outcome tokens for collateral.

```typescript
const tokenAmount = ethers.parseUnits("5", 18); // 5 outcome tokens
const minCollateralOut = 0n;

const result = await client.trading.sell(
  conditionId,
  tokenAmount,
  "YES",
  minCollateralOut
);
```

**Note:** Outcome tokens always have 18 decimals.

## Redemption Module (`client.redemption`)

### isResolved(conditionId)

Check if market is settled.

```typescript
const isSettled = await client.redemption.isResolved(conditionId);
```

### getWinningToken(conditionId)

Get the winning token ID after settlement.

```typescript
const winningTokenId = await client.redemption.getWinningToken(conditionId);
```

### redeem(conditionId)

Redeem winning tokens for collateral.

```typescript
const result = await client.redemption.redeem(conditionId);
```

## Contract Addresses (Base Mainnet)

| Contract | Address |
|----------|---------|
| PNP Factory | `0x5E5abF8a083a8E0c2fBf5193E711A61B1797e15A` |
| Fee Manager | `0x6f1BffB36aC53671C9a409A0118cA6fee2b2b462` |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| WETH | `0x4200000000000000000000000000000000000006` |
| cbETH | `0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22` |

## Error Handling

```typescript
try {
  await client.market.createMarket({ ... });
} catch (error: any) {
  if (error.message.includes("insufficient funds")) {
    // Not enough collateral balance
  } else if (error.message.includes("Slippage")) {
    // Price moved too much
  } else if (error.message.includes("Only creator")) {
    // Not authorized to settle
  }
}
```

## Rate Limiting

The SDK includes built-in retry logic for RPC rate limits. For production use, use a dedicated RPC provider (Alchemy, QuickNode, Infura) instead of the public endpoint.
