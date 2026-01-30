---
name: uniswap-v4-lp
description: Manage Uniswap V4 LP positions on Base. Add, remove, monitor, auto-compound, and harvest fees — including Clanker protocol fee claims.
triggers:
  - uniswap
  - v4
  - liquidity
  - LP position
  - add liquidity
  - remove liquidity
  - clanker
  - harvest
  - compound
  - claim fees
version: 0.2.0
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

# Compound & Harvest: split fees — compound some, harvest rest as USDC
node compound-and-harvest.mjs --token-id <ID> \
  --harvest-address 0xYOUR_ADDRESS --compound-pct 50
node compound-and-harvest.mjs --token-id <ID> \
  --harvest-address 0xYOUR_ADDRESS --compound-pct 70 --slippage 3
node compound-and-harvest.mjs --token-id <ID> \
  --harvest-address 0xYOUR_ADDRESS --dry-run

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

## Compound & Harvest

Split LP fees: compound a percentage back into the position and harvest the rest as USDC.

### How It Works

1. **Collect** all accrued fees (DECREASE_LIQUIDITY with 0 + CLOSE_CURRENCY)
2. **Split** fees by compound-pct (default 50/50)
3. **Compound** the compound portion back into the position (INCREASE_LIQUIDITY + SETTLE_PAIR)
4. **Swap** the harvest portion of both tokens to USDC via Uniswap V3 SwapRouter02
   - WETH → USDC direct (0.05% pool)
   - Meme tokens → WETH → USDC multi-hop (tries 1%, 0.3%, 0.05% fee tiers)
5. **Transfer** all USDC to the harvest address

### Usage

```bash
# Preview (dry run)
node compound-and-harvest.mjs --token-id 1078751 \
  --harvest-address 0xcbC7E8A39A0Ec84d6B0e8e0dd98655F348ECD44F --dry-run

# 50/50 split (default)
node compound-and-harvest.mjs --token-id 1078751 \
  --harvest-address 0xcbC7E8A39A0Ec84d6B0e8e0dd98655F348ECD44F

# 70% compound, 30% harvest
node compound-and-harvest.mjs --token-id 1078751 \
  --harvest-address 0xcbC7E8A39A0Ec84d6B0e8e0dd98655F348ECD44F \
  --compound-pct 70

# 100% harvest (take all fees as USDC, no compounding)
node compound-and-harvest.mjs --token-id 1078751 \
  --harvest-address 0xcbC7E8A39A0Ec84d6B0e8e0dd98655F348ECD44F \
  --compound-pct 0

# Custom slippage
node compound-and-harvest.mjs --token-id 1078751 \
  --harvest-address 0xcbC7E8A39A0Ec84d6B0e8e0dd98655F348ECD44F \
  --slippage 3
```

### Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--token-id` | required | LP NFT token ID |
| `--harvest-address` | required | Address to receive harvested USDC |
| `--compound-pct` | 50 | Percentage to compound (0-100) |
| `--slippage` | 1 | Slippage tolerance for swaps (%) |
| `--dry-run` | false | Preview without executing |
| `--rpc` | env/default | Base RPC URL |

### Swap Routing

- Uses **Uniswap V3 SwapRouter02** (`0x2626664c2603336E57B271c5C0b26F421741e481`)
- WETH → USDC: `exactInputSingle` with 500 (0.05%) fee tier
- Other tokens → USDC: `exactInput` multi-hop through WETH, auto-tries fee tiers 10000/3000/500

## 🌾 Clanker Harvest — Full Treasury Pipeline

The killer feature: a complete fee management pipeline for **any Clanker-launched token**.

Clanker tokens have two fee sources:
1. **Clanker protocol fees** — stored in a separate fee contract, must be claimed
2. **LP position fees** — accrued in the V4 position, collected via DECREASE

`clanker-harvest.mjs` handles both in a single modular pipeline.

### Quick Start

