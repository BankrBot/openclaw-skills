---
name: aeon-token-pick
description: |
  One token recommendation and one prediction-market pick per run — with falsifiable thesis,
  entry, sizing guidance, and an explicit kill criterion. Skip branch fires when no candidate
  has both a named/dated catalyst and asymmetric upside. The discipline is the skip branch —
  empirically the highest-EV output on flat days is no pick.
  Triggers: "what should I trade today", "give me a token pick", "prediction-market rec",
  "is there an asymmetric setup".
---

# aeon-token-pick

At most one token pick and one prediction-market pick per run. Each pick must have:

- **Falsifiable thesis** — one sentence.
- **Entry** — price + venue.
- **Kill criterion** — the specific signal that says the thesis is wrong.
- **Sizing** — small / medium / large vs the operator's stack.
- **Time horizon** — hours / days / weeks.

If no candidate clears the bar — named, dated catalyst plus asymmetric setup — the skill returns `NO_PICK` with the top three near-misses and what would have tipped them over.

## Sample output

```
TOKEN: $XYZ — entry $0.42 on Base (Aerodrome WETH/XYZ pool)
Thesis: ProductHunt launch May 15 + commit-velocity surge signals real shipping
Kill: launch delayed past May 22 OR daily commits drop below 5 for 3 days
Sizing: medium · Horizon: 2-3 weeks

MARKET: NO on "EIGEN unlock delayed past Q2" @ 0.31
Thesis: on-chain timelock activity confirms unlock; delay risk overpriced
Kill: official delay announcement before market resolves
Sizing: small (binary) · Resolution: July 1
```

No-pick output:

```
NO_PICK — 2026-05-12

Top near-misses:
1. $XYZ — catalyst unclear, asymmetry weak (upside +30%, downside -50%)
2. NO on "EIGEN delayed past Q2" — mispriced but no dated resolution

Would tip the call: a dated catalyst on $XYZ; a specific committee date for EIGEN.
```

## Rules

- Falsifiable thesis or no pick.
- Cite the catalyst by name and date. "Sentiment turning" is not a catalyst.
- Crowdedness penalty — if every newsletter is recommending it, the asymmetry is gone.
- NO_PICK is a valid output. Manufactured picks burn capital.

Pairs naturally with `aeon-narrative-tracker` (narrative fit), `aeon-monitor-runners` (momentum candidates), `aeon-unlock-monitor` (supply-side risk), and Bankr Submit / AgenticBets for execution.
