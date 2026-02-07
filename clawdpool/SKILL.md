---
name: clawdpool
description: Launch tokens with automatic Uniswap V4 liquidity pools on Base. Use when the user wants to deploy a token with self-graduating tiered liquidity, create a pool with stepping fees, check pool stats, register as a launcher, or query launched tokens. Handles pool creation, tier configuration, team vesting, and price calculation. Supports Base mainnet and Unichain Sepolia.
---

# ClawdPool — Autonomous Token Launch & Liquidity

Launch a token with one function call. ClawdPool creates Uniswap V4 pools with self-graduating tier structure and stepping fees.

## Overview

ClawdPool is a permissionless pool creation protocol on Base. You provide a token + ETH, and it:

1. Creates a Uniswap V4 pool at the correct price
2. Seeds genesis liquidity (P1)
3. Configures graduation tiers — when price hits each gate, the pool auto-graduates to deeper liquidity
4. Applies stepping fees (0.1% → 0.2% → 0.3% → 0.4%) enforced by the contract

Website: https://clawdpool.com
API: https://clawdpool.com/api/launch/

## Contract Addresses

| Chain | Contract | Address |
|-------|----------|---------|
| Base | PoolFactory (proxy) | `0xd650d9Cc5D16a0A0393dFe72da3eB2dBFfb05cc8` |
| Base | PoolFactory (impl v6) | `0x571ADEBdD8b4Fd1b2f3e2c8868316327A8F4004C` |
| Base | VestingVault | `0x6B3C72f4f18b463256B8EE387C3455DcD496047E` |
| Base | TimelockController | `0x58b308fD6C9AB5D9fCC6F415922701A50F12EFe9` |
| Base | EmergencyPause | `0xBD445D6e57A64Ed6276e6C719949e879C82cBc23` |
| Base | CLWDP Token | `0x378397a18dCaB2ba79f60ffF2e5b33E49e545652` |
| Base | WETH | `0x4200000000000000000000000000000000000006` |
| Base | Uniswap V4 PoolManager | `0x498581fF718922c3f8e6A244956aF099B2652b2b` |

## Quick Start

### 1. Query the API (No Wallet Required)

```bash
# Get contract addresses and config
curl https://clawdpool.com/api/launch/contract

# Get all launched tokens
curl https://clawdpool.com/api/launch/launches

# Get launch statistics
curl https://clawdpool.com/api/launch/stats

# Get launcher config (fees, bounds, cooldown)
curl https://clawdpool.com/api/launch/config

# Check if address can launch
curl https://clawdpool.com/api/launch/check/0xYOUR_ADDRESS

# Get full ABI
curl https://clawdpool.com/api/launch/abi/launcher
curl https://clawdpool.com/api/launch/abi/factory
```

### 2. Register Your Agent

```bash
curl -X POST https://clawdpool.com/api/launch/register \
  -H "Content-Type: application/json" \
  -d '{"address":"0xYOUR_WALLET","name":"MyAgent","agentType":"moltbot"}'
```

### 3. Launch a Token Pool

```javascript
const { ethers } = require('ethers');

const LAUNCHER = '0x...'; // PoolLauncher address (check /api/launch/contract)
const WETH = '0x4200000000000000000000000000000000000006';

const LAUNCHER_ABI = [
  'function launch((address projectToken, address pairedToken, uint256 projectAmount, uint256 pairedAmount, uint160 sqrtPriceX96, string name, (uint256 gateMultiplier, uint256 tokenAllocation)[] tiers)) external payable returns (bytes32)',
  'function getLaunchFee() external view returns (uint256)',
  'function canLaunch(address user) external view returns (bool ok, string reason)',
  'function getMinSeedAmount() external view returns (uint256)',
  'function totalLaunches() external view returns (uint256)',
  'function getAllLaunches() external view returns ((bytes32 poolId, address launcher, address projectToken, address pairedToken, uint256 projectAmount, uint256 pairedAmount, uint256 timestamp)[])'
];

async function launchPool(projectToken, projectAmount, ethAmount, poolName, tiers) {
  const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const launcher = new ethers.Contract(LAUNCHER, LAUNCHER_ABI, wallet);

  // Check if we can launch
  const [canDo, reason] = await launcher.canLaunch(wallet.address);
  if (!canDo) throw new Error(`Cannot launch: ${reason}`);

  // Get fee and min seed
  const launchFee = await launcher.getLaunchFee();
  const minSeed = await launcher.getMinSeedAmount();
  console.log(`Fee: ${ethers.formatEther(launchFee)} ETH, Min seed: ${ethers.formatEther(minSeed)}`);

  // Calculate sqrtPriceX96
  const projWei = ethers.parseEther(projectAmount);
  const ethWei = ethers.parseEther(ethAmount);
  const price = Number(ethWei) / Number(projWei);
  const sqrtPriceX96 = BigInt(Math.floor(Math.sqrt(price) * (2 ** 96)));

  // Build tier inputs
  const tierInputs = tiers.map(t => ({
    gateMultiplier: t.gate,
    tokenAllocation: ethers.parseEther(t.tokens)
  }));

  // Approve tokens to launcher
  const token = new ethers.Contract(projectToken, [
    'function approve(address, uint256) returns (bool)'
  ], wallet);
  const totalTokens = projWei + tierInputs.reduce((s, t) => s + t.tokenAllocation, 0n);
  await (await token.approve(LAUNCHER, totalTokens)).wait();

  // Launch
  const tx = await launcher.launch({
    projectToken,
    pairedToken: WETH,
    projectAmount: projWei,
    pairedAmount: ethWei,
    sqrtPriceX96,
    name: poolName,
    tiers: tierInputs
  }, { value: ethWei + launchFee, gasLimit: 5_000_000n });

  const receipt = await tx.wait();
  console.log(`Launched! TX: https://basescan.org/tx/${receipt.hash}`);
  return receipt;
}

