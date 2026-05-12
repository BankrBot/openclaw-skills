---
name: aeon-defi-overview
description: |
  Daily DeFi read with regime verdict (RISK-ON / NEUTRAL / RISK-OFF), biggest movers with one-line
  causal reasoning, sustainable-vs-incentive yield decomposition, and fee leaders. The decision
  layer above raw DefiLlama data. Use for morning context, daily allocation decisions, or as input
  to rebalancing skills.
  Triggers: "DeFi read", "what's happening in DeFi today", "regime check", "yield decomposition",
  "is this APY real or emissions", "fee leaders today".
---

# aeon-defi-overview

The decision layer above DefiLlama. Where Trails, Zyfai, and the lending skills execute, this informs — one read per day on the regime, the biggest TVL movers with causal reasoning, and the yields that are actually sustainable vs being paid for in inflation.

## Regime verdict

One of **RISK-ON** / **NEUTRAL** / **RISK-OFF**. Derived from named, reproducible inputs:

| Input | RISK-ON signal | RISK-OFF signal |
|---|---|---|
| 24h aggregate TVL change | Up across majors | Down across majors |
| 24h DEX volume vs 30d avg | > 1.2× | < 0.8× |
| Leverage utilization on top lending markets | Rising into 70%+ | Falling, or capped |
| Stablecoin flows (net mint vs burn) | Net mint | Net burn |
| Perp funding rates on majors | Positive across the curve | Negative or sharply mixed |

Verdict is reproducible from these inputs. Every output lists them with values.

## Movers

Top 5 TVL gainers and top 5 losers across chains. Per row:

- Protocol + chain.
- 24h TVL delta ($ and %).
- **One-line "why it matters"** — the causal driver if identifiable (incentive launch, exploit, depeg, narrative, liquidation cascade). If unclear, the row explicitly says "no obvious driver".

## Yield decomposition

For the top protocols by TVL on each major chain (Base, Arbitrum, Optimism, mainnet, Solana):

| Component | What it means |
|---|---|
| **Sustainable yield** | Real revenue: fees, borrowing demand, MEV capture share. |
| **Incentive yield** | Emissions, points programs, expected airdrop value. |
| **Sustainable share** | Sustainable / (Sustainable + Incentive). |

Yields with **sustainable share < 20%** are flagged `incentive-dependent` — they evaporate when emissions end. This is the headline insight on most "high APY" plays and the cleanest filter for which yields to LP into.

## Fee leaders

Top 10 protocols by 24h fees + 7-day trend. Fees > TVL for DeFi fundamentals — fees separate product-market fit from incentive-pumped TVL.

## Data sources

| Source | Data |
|---|---|
| DefiLlama | TVL, fees, yields. `https://api.llama.fi`, `https://api.llama.fi/overview/fees`. |
| GeckoTerminal | DEX volumes. |
| On-chain RPC | Live verification for top movers (Bankr-compatible endpoints). |
| Perp aggregators | Funding rates (Hyperliquid, dYdX, GMX). |

```bash
# Aggregate TVL change
curl -s "https://api.llama.fi/v2/historicalChainTvl/All" | jq '.[-2:]'

# Fees overview (24h)
curl -s "https://api.llama.fi/overview/fees?excludeTotalDataChart=true" | jq '.protocols[:20]'

# Per-protocol yields (with breakdown)
curl -s "https://yields.llama.fi/pools" | jq '.data[] | select(.tvlUsd > 10000000)'
```

## Output

```
*DeFi Overview — 2026-05-12*

Regime: RISK-OFF
  TVL -2.1% (24h, across majors)
  DEX vol 0.71× 30d avg
  Leverage util peaking at 78% on Aave Base
  Stablecoin: net burn $-180M (24h)
  Funding: negative across BTC/ETH perps

Top movers ↑
  Aerodrome (base) +$120M (+4.3%) — large LP migration from competing DEX
  Pendle (arb) +$45M (+8.1%) — new restaking PT series

Top movers ↓
  GMX V1 (arb) -$80M (-8%) — v2 migration deadline
  Spark (eth) -$60M (-3%) — savings DAI rate cut

Yield decomposition (top 10 by TVL, sustainable share):
  6 of 10 incentive-dependent (sustainable share < 20%)
    Notable: $protocol APY 14% (real 1.8%, emissions 12.2%)
    Notable: $protocol APY 9% (real 7.1%, emissions 1.9%) ← real product

Fee leaders (24h)
  1. Hyperliquid — $2.4M (▲ 7d)
  2. Aerodrome — $1.8M (▲ 7d)
  3. Uniswap — $1.6M (▼ 7d)
  ...
```

## Guidelines

- Sustainable vs incentive is the headline lens. Without it, "high APY" is meaningless.
- One-line "why it matters" or admit the cause is unclear. No filler.
- Regime verdict is reproducible from named inputs — never vibes.
- Fees > TVL for fundamentals. A protocol with declining TVL but rising fees is healthier than the reverse.
- Cross-chain by default — most agents operating on Base also care what's happening on mainnet and Arbitrum.

## Required keys

None — public APIs only. Optional Bankr-compatible RPC for cross-checks.

## Pairs with

- `aeon-monitor-runners` (the moving tokens within these regimes).
- `aeon-unlock-monitor` (supply pressure in a RISK-OFF regime hits harder).
- Bankr Trails / Zyfai for execution once the call is made.
