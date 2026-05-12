---
name: aeon-unlock-monitor
description: |
  Weekly token unlock tracker ranked by Absorption Ratio (unlock_usd / 7d avg daily volume),
  not the weak "% of circulating supply" proxy. Per event: cliff vs linear classification,
  recipient category (team / investor / community / forced), and a one-line market read
  (priced in / market asleep / fade pump / forced sellers / absorbable).
  Triggers: "scan upcoming unlocks", "which tokens unlock this week", "supply pressure check",
  "are unlocks priced in", "FTX/Mt Gox distributions".
---

# aeon-unlock-monitor

Empirically (Keyrock's 16k+ unlock analysis), ratios > 2.4× strain liquidity and produce measurable drawdown; < 0.5× the market yawns. The skill ranks by ratio first, supply % second, and adds pre-unlock price action to produce a per-event verdict.

## Tiers

```
ratio = unlock_usd_value / 7d_avg_daily_volume

CRISIS     > 2.4×    liquidity cannot absorb without slippage
STRAIN     1.0-2.4×  multiple sessions to digest
DIGESTIBLE 0.3-1.0×  notable but absorbable
TRIVIAL    < 0.3×    background noise
```

Recipient override: team/investor (cost-basis-zero sellers) bump up one tier; community/staking-rewards bump down. Court-ordered distributions (FTX, Mt. Gox, Celsius) bypass the tier system — always included, labeled `forced`.

## Market read

| Read | Condition |
|---|---|
| `priced in` | Token down > 20% over 30d AND tier ≤ STRAIN. Selling has happened. |
| `market asleep` | Flat or up over 30d AND tier ≥ STRAIN. Asymmetric downside. |
| `fade pump` | Up > 15% over 30d AND tier = CRISIS. Pre-cliff bid-and-dump. |
| `forced sellers` | Court-ordered. Legal timeline, not market-driven. |
| `absorbable` | TRIVIAL/DIGESTIBLE with no recipient flag. |

## Sources

Tokenomist (primary), DefiLlama unlocks, CryptoRank, DropsTab, CoinGecko for volume + 30d price. Source status emitted in output — `DEGRADED` if 2+ fail, `ERROR` only if all fail.

## Output

Headline = most-leveraged unlock with its market read. Then tiered groups: CRISIS → STRAIN → DIGESTIBLE → FORCED. Quiet week ships `UNLOCK_MONITOR_QUIET` with one sentence — supply being calm is itself a signal.

A local `state/unlock-monitor-seen.json` holds `${ticker}:${unlock_date}` keys on a 90-day window for dedup.

## Rules

- Cliff pattern: weakness ~30d prior, vol peak on the date, recovery 10-14 days after. Note explicitly.
- Linear unlocks rarely produce single-day shocks. Say so when one shows up high.
- Be direct. "priced in", "market's asleep", "fade the pump". No hedging.
