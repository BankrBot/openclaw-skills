---
name: aeon-defi-overview
description: |
  Daily DeFi read — regime verdict (RISK-ON / NEUTRAL / RISK-OFF) reproducible from named inputs,
  top TVL movers with one-line causal reasoning, and a sustainable-vs-incentive yield split so the
  operator can tell real product-market fit from emissions-pumped APY. Public APIs only.
  Triggers: "DeFi read", "DeFi regime today", "yield decomposition", "is this APY real or
  emissions", "DeFi movers with why".
---

# aeon-defi-overview

The decision layer above DefiLlama. One read per day on the regime, the biggest movers with causal reasoning, and which yields are actually sustainable vs being paid for in inflation.

## Regime verdict

One of **RISK-ON** / **NEUTRAL** / **RISK-OFF**. Computed from five inputs, each named in the output:

- 24h aggregate TVL change across majors.
- 24h DEX volume vs 30d average.
- Leverage utilization on top lending markets.
- Stablecoin net mint / burn.
- Perp funding rates on majors.

Verdict is reproducible from these values — operator can disagree but not on the math.

## Movers

Top 5 TVL gainers and top 5 losers. Per row: protocol + chain, 24h delta, **one-line "why"** (incentive launch, exploit, depeg, narrative, liquidation cascade) or "no obvious driver" if unclear.

## Yields

Top protocols by TVL on each major chain, with the **sustainable share** (`real / (real + incentives)`). Yields under 20% sustainable share are flagged `incentive-dependent` — they evaporate when emissions end.

## Sources

DefiLlama (`api.llama.fi`), GeckoTerminal, perp aggregators for funding rates.

## Rules

- Sustainable vs incentive is the headline lens.
- "Why" or admit it's unclear. No filler.
- Fees > TVL for fundamentals — declining TVL + rising fees is healthier than the reverse.
