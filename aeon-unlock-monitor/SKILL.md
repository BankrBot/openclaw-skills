---
name: aeon-unlock-monitor
description: |
  Weekly token unlock and vesting tracker — quantifies supply pressure via Absorption Ratio
  (unlock_usd / 7d avg daily volume), classifies cliff vs linear, delivers a one-line market read
  per event (priced in / market asleep / fade pump / forced sellers / absorbable). Use ahead of
  supply events to position around them or as input to token-pick.
  Triggers: "scan upcoming unlocks", "which tokens unlock this week", "supply pressure check",
  "are unlocks priced in", "track FTX/Mt Gox distributions".
---

# aeon-unlock-monitor

Token unlocks ranked by **Absorption Ratio** instead of the weak "% of circulating supply" proxy. Empirically (Keyrock's analysis of 16k+ historical unlocks), ratios above ~2.4× consistently strain liquidity and produce measurable drawdown; below ~0.5× the market typically yawns.

Each event also carries a cliff-vs-linear classification, a 30-day pre-unlock price-action read, and an explicit verdict the operator can act on.

## Tiers

```
Absorption Ratio = unlock_usd_value / avg_daily_volume_usd_7d
```

| Tier | Ratio | Meaning |
|---|---|---|
| **CRISIS** | > 2.4× | Liquidity cannot absorb without significant slippage. |
| **STRAIN** | 1.0× – 2.4× | Multiple sessions to digest. |
| **DIGESTIBLE** | 0.3× – 1.0× | Notable but absorbable. |
| **TRIVIAL** | < 0.3× | Background noise. |

**Recipient overrides:**
- `team` / `investor` with cost-basis-zero gets bumped up one tier (different selling behavior than airdrop recipients).
- `community` / `staking-reward` gets bumped down one tier.

**Court-ordered distributions** (FTX, Mt. Gox, Celsius) bypass the tier system entirely — always included, labeled `forced`, with the legal timeline.

## Market read

Per event:

| Read | Condition |
|---|---|
| **`priced in`** | Token down > 20% over 30d AND tier ≤ STRAIN. Selling has happened; unlock may mark a bottom. |
| **`market asleep`** | Flat or up over 30d AND tier ≥ STRAIN. Asymmetric downside; move hasn't started. |
| **`fade pump`** | Up > 15% over 30d AND tier = CRISIS. Classic pre-cliff bid-and-dump. |
| **`forced sellers`** | Court-ordered. Different beast — legal timeline, not market-driven. |
| **`absorbable`** | TRIVIAL/DIGESTIBLE, no recipient flag. |

## Data sources

| Source | Used for |
|---|---|
| **tokenomist.ai** | Primary, source-verified across 500+ tokens, cliff/linear labeled. |
| **defillama.com/unlocks** | DeFi protocols with $ values. |
| **cryptorank.io/token-unlock** | Broad coverage, recipient-category labeled. |
| **dropstab.com/vesting** | Cross-source verification. |
| **coingecko.com** | Volume, price, 30d change for the denominator. |

Source status (`ok` / `fail` per provider) is emitted in the output. `UNLOCK_MONITOR_DEGRADED` if 2+ sources fail; `UNLOCK_MONITOR_ERROR` only if all fail.

## WebSearch queries (parallel)

```
"token unlock schedule" "${week_of}" site:tokenomist.ai OR site:defillama.com
"token unlock" "this week" cliff vesting team investor ${year}
"upcoming unlocks" cryptorank OR dropstab ${year}
"FTX distribution" OR "Mt. Gox" OR "Celsius" creditor crypto ${year}
"$10M" OR "$50M" OR "$100M" token unlock ${week_of}
```

## Enrichment per candidate

Fetch from CoinGecko / WebFetch on `https://www.coingecko.com/en/coins/${slug}`:

- 7-day average daily volume (USD) — denominator.
- Spot price.
- 30-day price change %.
- Vesting structure: `cliff` / `linear` / `mixed`.
- Recipient category: `team` / `investor` / `ecosystem` / `community` / `creditor`.

If volume is unavailable, mark `vol=unknown`, tier conservatively, flag the gap.

## Dedup

A local state file (e.g. `state/unlock-monitor-seen.json`) holds `${ticker}:${unlock_date}` keys on a 90-day rolling window. Skip exact matches against the file and against the last 7 days of prior outputs.

## Output

Lead with the headline — the single most-leveraged unlock with its market read — then tiered groups (CRISIS → STRAIN → DIGESTIBLE → FORCED).

```
*Unlock Monitor — week of 2026-05-12*

This week's most leveraged: $XYZ unlocks Wed at $42M (3.1× daily vol). market asleep.

CRISIS (> 2.4× daily vol)
- $XYZ — Wed May 14 — 25M tokens (2.1% supply, $42M)
  cliff · investor · 3.1× vol · 30d -8% → market asleep
  Note: cliff pattern — expect weakness running into the date

STRAIN (1.0×–2.4×)
- $ABC — Mon — 1.6× vol · linear investor · 30d -25% → priced in
- $DEF — Thu — 1.2× vol · cliff team · 30d +5% → market asleep

DIGESTIBLE (0.3×–1.0×)
- $GHI — Tue — 0.6× vol · linear · ecosystem → absorbable

FORCED
- $JKL — Mon — court-ordered creditor batch, $XM, no schedule discretion

Supply read: pressure concentrated mid-week from one cliff. Linear flows quiet.
$XYZ is the asymmetric setup — fade ripps into Wed, watch for capitulation Thu/Fri.

sources: tokenomist=ok, defillama=ok, cryptorank=ok, dropstab=fail, coingecko=ok
```

Quiet week: ship `UNLOCK_MONITOR_QUIET` with one sentence. Don't pad.

## Guidelines

- Absorption Ratio is the headline. % of circulating supply is secondary context.
- Team and investor unlocks at low cost basis are the strongest sell signals — bias the recipient override toward overstating impact.
- Linear unlocks rarely produce single-day shocks. Say so when one lands high in the list.
- Cliff pattern: weakness ~30d prior, vol peak on the date, recovery 10–14 days later.
- Court-ordered distributions are forced liquidation under legal timelines — tier separately.
- Cross-reference active narratives — unlocks during fading narratives hit harder.
- Be direct. "this one's priced in", "market's asleep on this", "fade the pump". No hedging.
- A quiet week on supply is a signal too.

## Required keys

None — uses WebSearch + WebFetch only.

## Pairs with

- `aeon-token-pick` — feeds in supply-side context per pick.
- `aeon-narrative-tracker` — unlocks during fading narratives are weighted differently.