```bash
# Just claim Clanker protocol fees (no LP, no swap)
node clanker-harvest.mjs --token 0xTOKEN

# Claim + compound 100% into LP
node clanker-harvest.mjs --token 0xTOKEN --token-id 12345 --compound-pct 100

# Claim + harvest 100% as USDC to vault
node clanker-harvest.mjs --token 0xTOKEN --harvest-address 0xVAULT --compound-pct 0

# 50/50 split — compound half, harvest half
node clanker-harvest.mjs --token 0xTOKEN --token-id 12345 \
  --harvest-address 0xVAULT --compound-pct 50

# 80% compound / 20% harvest, only if fees > $10
node clanker-harvest.mjs --token 0xTOKEN --token-id 12345 \
  --harvest-address 0xVAULT --compound-pct 80 --min-usd 10

# Use a config file (perfect for cron)
node clanker-harvest.mjs --config harvest-config.json
```

### Pipeline Steps

| Step | What | When |
|------|------|------|
| 1. Claim | Claim WETH + token from Clanker fee contract | Always (unless `--skip-claim`) |
| 2. Collect LP | Collect accrued fees from V4 position | If `--token-id` set (unless `--skip-lp`) |
| 3. Threshold | Check total USD value against `--min-usd` | If threshold set |
| 4. Compound | Add X% back into LP position | If `--compound-pct` > 0 and `--token-id` set |
| 5. Swap | Swap remaining WETH to USDC | If `--compound-pct` < 100 and `--harvest-address` set |
| 6. Transfer | Send USDC to vault address | If USDC was swapped |

### Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--token` | required | Clanker token address |
| `--token-id` | optional | V4 LP position NFT ID (needed for compound/LP) |
| `--harvest-address` | optional | Vault address for USDC (needed for harvest) |
| `--compound-pct` | 100 | % to compound back (0 = all harvest, 100 = all compound) |
| `--min-usd` | 0 | Min USD fee value to act (0 = always) |
| `--slippage` | 1 | Swap slippage % |
| `--fee-contract` | 0xf362... | Clanker fee storage contract |
| `--skip-claim` | false | Skip Clanker fee claim |
| `--skip-lp` | false | Skip LP fee collection |
| `--config` | optional | JSON config file path |
| `--dry-run` | false | Simulate without executing |

### Config File

For cron jobs, use a JSON config:

```json
{
  "token": "0xYOUR_TOKEN",
  "tokenId": "12345",
  "harvestAddress": "0xYOUR_VAULT",
  "compoundPct": 50,
  "minUsd": 10,
  "slippage": 1
}
```

### Clanker Fee Contract

| Function | Description |
|----------|-------------|
| `claim(feeOwner, token)` | Claim fees for a specific token |
| `availableFees(feeOwner, token)` | Check pending fee balance |

Contract: `0xf3622742b1e446d92e45e22923ef11c2fcd55d68`

Two separate claims needed (WETH + token) — the script handles both automatically.

### Standalone Claim Script

For simpler use cases, `claim-clanker-fees.mjs` just claims without any LP operations:

```bash
# Check available fees (dry run)
node claim-clanker-fees.mjs --token 0xTOKEN --dry-run

# Claim both WETH and token fees
node claim-clanker-fees.mjs --token 0xTOKEN
```

### Self-Sustaining Agent Economics

The core idea: agents launched on Clanker can **fund their own infrastructure** from LP yield.

```
LP Fees + Clanker Fees
        ↓
   ┌────┴────┐
   │         │
Compound   Harvest
(grow LP)  (→ USDC → pay for LLM, RPC, hosting)
```

Set up a cron job with `--min-usd` threshold and the agent only acts when it's profitable to do so.

## Position Strategy Recommendations

For ~$20-1000 positions:
- **Range:** ±25% from current price
- **Rebalance:** When price hits 80% of boundary
- **Check:** Every 4-6 hours
- **Expected APR:** 15-30%
