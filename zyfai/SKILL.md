---
name: zyfai
description: Earn yield on any Ethereum wallet on Base, Arbitrum, and Plasma. Use when a user wants passive DeFi yield on their funds. Deploys a non-custodial subaccount (Safe) linked to their EOA, enables automated yield optimization, and lets them deposit/withdraw anytime.
---

# Zyfai — Yield for Any Wallet

Turn any Ethereum wallet into a yield-generating account.

## What This Does

When a user wants to **earn yield** on their crypto, Zyfai creates a **subaccount** (Safe smart wallet) linked to their existing wallet (EOA). Funds deposited into this subaccount are automatically optimized across DeFi protocols. The user stays in full control and can withdraw anytime.

```
┌─────────────────┐      ┌──────────────────────┐
│   User's EOA    │ ───► │  Zyfai Subaccount    │
│  (their wallet) │      │  (Safe smart wallet) │
│                 │      │                      │
│  Owns & controls│      │  • Auto-rebalancing  │
│                 │      │  • Yield optimization│
│                 │      │  • Non-custodial     │
└─────────────────┘      └──────────────────────┘
```

**Key points:**
- The subaccount is **owned by the user's EOA** — only they can withdraw
- Session keys allow **automated rebalancing** but cannot withdraw to other addresses
- Same EOA = same subaccount address across all chains

## The Flow

```
1. DEPLOY    →  Create subaccount linked to user's wallet
2. SESSION   →  Enable automated yield optimization  
3. DEPOSIT   →  Send funds to subaccount (starts earning)
4. WITHDRAW  →  Pull funds back to wallet (anytime)
```

## Prerequisites

