---
name: clanker
description: Deploy ERC20 tokens using the Clanker protocol on Base and other EVM chains. Supports the official TypeScript SDK for advanced features (airdrop, vesting, rewards, metadata updates) and includes a Base-focused CLI helper for quick deployments.
metadata: {"clawdbot":{"emoji":"🪙","homepage":"https://clanker.world","requires":{"bins":["curl","jq","python3"]}}}
---

# Clanker

Deploy production-ready ERC20 tokens with built-in Uniswap V4 liquidity pools using the Clanker protocol. This skill supports two paths:

1. CLI helper for Base mainnet / Base Sepolia (quick deploy + read-only)
2. TypeScript SDK for multi-chain deployments and advanced features

## Option A: CLI Helper (Base Only)

### Setup

Create a config file at `~/.clawdbot/skills/clanker/config.json`:

```json
{
  "mainnet": {
    "rpc_url": "https://1rpc.io/base",
    "private_key": "YOUR_PRIVATE_KEY"
  },
  "testnet": {
    "rpc_url": "https://sepolia.base.org",
    "private_key": "YOUR_TESTNET_PRIVATE_KEY"
  }
}
```

Security: Never commit private keys to version control. Use environment variables or a config file outside the repo.

### Dependencies

Read-only operations require `curl`, `jq`, and `python3`.

For deployments, install web3:

```bash
pip install web3
```

### Get Testnet ETH (Base Sepolia)

Use a faucet such as:
- https://cloud.base.org/faucet
- https://sepoliafaucet.com

### Commands

Run from the `clanker` skill directory:

```bash
./scripts/clanker.sh deploy "My Token" MYT 0.1
./scripts/clanker.sh status <txhash>
./scripts/clanker.sh info <token-address>
./scripts/clanker.sh get-token <deployer-address>
```

Testnet examples:

```bash
./scripts/clanker.sh testnet-deploy "Test Token" TST
./scripts/clanker.sh status <txhash> --network testnet
./scripts/clanker.sh info <token-address> --network testnet
```

### Test Script

Read-only smoke tests:

```bash
./scripts/test.sh
```

## Option B: TypeScript SDK (Multi-Chain)

Use the SDK for advanced features like vesting, airdrops, rewards configuration, metadata updates, and multi-chain deployment.

### Installation

```bash
npm install clanker-sdk viem
# or
yarn add clanker-sdk viem
# or
pnpm add clanker-sdk viem
```

### Environment Setup

```bash
PRIVATE_KEY=0x...your_private_key_here
```

### Basic Token Deployment

```typescript
import { Clanker } from 'clanker-sdk';
import { createPublicClient, createWalletClient, http, type PublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`;
const account = privateKeyToAccount(PRIVATE_KEY);

const publicClient = createPublicClient({
  chain: base,
  transport: http(),
}) as PublicClient;

const wallet = createWalletClient({
  account,
  chain: base,
  transport: http(),
});

const clanker = new Clanker({ wallet, publicClient });

const { txHash, waitForTransaction, error } = await clanker.deploy({
  name: 'My Token',
  symbol: 'TKN',
  image: 'ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
  tokenAdmin: account.address,
  metadata: {
    description: 'My awesome token',
  },
  context: {
    interface: 'Clanker SDK',
  },
  vanity: true,
});

if (error) throw error;

const { address: tokenAddress } = await waitForTransaction();
console.log('Token deployed at:', tokenAddress);
```

## Core Capabilities (SDK)

Each item below links to a reference file in `references/`.

- Token deployment: `references/deployment.md`
- SDK reference and protocol overview: `references/clanker-sdk.md`
- Vault (token vesting): `references/vesting.md`
- Airdrops: `references/airdrops.md`
- Rewards configuration and fee splits: `references/rewards.md`
- Pool configuration and custom market caps: `references/pool-config.md`
- Troubleshooting: `references/troubleshooting.md`

### Example: Vault (Token Vesting)

```typescript
vault: {
  percentage: 10,           // 10% of token supply
  lockupDuration: 2592000,  // 30 days cliff (in seconds)
  vestingDuration: 2592000, // 30 days linear vesting
  recipient: account.address,
}
```

### Example: Airdrops

```typescript
import { createAirdrop } from 'clanker-sdk/v4/extensions';

const { tree, airdrop } = createAirdrop([
  { account: '0x...', amount: 200_000_000 },
  { account: '0x...', amount: 50_000_000 },
]);
```

### Example: Rewards Configuration

```typescript
rewards: {
  recipients: [
    {
      recipient: account.address,
      admin: account.address,
      bps: 5000,      // 50% of fees
      token: 'Both',  // Receive both tokens
    },
    {
      recipient: '0x...',
      admin: '0x...',
      bps: 5000,      // 50% of fees
      token: 'Both',
    },
  ],
}
```

## Contract Limits and Constants

These values are enforced on-chain in the Clanker contracts and may change. Verify against current SDK docs if unsure.

| Parameter | Value | Notes |
|-----------|-------|-------|
| Token Supply | 100 billion | Fixed at 100,000,000,000 with 18 decimals |
| Max Extension BPS | 9000 (90%) | Max tokens to extensions, min 10% to LP |
| Max Extensions | 10 | Maximum number of extensions per deployment |
| Vault Min Lockup | 7 days | Minimum lockup duration for vesting |
| Airdrop Min Lockup | 1 day | Minimum lockup duration for airdrops |
| Max LP Fee | 10% | Normal trading fee cap |
| Max Sniper Fee | 80% | Maximum MEV/sniper protection fee |
| Sniper Fee Decay | 2 minutes max | Maximum time for sniper fee decay |
| Max Reward Recipients | 7 | Maximum fee distribution recipients |
| Max LP Positions | 7 | Maximum liquidity positions |

## Supported Chains

Clanker SDK supports multiple EVM chains. Verify support in the official docs.

| Chain | Chain ID | Native Token | Status |
|-------|----------|--------------|--------|
| Base | 8453 | ETH | Full support |
| Ethereum | 1 | ETH | Full support |
| Arbitrum | 42161 | ETH | Full support |
| Unichain | - | ETH | Full support |
| Monad | - | MON | Static fees only |

## Post-Deployment Operations

### Claim Vaulted Tokens

```typescript
const claimable = await clanker.getVaultClaimableAmount({ token: TOKEN_ADDRESS });

