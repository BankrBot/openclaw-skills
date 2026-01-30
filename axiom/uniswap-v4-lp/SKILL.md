---
name: uniswap-v4-lp
description: Manage Uniswap V4 LP positions on Base. Add, remove, and monitor concentrated liquidity positions.
triggers:
  - uniswap
  - v4
  - liquidity
  - LP position
  - add liquidity
  - remove liquidity
version: 0.1.0
author: Axiom (@AxiomBot)
license: MIT
chain: base
---

# Uniswap V4 LP Skill

Manage concentrated liquidity positions on Uniswap V4 (Base chain).

## Features

- Add liquidity to V4 pools
- Remove liquidity / collect fees
- Monitor position health
- Rebalance when out of range
- **Auto-compound** fees back into liquidity (set-and-forget)

## Requirements

- Private key in environment (`PRIVATE_KEY` or `NET_PRIVATE_KEY`)
- Node.js 18+
- viem package

## Quick Start

```bash
# Install dependencies
cd scripts && npm install

# Add liquidity ($20 test position)
node add-liquidity.mjs --amount 20 --range 25

# Check position
node check-position.mjs --token-id <ID>

# Monitor if in range
node monitor-position.mjs --token-id <ID>

# Collect fees (without removing liquidity)
node collect-fees.mjs --token-id <ID>

# Auto-compound fees → liquidity
# Two strategies: DOLLAR (default) or TIME

# Dollar strategy: compound when fees exceed $5 (default)
node auto-compound.mjs --token-id <ID>
node auto-compound.mjs --token-id <ID> --min-usd 20       # custom threshold

# Time strategy: compound on schedule (skip only if fees < gas)
node auto-compound.mjs --token-id <ID> --strategy time

# Loop mode: run continuously
node auto-compound.mjs --token-id <ID> --strategy dollar --loop --interval 3600 --min-usd 50
node auto-compound.mjs --token-id <ID> --strategy time --loop --interval 14400

# Preview
node auto-compound.mjs --token-id <ID> --dry-run
# Remove liquidity (partial)
node remove-liquidity.mjs --token-id <ID> --percent 50

# Burn position (100% removal + burn NFT)
node burn-position.mjs --token-id <ID>

# Rebalance (remove + re-add at current price)
node rebalance.mjs --token-id <ID> --range 25
```

## Base Chain Contracts

| Contract | Address |
|----------|---------|
| PoolManager | `0x498581ff718922c3f8e6a244956af099b2652b2b` |
| PositionManager | `0x7c5f5a4bbd8fd63184577525326123b519429bdc` |
| StateView | `0xa3c0c9b65bad0b08107aa264b0f3db444b867a71` |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |

## Security Notes

1. **Always use private mempools** (Flashbots/MEV Blocker) for LP operations
2. **Set reasonable slippage** (1-3% for volatile pairs)
3. **Monitor positions** - rebalance when 80% to range edge
4. **Start small** - test with minimal amounts first

## Pool-Specific: AXIOM/WETH

```javascript
const AXIOM_WETH_POOL = {
  poolId: '0x10a0b8eba9d4e0f772c8c47968ee819bb4609ef4454409157961570cdce9a735',
  token0: '0x4200000000000000000000000000000000000006', // WETH
  token1: '0xf3Ce5dDAAb6C133F9875a4a46C55cf0b58111B07', // AXIOM
  fee: 0x800000, // ⚠️ DYNAMIC_FEE_FLAG - Clanker hook controls fee
  tickSpacing: 200,
  hooks: '0xb429d62f8f3bffb98cdb9569533ea23bf0ba28cc' // Clanker hook
};
```

## ⚠️ Critical: Dynamic Fee Pools

Many V4 pools (especially Clanker-deployed) use **dynamic fees**. The fee in PoolKey is `0x800000` (bit 23 = DYNAMIC_FEE_FLAG), NOT a percentage.

**How to verify:**
```javascript
// Hash your PoolKey and compare to known poolId
const poolId = keccak256(abi.encode(currency0, currency1, fee, tickSpacing, hooks));
```

If your hash doesn't match, check if the pool uses `0x800000` as fee.

## Auto-Compound Strategies

### Dollar Strategy (`--strategy dollar`, default)
Accumulate fees in wallet, only compound when they hit a USD threshold.
Best for: **low-volume pools**, **expensive chains**, or **patient LPs**.

```bash
# Compound when fees reach $50
node auto-compound.mjs --token-id <ID> --strategy dollar --loop --interval 3600 --min-usd 50
```

| Flag | Default | Description |
|------|---------|-------------|
| `--min-usd` | 5 | Min USD fee value to trigger compound |
| `--min-gas-multiple` | 3 | Fees must be ≥ Nx gas cost |
| `--interval` | 3600 | Seconds between checks in loop mode |

### Time Strategy (`--strategy time`)
Compound on a fixed schedule. Skips only if fees < gas cost.
Best for: **high-volume pools** where fees accumulate quickly.

```bash
# Compound every 4 hours
node auto-compound.mjs --token-id <ID> --strategy time --loop --interval 14400
```

| Flag | Default | Description |
|------|---------|-------------|
| `--min-gas-multiple` | 3 | Fees must be ≥ Nx gas cost (safety floor) |
| `--interval` | 3600 | Seconds between compounds in loop mode |

### When to Use Which

| Pool Volume | Strategy | Interval | Min USD |
|-------------|----------|----------|---------|
| >$1M/day | time | 4-6h | n/a |
| $100K-$1M/day | dollar | 1h | $10-25 |
| <$100K/day | dollar | 4h | $50+ |

Both strategies always enforce a gas floor — you'll never burn money on gas.

## Position Strategy Recommendations

For ~$20-1000 positions:
- **Range:** ±25% from current price
- **Rebalance:** When price hits 80% of boundary
- **Check:** Every 4-6 hours
- **Expected APR:** 15-30%
