---
name: pnp-markets
description: Create, trade, and settle prediction markets on Base with any ERC20 collateral. Use when building prediction market infrastructure, running contests, crowdsourcing probability estimates, adding utility to tokens, or tapping into true information finance via market-based forecasting.
---

# PNP Markets

Create and manage prediction markets on Base Mainnet with any ERC20 collateral token.

## Quick Install

```bash
# Using Skills
npx skills add pnp-protocol/skills

# Using Clawhub
npx clawhub@latest install proxima424/create-prediction-markets
```

## Quick Decision

```
Need prediction markets?
├─ Create market     → npx ts-node scripts/create-market.ts --help
├─ Trade (buy/sell)  → npx ts-node scripts/trade.ts --help
├─ Settle market     → npx ts-node scripts/settle.ts --help
└─ Redeem winnings   → npx ts-node scripts/redeem.ts --help
```

## Environment

```bash
export PRIVATE_KEY=<wallet_private_key>    # Required
export RPC_URL=<base_rpc_endpoint>         # Optional (defaults to public RPC)
```

For production, use a dedicated RPC (Alchemy, QuickNode) to avoid rate limits.

## Scripts

Run any script with `--help` first to see all options.

### Create Market

```bash
npx ts-node scripts/create-market.ts \
  --question "Will ETH reach $10k by Dec 2025?" \
  --duration 168 \
  --liquidity 100
```

Options: `--collateral <USDC|WETH|address>`, `--decimals <n>`

### Trade

```bash
# Buy YES tokens
npx ts-node scripts/trade.ts --buy --condition 0x... --outcome YES --amount 10

# Sell NO tokens  
npx ts-node scripts/trade.ts --sell --condition 0x... --outcome NO --amount 5 --decimals 18

# View prices only
npx ts-node scripts/trade.ts --info --condition 0x...
```

### Settle

```bash
# Settle as YES winner
npx ts-node scripts/settle.ts --condition 0x... --outcome YES

# Check status
npx ts-node scripts/settle.ts --status --condition 0x...
```

### Redeem

```bash
npx ts-node scripts/redeem.ts --condition 0x...
```

## Programmatic Usage

```typescript
import { PNPClient } from "pnp-evm";
import { ethers } from "ethers";

const client = new PNPClient({
  rpcUrl: process.env.RPC_URL || "https://mainnet.base.org",
  privateKey: process.env.PRIVATE_KEY!,
});

// Create market
const { conditionId } = await client.market.createMarket({
  question: "Will X happen?",
  endTime: Math.floor(Date.now() / 1000) + 86400 * 7,
  initialLiquidity: ethers.parseUnits("100", 6).toString(),
});

// Trade
await client.trading.buy(conditionId, ethers.parseUnits("10", 6), "YES");

// Settle (after endTime)
const tokenId = await client.trading.getTokenId(conditionId, "YES");
await client.market.settleMarket(conditionId, tokenId);

// Redeem
await client.redemption.redeem(conditionId);
```

## Collateral Tokens

Use any ERC20. Common Base Mainnet tokens:

| Token | Address | Decimals |
|-------|---------|----------|
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | 6 |
| WETH | `0x4200000000000000000000000000000000000006` | 18 |
| cbETH | `0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22` | 18 |

Custom tokens add utility—holders can participate in your markets.

## ERC20 Approvals

Before interacting with PNP contracts, you must approve them to spend your collateral tokens. This is standard for all EVM dApps.

### How It Works

1. **First interaction requires approval**: When you create a market or trade for the first time with a token, an approval transaction is sent
2. **Infinite approvals**: The SDK uses `type(uint256).max` approvals (standard EVM pattern) so you only approve once per token
3. **Subsequent interactions**: No approval needed—transactions execute directly

### Timing Considerations

The approval transaction must be confirmed on-chain before the main transaction executes. If you see:

```
ERC20: transfer amount exceeds allowance
```

This means the approval hasn't been mined yet. **Simply wait a few seconds and retry**—the approval will be confirmed and subsequent attempts will succeed.

### Why Infinite Approvals?

- **Gas efficiency**: Approve once, trade forever without extra transactions
- **Better UX**: No repeated approval popups
- **Industry standard**: Used by Uniswap, Aave, and most major DeFi protocols

For maximum security-conscious users, you can manually set specific approval amounts, but this requires an approval transaction before each interaction.

## Contracts

| Contract | Address |
|----------|---------|
| PNP Factory | `0x5E5abF8a083a8E0c2fBf5193E711A61B1797e15A` |
| Fee Manager | `0x6f1BffB36aC53671C9a409A0118cA6fee2b2b462` |

## Why Prediction Markets?

- **Information Discovery**: Market prices reveal collective probability estimates
- **Token Utility**: Use your token as collateral to drive engagement
- **Contests**: Run competitions where participants stake on outcomes
- **Forecasting**: Aggregate crowd wisdom for decision-making

The pAMM virtual liquidity model ensures smooth trading even with minimal initial liquidity.

## Troubleshooting

### "ERC20: transfer amount exceeds allowance"
The approval transaction hasn't been confirmed yet. Wait 5-10 seconds and retry.

### "Market doesn't exist"
The market creation transaction may have failed or is still pending. Verify on BaseScan that your transaction was confirmed successfully.

### "over rate limit" / RPC errors
The public Base RPC has rate limits. Use a dedicated RPC provider:
```bash
export RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY
```

### Transaction stuck or slow
Base Mainnet can occasionally have congestion. Check gas prices and consider increasing if needed.

## Reference Files

- **API Reference**: See [references/api-reference.md](references/api-reference.md) for complete SDK documentation
- **Use Cases**: See [references/use-cases.md](references/use-cases.md) for detailed use case patterns
- **Examples**: See [references/examples.md](references/examples.md) for complete code examples
