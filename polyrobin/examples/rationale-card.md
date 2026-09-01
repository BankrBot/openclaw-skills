# Sample Rationale Card (human-readable)

> **Illustrative output — not a live recommendation.** PolyRobin emits one of these
> (JSON + this readable form) **inline in the @bankrbot reply** for **every**
> recommendation, including stand-downs — surfaced in full behind `why`. Nothing is
> written to a local directory. The machine-readable version is
> [`rationale-card.json`](./rationale-card.json).

---

**Market:** *Will Fighter A win tonight's main event?* · **Venue:** Polymarket (Polygon)
**Resolution:** official promotion result feed — KO/TKO, submission, or decision → YES;
draw or no-contest → NO. **Ambiguity:** low ✅ (single authoritative source, binary).

**Price (YES):** 0.52 · **My independent estimate:** 0.58 · **Conviction:** 68/100

### Why (source-tagged, weighted, timestamped)
| Source | Signal | Weight | Leans |
|--------|--------|:------:|:-----:|
| Historical matchup & form | A is 4–1 last 5, favorable style matchup; B on a 9-month layoff | 0.55 | YES |
| News sentiment | Beat-writer consensus mildly favors A; no injury/weight-cut flags | 0.25 | YES |
| Market microstructure | Line drifted 0.54→0.52 on modest YES volume; no sharp reversal | 0.20 | neutral |

### Edge math
```
EV_gross = (p − c) / c = (0.58 − 0.52) / 0.52   = +11.5%
− slippage ($20 order ≪ ~$120k depth)            ≈  0%   (negligible)
− fee (read from live feeSchedule: feesEnabled=false → genuinely 0, not assumed) ≈ 0%
EV_net                                           ≈ +11.5%  → clears the +4% gate
```

### Size math
```
Kelly:  f* = (p − c) / (1 − c) = (0.58 − 0.52) / (1 − 0.52) = 0.125  (full)
¼-Kelly = 0.031  →  0.031 × $1,000 = ~$31
volatility trim (×0.95)                        → ~$29.7
rounded DOWN to a conservative                 → $20   (2.0% of bankroll, inside the 10% cap)
```

### The 7 gates
| # | Gate | Status | Detail |
|---|------|:------:|--------|
| 1 | Daily loss limit (5%) | ✅ PASS | Day drawdown 0.0% |
| 2 | Max per market (10%) | ✅ PASS | $20 = 2.0% |
| 3 | Max per category (25%) | ✅ PASS | Sports 2.0% after bet |
| 4 | Conviction ≥65 & net EV ≥+4% | ✅ PASS | 68 and ~+11.5% |
| 5 | Confirmation required | ⏳ PENDING | Awaiting your `yes` — cannot be bypassed |
| 6 | Total deployed cap (60%) | ✅ PASS | 12% → 14% after bet |
| 7 | Liquidity floor ($50k/$250k) | ✅ PASS | ~$120k depth, ~$1.4M volume |

**State:** HALT off · pause off · kill-switch off.

> **Suggested:** Place $20 YES at ≤0.52 on Polymarket. **Confirm?** Reply `yes` and
> BankrBot places it from your wallet, or ask `why` for the full card. **Nothing has
> moved** — gate 5 is pending.

*Decision-support only, not financial advice. PolyRobin never custodies funds or keys.*
