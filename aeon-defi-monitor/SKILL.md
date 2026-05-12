---
name: aeon-defi-monitor
description: |
  Check pool health, position state, and yield rates for tracked DeFi protocols on Base, Arbitrum,
  Optimism, Ethereum, and other EVM chains. Watchlist-driven — surfaces only meaningful changes in
  TVL, fee APR, incentive APR, utilization, or your own position values. Use to track lending
  exposure, LP positions, vault deposits, or protocols you'd want to enter on a drawdown.
  Triggers: "check my defi positions", "monitor these pools", "pool health for X",
  "yield check on Aave/Compound/...", "is my LP underwater".
---

# aeon-defi-monitor

Watchlist monitor over DeFi pools, lending markets, and vaults. Pulls live data from DefiLlama + on-chain RPC, computes deltas vs prior run, surfaces only changed entries.

Designed to **execute on alerts via Bankr** when you want to act — e.g., add to an LP that just crossed your APR floor, or unwind a lending position whose utilization spiked.

## Watchlist format

```yaml
protocols:
  - id: "aerodrome-base"
    type: dex
    pool_address: "0x..."
    alert_apr_floor: 8.0       # ping if APR drops below
    alert_tvl_delta_pct: 20    # ping on ≥20% TVL change in 24h

  - id: "aave-v3-base"
    type: lending
    market_address: "0x..."
    asset: "USDC"
    alert_util_ceiling: 85     # ping if utilization > 85%

  - id: "morpho-base-usdc"
    type: lending
    asset: "USDC"
    position_address: "0x..."  # your own EOA / safe
    alert_pnl_delta_usd: 100

  - id: "pendle-arb-pt-eeth"
    type: vault
    market_id: "..."
    position_size_usd: 5000
    alert_implied_apy_floor: 12.0
```

## Per-type checks

### `dex` (LP positions, pool health)

- TVL (current + 24h delta).
- 24h volume and fee APR.
- Incentive APR + emission token (if any).
- Pool composition (impermanent loss exposure if your position is tracked).
- Slippage estimate on a $1k swap (liquidity sanity check).

### `lending` (Aave / Compound / Morpho / Spark)

- Total supplied / borrowed.
- Utilization rate.
- Current supply APY (real + incentive split).
- Current borrow APY.
- If a position address is configured: position health factor, collateral value, borrow value.

### `vault` (Pendle / Yearn / Beefy / Idle / etc.)

- Vault TVL.
- Implied APY (and what drives it — underlying yield vs leverage vs incentives).
- Position value if `position_address` configured.
- Withdrawal liquidity check (can you exit at size?).

## Data sources

```bash
# DefiLlama protocol detail
curl -s "https://api.llama.fi/protocol/${protocol_slug}"

# DefiLlama yields
curl -s "https://yields.llama.fi/pools" | jq '.data[] | select(.pool == "${pool_id}")'

# On-chain reads via Bankr-compatible RPC
curl -s -X POST "${RPC_URL}" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_call","params":[{"to":"${pool_addr}","data":"0x..."}, "latest"]}'

# Aave v3 user data (via Pool contract)
# Pendle PT/YT pricing (via Pendle API)
curl -s "https://api-v2.pendle.finance/core/v1/${chain_id}/markets/${market_id}"
```

## Alert triggers

A watchlist entry surfaces if any:

| Trigger | Applies to |
|---|---|
| APR drops below floor | DEX, vault |
| Utilization above ceiling | Lending |
| TVL delta above threshold | All |
| Position PnL change above threshold | If position address tracked |
| Health factor approaching 1.0 | Lending (your borrow side) |
| Pool depegs (asset ratio shifts > 1%) | DEX with stable/stable or LST pairs |
| Vault implied APY drops below floor | Vault |

Silent on unchanged.

## Output

```
*DeFi Monitor — 2026-05-12*

3 watchlist entries surfaced (5 silent)

aerodrome-base (DEX) — pool 0x...
  TVL: $42M (▼ 14% 24h — large LP exit)
  Fee APR: 18.2% (▲ — same fees, smaller LP base)
  Incentive APR: 4.1% (AERO emissions, unchanged)
  Slippage @ $1k: 0.04% (fine)
  Action: APR is up but TVL exit may continue — wait for stabilization before adding

aave-v3-base USDC (Lending) — market 0x...
  Util: 87% (▲ from 76%) — ceiling breached
  Supply APY: 9.1% (real 7.8% + incentives 1.3%)
  Borrow APY: 11.2%
  Risk: if util hits 95% you'll have withdrawal queue on the supply side

morpho-base-usdc (Lending) — your position 0x...
  Position: $5,420 supplied (was $5,300, +$120 PnL — yield accrual)
  No alert triggered (PnL delta below $1k threshold) — surfaced anyway because of paired aave alert
```

## Bankr execution hook

When an alert recommends action (add LP, unwind position, rebalance), the output includes a Bankr-ready Submit payload. Operator copies into agent input:

```
Submit: deposit 1000 USDC into aerodrome-base pool 0x... via Aerodrome router
Submit: withdraw position from aave-v3-base USDC market 0x...
```

## Guardrails

- Read-only by default. Execution requires explicit operator input — the monitor never auto-rebalances.
- Position data is sanity-checked vs on-chain state every run (no trust in indexer alone).
- Stale-data flag if last update > 1 hour old.
- Health-factor alerts always fire when approaching 1.0, regardless of other thresholds.

## Required keys

- Bankr-compatible RPC (or Quicknode / Alchemy / public RPC).
- Optional Bankr Wallet API key if tracking position addresses owned by the operator.

## Pairs with

- `aeon-defi-overview` (the regime context this monitor operates within).
- `aeon-on-chain-monitor` (counterparty / treasury activity behind your protocols).
- Bankr Submit / Trails / Zyfai for execution.
