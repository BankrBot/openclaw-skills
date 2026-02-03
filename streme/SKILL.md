---
name: streme-launcher
description: Launch tokens on Streme (streme.fun) - streaming SuperTokens on Base with built-in staking and Uniswap V3 LP.
---

# Streme Token Launcher

Deploy SuperTokens on Base. Tokens get Uniswap V3 liquidity + optional Superfluid streaming staking.

## Requirements

- **viem** (`npm install viem`) — EVM interactions
- **Image URL** (optional) — Any public URL (IPFS, Cloudinary, imgBB, etc). PNG/JPG/WebP, <1MB, 400×400 ideal. Pass empty string `''` to skip.

## Contracts (Base Mainnet)

```typescript
const CONTRACTS = {
  DEPLOYER: '0x8712F62B3A2EeBA956508e17335368272f162748',
  TOKEN_FACTORY: '0xB973FDd29c99da91CAb7152EF2e82090507A1ce9',
  ALLOCATION_HOOK: '0xC907788f3e71a6eC916ba76A9f1a7C7C19384c7B',
  LP_FACTORY: '0xfF65a5f74798EebF87C8FdFc4e56a71B511aB5C8',
  MAIN_STREME: '0x5797a398fe34260f81be65908da364cc18fbc360',
  WETH: '0x4200000000000000000000000000000000000006',
} as const;
```

## ABI (minimal)

```typescript
const DEPLOY_ABI = [{
  name: 'generateSalt', type: 'function', stateMutability: 'view',
  inputs: [{ name: '_symbol', type: 'string' }, { name: '_requestor', type: 'address' },
           { name: '_tokenFactory', type: 'address' }, { name: '_pairedToken', type: 'address' }],
  outputs: [{ name: 'salt', type: 'bytes32' }, { name: 'token', type: 'address' }]
}, {
  name: 'deployWithAllocations', type: 'function', stateMutability: 'payable',
  inputs: [
    { name: 'tokenFactory', type: 'address' }, { name: 'postDeployHook', type: 'address' },
    { name: 'liquidityFactory', type: 'address' }, { name: 'postLPHook', type: 'address' },
    { name: 'preSaleTokenConfig', type: 'tuple', components: [
      { name: '_name', type: 'string' }, { name: '_symbol', type: 'string' },
      { name: '_supply', type: 'uint256' }, { name: '_fee', type: 'uint24' },
      { name: '_salt', type: 'bytes32' }, { name: '_deployer', type: 'address' },
      { name: '_fid', type: 'uint256' }, { name: '_image', type: 'string' },
      { name: '_castHash', type: 'string' },
      { name: '_poolConfig', type: 'tuple', components: [
        { name: 'tick', type: 'int24' }, { name: 'pairedToken', type: 'address' }, { name: 'devBuyFee', type: 'uint24' }
      ]}
    ]},
    { name: 'allocationConfigs', type: 'tuple[]', components: [
      { name: 'allocationType', type: 'uint8' }, { name: 'admin', type: 'address' },
      { name: 'percentage', type: 'uint256' }, { name: 'data', type: 'bytes' }
    ]}
  ],
  outputs: [{ name: 'token', type: 'address' }, { name: 'liquidityId', type: 'uint256' }]
}] as const;
```

## Allocation Helpers

```typescript
import { encodeAbiParameters } from 'viem';

// Staking: streams rewards to stakers over flowDays (lockDays minimum hold)
function createStakingAllocation(pct: number, lockDays: number, flowDays: number) {
  return {
    allocationType: 1, admin: '0x0000000000000000000000000000000000000000',
    percentage: BigInt(pct),
    data: encodeAbiParameters([{ type: 'uint256' }, { type: 'int96' }],
      [BigInt(lockDays * 86400), BigInt(flowDays * 86400)])
  };
}

// Vault: locked tokens with optional vesting (min 7 day lock)
function createVaultAllocation(pct: number, beneficiary: string, lockDays: number, vestDays: number) {
  return {
    allocationType: 0, admin: beneficiary, percentage: BigInt(pct),
    data: encodeAbiParameters([{ type: 'uint256' }, { type: 'uint256' }],
      [BigInt(Math.max(lockDays, 7) * 86400), BigInt(vestDays * 86400)])
  };
}
```

## Full Deployment

```typescript
import { createPublicClient, createWalletClient, http, parseEther } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const account = privateKeyToAccount(PRIVATE_KEY);
const publicClient = createPublicClient({ chain: base, transport: http() });
const walletClient = createWalletClient({ account, chain: base, transport: http() });

// 1. Generate salt
const [salt, predictedToken] = await publicClient.readContract({
  address: CONTRACTS.MAIN_STREME, abi: DEPLOY_ABI, functionName: 'generateSalt',
  args: ['MYTOKEN', account.address, CONTRACTS.TOKEN_FACTORY, CONTRACTS.WETH]
});

// 2. Build config
const tokenConfig = {
  _name: 'My Token', _symbol: 'MYTOKEN', _supply: parseEther('100000000000'),
  _fee: 10000, _salt: salt, _deployer: account.address, _fid: 0n,
  _image: 'https://example.com/token.png', // or '' for no image
  _castHash: 'deployment',
  _poolConfig: { tick: -230400, pairedToken: CONTRACTS.WETH, devBuyFee: 10000 }
};

// 3. Deploy with 10% staking
const hash = await walletClient.writeContract({
  address: CONTRACTS.DEPLOYER, abi: DEPLOY_ABI, functionName: 'deployWithAllocations',
  args: [
    CONTRACTS.TOKEN_FACTORY, CONTRACTS.ALLOCATION_HOOK, CONTRACTS.LP_FACTORY,
    '0x0000000000000000000000000000000000000000', tokenConfig,
    [createStakingAllocation(10, 1, 365)]
  ]
});

const receipt = await publicClient.waitForTransactionReceipt({ hash });
console.log(`Token: ${predictedToken} | TX: https://basescan.org/tx/${hash}`);
```

## Defaults

| Param | Value |
|-------|-------|
| Supply | 100B |
| Creator Fee | 10% |
| Tick | -230400 |
| Standard | 10% staking (1d lock, 365d stream), 90% LP |

## Common Patterns

```typescript
// Standard: 10% staking, 90% LP
[createStakingAllocation(10, 1, 365)]

// With team vest: 10% staking, 10% team (30d lock, 1yr vest), 80% LP
[createStakingAllocation(10, 1, 365), createVaultAllocation(10, teamAddr, 30, 365)]

// Max LP: 100% liquidity, no allocations
[]
```

## API

```
GET https://api.streme.fun/api/tokens/deployer/{addr}
GET https://api.streme.fun/api/tokens/{addr}
```