if (claimable > 0n) {
  const { txHash } = await clanker.claimVaultedTokens({ token: TOKEN_ADDRESS });
}
```

### Collect Trading Rewards

```typescript
// Check available rewards
const availableFees = await clanker.availableRewards({
  token: TOKEN_ADDRESS,
  rewardRecipient: FEE_OWNER_ADDRESS,
});

// Claim rewards
const { txHash } = await clanker.claimRewards({
  token: TOKEN_ADDRESS,
  rewardRecipient: FEE_OWNER_ADDRESS,
});
```

### Update Token Metadata

```typescript
const metadata = JSON.stringify({
  description: 'Updated description',
  socialMediaUrls: [
    { platform: 'twitter', url: 'https://twitter.com/mytoken' },
    { platform: 'telegram', url: 'https://t.me/mytoken' },
  ],
});

const { txHash } = await clanker.updateMetadata({
  token: TOKEN_ADDRESS,
  metadata,
});
```

### Update Token Image

```typescript
const { txHash } = await clanker.updateImage({
  token: TOKEN_ADDRESS,
  image: 'ipfs://new_image_hash',
});
```

## Common Workflows

### Simple Memecoin Launch

1. Prepare token image (upload to IPFS)
2. Deploy with basic config (name, symbol, image)
3. Enable vanity address for memorable contract
4. Share contract address

### Community Token with Airdrop

1. Compile airdrop recipient list
2. Create Merkle tree with `createAirdrop()`
3. Deploy token with airdrop extension
4. Register airdrop with Clanker service
5. Share claim instructions

### Creator Token with Vesting

1. Deploy with vault configuration
2. Set lockup period (cliff)
3. Set vesting duration
4. Claim tokens as they vest

## Full Deployment Config

```typescript
// Bankr interface fee recipient (20%)
const BANKR_INTERFACE_ADDRESS = '0xF60633D02690e2A15A54AB919925F3d038Df163e';

const tokenConfig = {
  chainId: 8453,                    // Base
  name: 'My Token',
  symbol: 'TKN',
  image: 'ipfs://...',
  tokenAdmin: account.address,
  
  metadata: {
    description: 'Token description',
    socialMediaUrls: [
      { platform: 'twitter', url: '...' },
      { platform: 'telegram', url: '...' },
    ],
  },
  
  context: {
    interface: 'Bankr',
    platform: 'farcaster',
    messageId: '',
    id: '',
  },
  
  vault: {
    percentage: 10,
    lockupDuration: 2592000,
    vestingDuration: 2592000,
    recipient: account.address,
  },
  
  devBuy: {
    ethAmount: 0,
    recipient: account.address,
  },
  
  // Default: 80% creator, 20% Bankr interface (all in paired token)
  rewards: {
    recipients: [
      { 
        recipient: account.address,
        admin: account.address,
        bps: 8000,  // 80% to creator
        token: 'Paired',  // Receive paired token (WETH)
      },
      { 
        recipient: BANKR_INTERFACE_ADDRESS,
        admin: BANKR_INTERFACE_ADDRESS,
        bps: 2000,  // 20% to Bankr
        token: 'Paired',  // Receive paired token (WETH)
      },
    ],
  },
  
  pool: {
    pairedToken: '0x4200000000000000000000000000000000000006', // WETH
    positions: 'Standard',
  },
  
  fees: 'StaticBasic',
  vanity: true,
  
  sniperFees: {
    startingFee: 666_777,
    endingFee: 41_673,
    secondsToDecay: 15,
  },
};
```

## Best Practices

### Security

1. **Never expose private keys** - Use environment variables
2. **Test on testnet first** - Verify configs before mainnet
3. **Simulate transactions** - Use `*Simulate` methods before execution
4. **Verify addresses** - Double-check all recipient addresses

### Token Design

1. **Choose meaningful names** - Clear, memorable token identity
2. **Use quality images** - High-res, appropriate IPFS images
3. **Configure vesting wisely** - Align with project timeline

### Gas Optimization

1. **Use Base or Arbitrum** - Lower gas fees
2. **Batch operations** - Combine when possible
3. **Monitor gas prices** - Deploy during low-traffic periods

## Troubleshooting

### Common Issues

- **\"Missing PRIVATE_KEY\"** - Set environment variable
- **\"Insufficient balance\"** - Fund wallet with native token
- **\"Transaction reverted\"** - Check parameters, simulate first
- **\"Invalid image\"** - Ensure IPFS hash is accessible

### Debug Steps

1. Check wallet balance
2. Verify chain configuration
3. Use simulation methods
4. Check transaction on block explorer
5. Review error message details

## Resources

- https://clanker.world
- https://docs.clanker.world
- https://github.com/clanker-world
- https://basescan.org
- https://sepolia.basescan.org
- https://github.com/clanker-devco/clanker-sdk
- https://www.npmjs.com/package/clanker-sdk
- https://github.com/clanker-devco/clanker-sdk/tree/main/examples/v4

Pro Tip: Always use the `vanity: true` option for memorable contract addresses.

Security: Never commit private keys. Use `.env` files and add them to `.gitignore`.

Quick Win: Start with the simple deployment example, then add features like vesting and rewards as needed.