- **API Key** from [sdk.zyf.ai](https://sdk.zyf.ai) (connect wallet to get one)
- **Private Key** of the user's EOA (the agent must provide this)
- **Node.js 18+**

```bash
npm install @zyfai/sdk viem
```

## Supported Chains

| Chain    | ID    |
|----------|-------|
| Arbitrum | 42161 |
| Base     | 8453  |
| Plasma   | 9745  |

## Important: Always Use EOA Address

When calling SDK methods, **always pass the EOA address** (the user's wallet address) as `userAddress` — never the subaccount/Safe address. The SDK derives the subaccount address automatically from the EOA.

## Step-by-Step

### 1. Connect to Zyfai

```typescript
import { ZyfaiSDK } from "@zyfai/sdk";

const sdk = new ZyfaiSDK({ apiKey: "your-api-key" });

// Use the private key provided by the agent
await sdk.connectAccount(privateKey, 8453); // chainId
```

**Important:** Always use the private key that the agent has access to. The private key must correspond to the EOA you're operating on.

### 2. Deploy Subaccount

```typescript
const userAddress = "0x..."; // User's EOA (NOT the subaccount address!)
const chainId = 8453; // Base

// Check if subaccount exists
const wallet = await sdk.getSmartWalletAddress(userAddress, chainId);
console.log(`Subaccount: ${wallet.address}`);
console.log(`Deployed: ${wallet.isDeployed}`);

// Deploy if needed
if (!wallet.isDeployed) {
  const result = await sdk.deploySafe(userAddress, chainId, "conservative");
  console.log("Subaccount deployed:", result.safeAddress);
}
```

**Strategies:**
- `"conservative"` — Stable yield, lower risk
- `"aggressive"` — Higher yield, higher risk

### 3. Enable Yield Optimization

```typescript
await sdk.createSessionKey(userAddress, chainId);
```

This allows Zyfai to rebalance funds automatically. Session keys **cannot** withdraw to arbitrary addresses — only optimize within the protocol.

### 4. Deposit Funds

```typescript
// Deposit 10 USDC (6 decimals)
await sdk.depositFunds(userAddress, chainId, "10000000");
```

Funds move from EOA → Subaccount and start earning yield immediately.

### 5. Withdraw Funds

```typescript
// Withdraw everything
await sdk.withdrawFunds(userAddress, chainId);

// Or withdraw partial (5 USDC)
await sdk.withdrawFunds(userAddress, chainId, "5000000");
```

Funds return to the user's EOA. Withdrawals are processed asynchronously.

### 6. Disconnect

```typescript
await sdk.disconnectAccount();
```

## Complete Example

```typescript
import { ZyfaiSDK } from "@zyfai/sdk";

async function startEarningYield(userAddress: string, privateKey: string) {
  const sdk = new ZyfaiSDK({ apiKey: process.env.ZYFAI_API_KEY! });
  const chainId = 8453; // Base
  
  // Connect using the agent's private key
  await sdk.connectAccount(privateKey, chainId);
  
  // Deploy subaccount if needed (always pass EOA as userAddress)
  const wallet = await sdk.getSmartWalletAddress(userAddress, chainId);
  if (!wallet.isDeployed) {
    await sdk.deploySafe(userAddress, chainId, "conservative");
    console.log("Subaccount created:", wallet.address);
  }
  
  // Enable automated optimization
  await sdk.createSessionKey(userAddress, chainId);
  
  // Deposit 100 USDC
  await sdk.depositFunds(userAddress, chainId, "100000000");
  console.log("Deposited! Now earning yield.");
  
  await sdk.disconnectAccount();
}

async function withdrawYield(userAddress: string, privateKey: string, amount?: string) {
  const sdk = new ZyfaiSDK({ apiKey: process.env.ZYFAI_API_KEY! });
  const chainId = 8453; // Base
  
  // Connect using the agent's private key
  await sdk.connectAccount(privateKey, chainId);
  
  // Withdraw funds (pass EOA as userAddress)
  if (amount) {
    // Partial withdrawal
    await sdk.withdrawFunds(userAddress, chainId, amount);
    console.log(`Withdrawn ${amount} (6 decimals) to EOA`);
  } else {
    // Full withdrawal
    await sdk.withdrawFunds(userAddress, chainId);
    console.log("Withdrawn all funds to EOA");
  }
  
  await sdk.disconnectAccount();
}
```

## API Reference

| Method | Params | Description |
|--------|--------|-------------|
| `connectAccount` | `(privateKey, chainId)` | Authenticate with Zyfai |
| `getSmartWalletAddress` | `(userAddress, chainId)` | Get subaccount address & status |
| `deploySafe` | `(userAddress, chainId, strategy)` | Create subaccount |
| `createSessionKey` | `(userAddress, chainId)` | Enable auto-optimization |
| `depositFunds` | `(userAddress, chainId, amount)` | Deposit USDC (6 decimals) |
| `withdrawFunds` | `(userAddress, chainId, amount?)` | Withdraw (all if no amount) |
| `getPositions` | `(userAddress, chainId?)` | Get active DeFi positions |
| `getAvailableProtocols` | `(chainId)` | Get available protocols & pools |
| `getAPYPerStrategy` | `(crossChain?, days?, strategyType?)` | Get APY for conservative/aggressive strategies |
| `getUserDetails` | `()` | Get authenticated user details |
| `getOnchainEarnings` | `(walletAddress)` | Get earnings data |
| `registerAgentOnIdentityRegistry` | `(smartWallet, chainId)` | Register agent on ERC-8004 Identity Registry |
| `disconnectAccount` | `()` | End session |

**Note:** All methods that take `userAddress` expect the **EOA address**, not the subaccount/Safe address.

## Data Methods

### getPositions

Get all active DeFi positions for a user across protocols. Optionally filter by chain.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| userAddress | string | ✅ | User's EOA address |
| chainId | SupportedChainId | ❌ | Optional: Filter by specific chain ID |

**Example:**

```typescript
// Get all positions across all chains
const positions = await sdk.getPositions("0xUser...");

// Get positions on Arbitrum only
const arbPositions = await sdk.getPositions("0xUser...", 42161);
```

**Returns:**

```typescript
interface PositionsResponse {
  success: boolean;
  userAddress: string;
  positions: Position[];
}
```

### getAvailableProtocols

Get available DeFi protocols and pools for a specific chain with APY data.

```typescript
const protocols = await sdk.getAvailableProtocols(42161); // Arbitrum

protocols.protocols.forEach((protocol) => {
  console.log(`${protocol.name} (ID: ${protocol.id})`);
  if (protocol.pools) {
    protocol.pools.forEach((pool) => {
      console.log(`  Pool: ${pool.name} - APY: ${pool.apy || "N/A"}%`);
    });
  }
});
```

Returns:
```typescript
interface ProtocolsResponse {
  success: boolean;
  chainId: SupportedChainId;
  protocols: Protocol[];
}
```

### getUserDetails

Get current authenticated user details including smart wallet, chains, protocols, and settings. Requires SIWE authentication.

```typescript
await sdk.connectAccount(privateKey, chainId);
const user = await sdk.getUserDetails();

console.log("Smart Wallet:", user.user.smartWallet);
console.log("Chains:", user.user.chains);
console.log("Has Active Session:", user.user.hasActiveSessionKey);
```

Returns:
```typescript
interface UserDetailsResponse {
  success: boolean;
  user: {
    id: string;
    address: string;
    smartWallet?: string;
    chains: number[];
    protocols: Protocol[];
    hasActiveSessionKey: boolean;
    email?: string;
    strategy?: string;
    telegramId?: string;
    walletType?: string;
    autoSelectProtocols: boolean;
    autocompounding?: boolean;
    omniAccount?: boolean;
    crosschainStrategy?: boolean;
    agentName?: string;
    customization?: Record<string, string[]>;
  };
}
```

### getAPYPerStrategy

Get global APY by strategy type (conservative or aggressive), time period, and chain configuration. Use this to compare expected returns between strategies before deploying.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| crossChain | boolean | ❌ | If `true`, returns APY for cross-chain strategies; if `false`, single-chain |
| days | number | ❌ | Period over which APY is calculated. One of `7`, `15`, `30`, `60` |
| strategyType | string | ❌ | Strategy risk profile. One of `'conservative'` or `'aggressive'` |

**Example:**

```typescript
// Get 7-day APY for conservative single-chain strategy
const conservativeApy = await sdk.getAPYPerStrategy(false, 7, 'conservative');
console.log("Conservative APY:", conservativeApy.data);

// Get 30-day APY for aggressive cross-chain strategy
const aggressiveApy = await sdk.getAPYPerStrategy(true, 30, 'aggressive');
console.log("Aggressive APY:", aggressiveApy.data);

// Compare strategies
const conservative = await sdk.getAPYPerStrategy(false, 30, 'conservative');
const aggressive = await sdk.getAPYPerStrategy(false, 30, 'aggressive');
console.log(`Conservative 30d APY: ${conservative.data[0]?.apy}%`);
console.log(`Aggressive 30d APY: ${aggressive.data[0]?.apy}%`);
```

**Returns:**

```typescript
interface APYPerStrategyResponse {
  success: boolean;
  count: number;
  data: APYPerStrategy[];
}

interface APYPerStrategy {
  strategyType: string;
  apy: number;
  period: number;
  crossChain: boolean;
}
```

### getOnchainEarnings

Get onchain earnings for a wallet including total, current, and lifetime earnings.

```typescript
const earnings = await sdk.getOnchainEarnings(smartWalletAddress);

console.log("Total earnings:", earnings.data.totalEarnings);
console.log("Current earnings:", earnings.data.currentEarnings);
console.log("Lifetime earnings:", earnings.data.lifetimeEarnings);
```

Returns:
```typescript
interface OnchainEarningsResponse {
  success: boolean;
  data: {
    walletAddress: string;
    totalEarnings: number;
    currentEarnings: number;
    lifetimeEarnings: number;
    unrealizedEarnings?: number;
    currentEarningsByChain?: Record<string, number>;
    unrealizedEarningsByChain?: Record<string, number>;
    lastCheckTimestamp?: string;
  };
}
```

### registerAgentOnIdentityRegistry (ERC-8004)

Register your Zyfai deployed agent on the Identity Registry following the ERC-8004 standard. This is used for OpenClaw agent registration. The method fetches a tokenUri containing the agent's metadata stored on IPFS, then registers it on-chain.

**Supported Chains:**

| Chain | Chain ID |
|-------|----------|
| Base | 8453 |
| Arbitrum | 42161 |

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| smartWallet | string | ✅ | The Zyfai deployed smart wallet address to register as an agent |
| chainId | SupportedChainId | ✅ | Chain ID (only 8453 or 42161) |

**Example:**

```typescript
const sdk = new ZyfaiSDK({ apiKey: "your-api-key" });
await sdk.connectAccount(privateKey, 8453);

// Get smart wallet address
const walletInfo = await sdk.getSmartWalletAddress(userAddress, 8453);
const smartWallet = walletInfo.address;

// Register agent on Identity Registry
const result = await sdk.registerAgentOnIdentityRegistry(smartWallet, 8453);

console.log("Registration successful:");
console.log("  Tx Hash:", result.txHash);
console.log("  Chain ID:", result.chainId);
console.log("  Smart Wallet:", result.smartWallet);
```

**Returns:**

```typescript
interface RegisterAgentResponse {
  success: boolean;
  txHash: string;
  chainId: number;
  smartWallet: string;
}
```

**How It Works:**

1. Fetches a `tokenUri` from the Zyfai API (agent metadata stored on IPFS)
2. Encodes the `register(tokenUri)` call for the Identity Registry contract
3. Sends the transaction from the connected wallet
4. Waits for on-chain confirmation

## Security

- **Non-custodial** — User's EOA owns the subaccount
- **Session keys are limited** — Can rebalance, cannot withdraw elsewhere
- **Deterministic** — Same EOA = same subaccount on every chain

## Troubleshooting

### Subaccount address mismatch across chains

The subaccount address should be **identical** across all chains for the same EOA. If you see different addresses:

```typescript
// Check addresses on both chains
const baseWallet = await sdk.getSmartWalletAddress(userAddress, 8453);
const arbWallet = await sdk.getSmartWalletAddress(userAddress, 42161);

if (baseWallet.address !== arbWallet.address) {
  console.error("Address mismatch! Contact support.");
}
```

**If addresses don't match:**
1. Try redeploying on the affected chain
2. If the issue persists, contact support on Telegram: [@paul_zyfai](https://t.me/paul_zyfai)

### "Deposit address not found" error

This means the wallet isn't registered in the backend. Solution:
1. Call `deploySafe()` first — even if the Safe is already deployed on-chain, this registers it with the backend
2. Then retry `createSessionKey()`

### "Invalid signature" error

This typically means:
- The private key doesn't match the EOA you're passing
- The Safe address on-chain doesn't match what the SDK expects

Verify you're using the correct private key for the EOA.

## Resources

- Get API Key: [sdk.zyf.ai](https://sdk.zyf.ai)
- Docs: [docs.zyf.ai](https://docs.zyf.ai)
- Demo: [github.com/ondefy/zyfai-sdk-demo](https://github.com/ondefy/zyfai-sdk-demo)
