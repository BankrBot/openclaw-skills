---
name: aeon-token-pick
description: |
  One token recommendation and one prediction-market pick per run — scored on a quantified rubric,
  with falsifiable thesis, sizing guidance, kill criterion, and an explicit skip branch when
  signals are weak. The discipline is the skip branch. Use for daily disciplined position
  generation rather than manufactured conviction.
  Triggers: "what should I trade today", "give me one token pick", "scored token rec",
  "prediction-market pick", "is there an asymmetric setup".
---

# aeon-token-pick

A disciplined pick generator. Every run produces **at most** one token recommendation and **at most** one prediction-market pick — each scored on a quantified rubric and accompanied by a falsifiable thesis, position-size guidance, and the kill criterion that says when to abandon it.

The discipline is the **skip branch**: when signals are weak or contradictory, the skill returns "no pick today" rather than manufacturing conviction. Empirically the highest-EV output is often no pick.

## Inputs

| Param | Description |
|---|---|
| `mode` | `pick` (default — token + market), `token` only, `market` only, `skip` (force no-pick for testing). |

## Scoring rubric (1–5 per axis)

| Axis | What it measures |
|---|---|
| **Narrative fit** | Alignment with active narratives (input from `aeon-narrative-tracker`). |
| **Liquidity** | Pool TVL, volume, exit-friendliness. |
| **Catalyst** | A dated, named event that resolves the bet. |
| **Asymmetry** | Upside / downside ratio at current entry. |
| **Crowdedness** | Inverse score — less crowded = higher. |
| **Sizing fit** | How well this matches the operator's position-size budget. |

Weighted total max = 30.

**Skip threshold:** if no candidate scores ≥ 22/30 with a named, dated catalyst, return the no-pick output.

## Pick structure

Each pick includes:

| Field | Description |
|---|---|
| **Thesis** | One sentence, falsifiable. |
| **Entry** | Price + venue. |
| **Kill criterion** | The specific signal that says the thesis is wrong (e.g. "TVL drops below $X" or "market resolves NO by date Y"). |
| **Sizing guidance** | small / medium / large relative to the operator's stack. |
| **Time horizon** | Hours / days / weeks. |
| **Score** | Full rubric breakdown. |

## Prediction-market side

Sources: Polymarket primarily, Kalshi as confirmation. Required:

- Above a minimum-liquidity threshold to allow real entry without distorting price.
- Named, dated resolution event.
- Mispriced relative to base rates or recent on-chain signal — quantified, not hand-waved.

## No-pick output

When the skip branch fires:

```
NO_PICK — 2026-05-12

Top 3 candidates that didn't clear the threshold:
1. $XYZ — 19/30 — catalyst unclear, asymmetry weak (upside +30%, downside -50%)
2. $ABC — 17/30 — narrative fit strong but liquidity below entry threshold
3. NO on "EIGEN delayed past Q2" — 18/30 — mispriced but no dated resolution

What would tip a pick over the threshold:
- A dated catalyst on $XYZ (team has hinted at a launch in May)
- $1M+ TVL on $ABC's primary pool
- A specific committee meeting date for EIGEN
```

This is the highest-value output on flat days. Manufactured picks burn the operator's capital.

## Sample picked output

```
TOKEN — 2026-05-12

$XYZ — entry $0.42 on Base (Aerodrome WETH/XYZ pool)

Thesis: ProductHunt launch May 15 + commit-velocity surge over last 7d signals real
shipping. Narrative is agentic-payments, currently Emerging with ↑↑ velocity per
narrative-tracker.

Kill: launch is delayed past May 22 OR daily commits drop below 5 for 3 days.

Sizing: medium (operator's daily $ risk floor × 2).
Horizon: 2-3 weeks.

Score 24/30
  catalyst 5 — dated launch, public commit
  asymmetry 5 — current cap $4M, comp set $40M+
  narrative 4 — emerging, contrarian edge intact
  liquidity 4 — $410k pool, slippage <2% on $5k size
  crowded 3 — some VC mentions, no newsletter mentions yet
  sizing 3 — fits budget bracket

MARKET — 2026-05-12

NO on "EIGEN unlock delayed past Q2" @ 0.31

Thesis: official delay flag from EIGEN multisig (on-chain timelock activity) suggests
unlock confirmed; market is pricing in delay risk that hasn't materialized.

Kill: official delay announcement before market resolves OR multisig timelock cancel.

Sizing: small (binary outcome).
Resolution: July 1.

Score 23/30 — catalyst 5, asymmetry 4, narrative 3, liquidity 4, crowded 4, sizing 3
```

## Guidelines

- Skip discipline > pick quantity. NO_PICK is a valid output.
- Falsifiable thesis or no pick. Every thesis has a kill criterion.
- Cite the catalyst by name and date. "Sentiment turning" is not a catalyst.
- Crowdedness penalty — if every newsletter is recommending it, the asymmetry is gone.

## Pairs with

- `aeon-narrative-tracker` (narrative fit input).
- `aeon-monitor-runners` (momentum candidates).
- `aeon-unlock-monitor` (supply-side risk per candidate).
- Bankr Submit / AgenticBets for execution.
- `picks-tracker` downstream for retrospective scoring.
