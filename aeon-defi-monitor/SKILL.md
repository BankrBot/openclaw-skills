---
name: aeon-defi-monitor
description: |
  Watchlist monitor for DeFi pools, lending markets, and vaults. Surfaces only changed entries —
  APR floor breached, utilization ceiling hit, TVL delta above threshold, health factor approaching
  liquidation, or position PnL crossed your alert. Bankr-ready Submit payload attached when an
  alert recommends action. Silent on quiet members.
  Triggers: "check my defi positions", "monitor these pools", "yield check on Aave/Compound",
  "is my LP underwater", "pool health for X".
---

# aeon-defi-monitor

Tracks a configured list of DeFi entries — DEX pools, lending positions, vault deposits — and pings on meaningful change. Designed to pair with Bankr Submit so the operator can act directly on alerts.

## Watchlist

```yaml
protocols:
  - id: aerodrome-base
    type: dex
    pool_address: 0x...
    alert_apr_floor: 8.0
    alert_tvl_delta_pct: 20

  - id: aave-v3-base-usdc
    type: lending
    market_address: 0x...
    asset: USDC
    position_address: 0x...   # optional — your EOA / safe
    alert_util_ceiling: 85
    alert_health_factor: 1.3  # ping if borrow position approaches liquidation

  - id: pendle-arb-pt-eeth
    type: vault
    market_id: ...
    position_size_usd: 5000
    alert_implied_apy_floor: 12.0
```

## Per-type checks

- **DEX** — TVL + 24h delta, fee APR + incentive APR + emission token, slippage estimate on $1k swap.
- **Lending** — total supplied / borrowed, utilization, supply + borrow APYs split by real vs incentive, health factor if a position is tracked.
- **Vault** — TVL, implied APY (with what drives it), position value if tracked, withdrawal liquidity.

## Alert triggers

APR drops below floor, utilization above ceiling, TVL delta above threshold, position PnL crossed threshold, health factor approaches 1.0, pool depegs > 1%, vault APY drops below floor. Health-factor alerts always fire when approaching 1.0 regardless of other thresholds.

## Sources

DefiLlama (`api.llama.fi` + `yields.llama.fi`), on-chain via Bankr-compatible RPC / Quicknode / Alchemy. Position data sanity-checked vs on-chain state every run.

## Bankr execution hook

When an alert recommends action, output includes a ready-to-paste Submit payload:

```
Submit: deposit 1000 USDC into aerodrome-base pool 0x... via Aerodrome router
Submit: withdraw position from aave-v3-base USDC market 0x...
```

## Rules

- Read-only by default. Execution requires explicit operator input.
- Silent on unchanged.
- Stale-data flag if last update > 1h old.
