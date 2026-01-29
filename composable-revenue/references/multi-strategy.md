# Multi-Strategy Automation

## Overview

Chain multiple DeFi actions on collected fees with percentage allocations. Executed automatically via Chainlink Automation.

## Contract

**MultiActionVaultFactory**: `0x069aEC7cE08CDc0F45135bAac0E5Fe3B579AB99b`

## Available Actions

| Action | Description | Result |
|--------|-------------|--------|
| **Buy & Burn** | Swap fees to token, send to burn address | Deflationary pressure |
| **Add Liquidity** | Provide liquidity on Uniswap V4 | Deeper markets |
| **Burn LP** | Add liquidity, then burn LP token | Permanent liquidity |
| **Holder Rewards** | Distribute to token holders pro-rata | Holder alignment |
| **Top Traders** | Reward top N traders by volume | Trading incentives |
| **Creator** | Send directly to creator wallet | Direct revenue |
| **Treasury** | Route to protocol treasury | Protocol revenue |

## Allocation Example

```typescript
const strategies = [
  { action: "burn", allocation: 4000 },      // 40%
  { action: "lp_burn", allocation: 3000 },   // 30%
  { action: "holders", allocation: 2000 },   // 20%
  { action: "creator", allocation: 1000 },   // 10%
];

// Total must equal 10000 (100%)
```

## Creating Multi-Action Vault

```typescript
const vault = await multiActionFactory.createVault({
  feeSource: feeVaultAddress,
  actions: [
    {
      actionType: 0, // BuyAndBurn
      allocationBps: 4000,
      target: BURN_ADDRESS,
      swapPath: [WETH, tokenAddress],
    },
    {
      actionType: 1, // AddLiquidity
      allocationBps: 3000,
      target: UNISWAP_ROUTER,
      burnLp: true,
    },
    {
      actionType: 2, // DistributeToHolders
      allocationBps: 2000,
      target: holderVaultAddress,
      topN: 100, // Top 100 holders
    },
    {
      actionType: 3, // SendToAddress
      allocationBps: 1000,
      target: creatorAddress,
    },
  ],
  automationInterval: 86400, // Daily
});
```

## Automation Setup

Uses Chainlink Automation for trustless execution:

```typescript
// Register upkeep
await automationRegistry.registerUpkeep(
  vaultAddress,
  500000,          // Gas limit
  adminAddress,
  0,               // Conditional
  "Daily Fee Distribution",
  "0x",
  parseEther("10"), // 10 LINK
  0
);
```

## Execution Flow

```
Chainlink Keeper checks → Fees available? → Execute all actions
                       ↓
               Action 1: Buy & Burn (40%)
                       ↓
               Action 2: Add LP (30%)
                       ↓
               Action 3: Distribute (20%)
                       ↓
               Action 4: Send (10%)
```

## Slippage Protection

All swaps include configurable slippage protection:

```typescript
const swapConfig = {
  maxSlippageBps: 100, // 1% max slippage
  deadline: Math.floor(Date.now() / 1000) + 600, // 10 min
};
```

## Monitoring

```typescript
// Check last execution
const lastExecution = await vault.lastExecutionTime();

// Check pending fees
const pending = await vault.pendingFees();

// Check action history
const events = await vault.queryFilter(
  vault.filters.ActionExecuted()
);
```

## Common Patterns

### Maximum Deflation
```
100% Buy & Burn
```

### Balanced Growth
```
50% Add LP (burn LP token)
50% Buy & Burn
```

### Holder-First
```
60% Distribute to holders
30% Buy & Burn
10% Creator
```

### Trading Incentives
```
40% Top 50 traders by volume
30% All holders pro-rata
20% Buy & Burn
10% Treasury
```