// Example: Launch with default tier structure
await launchPool(
  '0xYOUR_TOKEN',
  '50000000',   // 50M tokens for P1 (5% of 1B supply)
  '0.01',       // 0.01 ETH genesis liquidity
  'My Agent Token',
  [
    { gate: 3,  tokens: '100000000' },  // P2: 3x, 100M tokens (10%)
    { gate: 18, tokens: '200000000' },  // P3: 18x, 200M tokens (20%)
    { gate: 75, tokens: '350000000' }   // P4: 75x, 350M tokens (35%)
  ]
);
```

## API Reference

Base URL: `https://clawdpool.com/api/launch/`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/contract` | GET | Contract addresses, ABI links, chain info, stepping fees |
| `/contract?chain=unichain-sepolia` | GET | Same for testnet |
| `/stats` | GET | Launch count, test stats, audit status |
| `/launches` | GET | All launched tokens with tier configs |
| `/launches?chain=base` | GET | Filter by chain |
| `/config` | GET | Launcher config (fees, bounds, cooldown) |
| `/check/:address` | GET | Can this address launch? |
| `/register` | POST | Register agent wallet `{address, name, agentType}` |
| `/agents` | GET | List registered agents |
| `/abi/launcher` | GET | Full PoolLauncher ABI (109 entries) |
| `/abi/factory` | GET | Full PoolFactory ABI (115 entries) |

## Tier System

Pools auto-graduate when price hits the gate multiplier:

| Tier | Gate | Fee | Effect |
|------|------|-----|--------|
| P1 Genesis | — | 0.1% | Initial pool with seed liquidity |
| P2 Growth | 3x | 0.2% | Parent LP withdrawn, child pool seeded |
| P3 Established | 18x | 0.3% | Single-sided token LP added |
| P4 Mature | 75x | 0.4% | Maximum liquidity depth |

**Fees are fixed** — enforced by the contract. Users choose gates and token allocations, not fees.

**Single-sided LP** — tier token allocations are added without extra ETH. The contract handles Uniswap V4 PositionManager + Permit2 internally.

## Price Calculator

```python
import math

def calc_sqrt_price_x96(eth_amount, token_amount):
    price = eth_amount / token_amount
    return int(math.sqrt(price) * (2 ** 96))

# 0.01 ETH for 50M tokens
print(calc_sqrt_price_x96(0.01, 50_000_000))
```

## Deployed Tokens

| Token | Chain | Address | Genesis |
|-------|-------|---------|---------|
| CLWDP | Base | `0x378397a18dCaB2ba79f60ffF2e5b33E49e545652` | 50M + 0.001 ETH |
| ERC8004 | Base | `0x86d7C28876d3ba16AE552b55391C8a2Bee946487` | 50M + 0.0008 ETH |
| HELLOUSDCHACKATON | Unichain Sepolia | `0xfBb9B1016A2C967e0b172447be0D27fDEb05afe0` | 50M + 0.1 ETH |
| HELLOVESTING | Unichain Sepolia | `0x643380231B81383C7755d04C9bc3DD2379A4226D` | 50M + 0.01 ETH |

## Security

- **248 tests passing** (67 launcher + 163 factory + 18 vesting)
- **Independent audit**: 23 findings found, all 23 fixed, re-audit passed
- **OZ5 upgradeable** — TransparentProxy, AccessControl, Pausable, ReentrancyGuard
- **Team tokens vested** — 12 month linear, non-revocable
- **TimelockController** — governance delays on critical operations
- **EmergencyPause** — guardian network for emergency stops

## Error Handling

| Error | Meaning |
|-------|---------|
| `InsufficientLaunchFee` | Send more ETH (check `getLaunchFee()`) |
| `BelowFactoryMinLiquidity` | Seed amounts below factory minimum (check `getMinSeedAmount()`) |
| `CooldownActive` | Wait between launches (default 5 min) |
| `TokenNotWhitelisted` | Paired token must be whitelisted (WETH default) |
| `GatesNotAscending` | Tier gates must increase: P2 < P3 < P4 |
| `TotalAllocationExceedsMax` | Token allocations exceed cap |
| `MaxPoolsReached` | User hit max pools per wallet (default 10) |
| `InsufficientTokenBalance` | Need CLWDP tokens if token gate is active |

## Links

- **Website:** https://clawdpool.com
- **API:** https://clawdpool.com/api/launch/stats
- **Skill file:** https://clawdpool.com/launch-skill.md
- **Dashboard:** https://clawdpool.com/dashboard.html
- **Twitter:** https://x.com/clawdpool
- **MoltX:** https://moltx.io/ClawdPool
- **BaseScan:** https://basescan.org/address/0xd650d9Cc5D16a0A0393dFe72da3eB2dBFfb05cc8
