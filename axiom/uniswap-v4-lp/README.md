# Uniswap V4 LP Skill

Manage concentrated liquidity positions on Uniswap V4 (Base chain). Built for AI agents — add liquidity, collect fees, monitor positions, rebalance, and **auto-compound fees back into liquidity**.

## Features

- **Add liquidity** to V4 pools with configurable range
- **Remove liquidity** (partial or full) and burn positions
- **Collect fees** without removing liquidity
- **Monitor positions** — in-range detection, edge alerts
- **Rebalance** — remove + re-add at current price
- **Auto-compound** — collect fees → re-add as liquidity, fully automated

## Auto-Compound

The headline feature. Two strategies let agents choose how to compound:

### Dollar Strategy (default)
Accumulate fees, only compound when they hit a USD threshold. Best for low-volume pools or patient LPs.

```bash
# Compound when fees reach $50, check every hour
node auto-compound.mjs --token-id <ID> --strategy dollar --loop --interval 3600 --min-usd 50
```

### Time Strategy
Compound on a fixed schedule. Skips only if fees < gas cost. Best for high-volume pools.

```bash
# Compound every 4 hours
node auto-compound.mjs --token-id <ID> --strategy time --loop --interval 14400
```

### Gas-Aware
Both strategies enforce a gas floor — fees must exceed `3x` gas cost (configurable via `--min-gas-multiple`). You'll never burn money on pointless compounds.

### Quick Start

```bash
cd scripts && npm install

# One-shot compound
node auto-compound.mjs --token-id <ID>

# Preview without executing
node auto-compound.mjs --token-id <ID> --dry-run

# Full auto mode
node auto-compound.mjs --token-id <ID> --strategy time --loop --interval 14400
```

## All Commands

```bash
# Add liquidity ($20, ±25% range)
node add-liquidity.mjs --amount 20 --range 25

# Check position status
node check-position.mjs --token-id <ID>

# Monitor (in-range detection)
node monitor-position.mjs --token-id <ID>

# Collect fees only
node collect-fees.mjs --token-id <ID>

# Auto-compound
node auto-compound.mjs --token-id <ID>

# Remove liquidity (50%)
node remove-liquidity.mjs --token-id <ID> --percent 50

# Burn position (100% remove + burn NFT)
node burn-position.mjs --token-id <ID>

# Rebalance
node rebalance.mjs --token-id <ID> --range 25
```

## Requirements

- Node.js 18+
- Private key in `~/.axiom/wallet.env` (as `PRIVATE_KEY` or `NET_PRIVATE_KEY`)
- Tokens approved to Permit2 (`0x000000000022D473030F116dDEE9F6B43aC78BA3`)

## Contracts (Base)

| Contract | Address |
|----------|---------|
| PoolManager | `0x498581ff718922c3f8e6a244956af099b2652b2b` |
| PositionManager | `0x7c5f5a4bbd8fd63184577525326123b519429bdc` |
| StateView | `0xa3c0c9b65bad0b08107aa264b0f3db444b867a71` |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |

## V4 Technical Notes

- Uses **CLOSE_CURRENCY (0x11)** for both fee collection and liquidity re-add — safely handles dynamic fee pools (Clanker hooks)
- SETTLE_PAIR (0x0d) does NOT work for INCREASE_LIQUIDITY on hook pools (causes `DeltaNotNegative`)
- 2-action encoding pattern only — 3-action patterns cause `SliceOutOfBounds`
- All operations verified on-chain on Base mainnet

## License

MIT — by [@AxiomBot](https://x.com/AxiomBot)
