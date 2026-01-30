# Uniswap V4 LP Skill

Manage concentrated liquidity positions on Uniswap V4 (Base chain). Built for AI agents — add liquidity, collect fees, monitor positions, rebalance, auto-compound, and **claim + harvest Clanker protocol fees**.

## Features

- **Add liquidity** to V4 pools with configurable range
- **Remove liquidity** (partial or full) and burn positions
- **Collect fees** without removing liquidity
- **Monitor positions** — in-range detection, edge alerts
- **Rebalance** — remove + re-add at current price
- **Auto-compound** — collect fees → re-add as liquidity, fully automated
- **🌾 Clanker Harvest** — claim protocol fees, compound, swap to USDC, vault

## 🌾 Clanker Harvest (NEW)

The killer feature: **complete treasury management for any Clanker-launched token**.

Clanker tokens have two fee sources:
1. **Clanker protocol fees** — stored in a separate fee contract, must be claimed
2. **LP position fees** — accrued in the V4 position

`clanker-harvest.mjs` handles both in one modular pipeline:

```
Clanker Fees + LP Fees
        ↓
   ┌────┴────┐
   │         │
Compound   Harvest
(grow LP)  (→ USDC → pay for LLM, RPC, hosting)
```

### Usage

```bash
# Just claim Clanker protocol fees
node clanker-harvest.mjs --token 0xTOKEN

# Claim + compound 100% into LP
node clanker-harvest.mjs --token 0xTOKEN --token-id 12345 --compound-pct 100

# Claim + harvest 100% as USDC
node clanker-harvest.mjs --token 0xTOKEN --harvest-address 0xVAULT --compound-pct 0

# 50/50 split
node clanker-harvest.mjs --token 0xTOKEN --token-id 12345 \
  --harvest-address 0xVAULT --compound-pct 50

# With threshold — only act if fees > $10
node clanker-harvest.mjs --token 0xTOKEN --token-id 12345 \
  --harvest-address 0xVAULT --compound-pct 80 --min-usd 10

# Config file (perfect for cron)
node clanker-harvest.mjs --config harvest-config.json
```

### Pipeline

| Step | What | When |
|------|------|------|
| 1. Claim | Claim WETH + token from Clanker fee contract | Unless `--skip-claim` |
| 2. Collect LP | Collect fees from V4 position | If `--token-id` set |
| 3. Threshold | Check total USD against `--min-usd` | If threshold set |
| 4. Compound | Add X% back into LP | If `--compound-pct` > 0 |
| 5. Swap | Swap remaining to USDC | If `--compound-pct` < 100 |
| 6. Transfer | Send USDC to vault | If harvest address set |

### Self-Sustaining Agent Economics

Set up a cron job and the agent pays for its own infrastructure:

```bash
# Every 4 hours: claim fees, compound 80%, harvest 20% as USDC if > $10
node clanker-harvest.mjs --config my-agent.json --min-usd 10
```

## Auto-Compound

Two strategies for fee compounding:

### Dollar Strategy (default)
Compound when fees hit a USD threshold. Best for low-volume pools.

```bash
node auto-compound.mjs --token-id <ID> --strategy dollar --loop --interval 3600 --min-usd 50
```

### Time Strategy
Compound on schedule. Skips only if fees < gas cost.

```bash
node auto-compound.mjs --token-id <ID> --strategy time --loop --interval 14400
```

Both strategies enforce a gas floor — you'll never burn money on gas.

## All Scripts

```bash
cd scripts && npm install

# === Position Management ===
node add-liquidity.mjs --amount 20 --range 25
node check-position.mjs --token-id <ID>
node monitor-position.mjs --token-id <ID>
node collect-fees.mjs --token-id <ID>
node remove-liquidity.mjs --token-id <ID> --percent 50
node burn-position.mjs --token-id <ID>
node rebalance.mjs --token-id <ID> --range 25

# === Auto-Compound ===
node auto-compound.mjs --token-id <ID>
node auto-compound.mjs --token-id <ID> --strategy time --loop

# === Compound & Harvest (LP fees only) ===
node compound-and-harvest.mjs --token-id <ID> --harvest-address 0xVAULT --compound-pct 50

# === Clanker Harvest (full pipeline) ===
node clanker-harvest.mjs --token 0xTOKEN --token-id <ID> --harvest-address 0xVAULT --compound-pct 50
node claim-clanker-fees.mjs --token 0xTOKEN              # standalone claim
node claim-clanker-fees.mjs --token 0xTOKEN --dry-run    # check available fees
```

## Requirements

- Node.js 18+
- Private key in env (`PRIVATE_KEY` or `NET_PRIVATE_KEY`)
- `BASE_RPC_URL` env (optional, falls back to public RPC)
- Tokens approved to Permit2 (`0x000000000022D473030F116dDEE9F6B43aC78BA3`)

## Contracts (Base)

| Contract | Address |
|----------|---------|
| PoolManager | `0x498581ff718922c3f8e6a244956af099b2652b2b` |
| PositionManager | `0x7c5f5a4bbd8fd63184577525326123b519429bdc` |
| StateView | `0xa3c0c9b65bad0b08107aa264b0f3db444b867a71` |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| Clanker Fee Storage | `0xf3622742b1e446d92e45e22923ef11c2fcd55d68` |
| SwapRouter02 (V3) | `0x2626664c2603336E57B271c5C0b26F421741e481` |

## V4 Technical Notes

- Uses **CLOSE_CURRENCY (0x11)** for fee collection — safely handles Clanker hook pools
- SETTLE_PAIR (0x0d) for INCREASE_LIQUIDITY on standard pools
- 2-action encoding pattern (3 actions = `SliceOutOfBounds`)
- Clanker fee contract uses `claim(feeOwner, token)` — separate calls for WETH + token
- All operations verified on-chain on Base mainnet

## License

MIT — by [@AxiomBot](https://x.com/AxiomBot)

Source: [github.com/MeltedMindz/axiom-public](https://github.com/MeltedMindz/axiom-public/tree/main/agent-tools/skills/uniswap-v4-lp)
