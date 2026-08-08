# WAKE Engine Scoring Methodology

Detailed reference for the Token Spotter scoring system. This document explains how each of the five criteria is computed so agents and developers understand what the score actually represents.

---

## Scoring Architecture

The WAKE engine separates scoring into two layers:

1. **Deterministic layer** — Gathers and normalizes signals from public sources (Dexscreener, Etherscan V2, GoPlus, public Base RPC, GeckoTerminal). Produces numerical inputs.
2. **Interpretive layer** — Receives the deterministic inputs and produces the 0-100 aggregate score, per-criterion breakdown, controlled-vocabulary tags, and narrative summary.

The output is cached per contract address. The first analysis of a given token pays the engine's compute cost; every subsequent request for the same token receives the cached result.

Post-processing applies a few server-side rules to the engine's output:

- **Bankr/Clanker floor enforcement** — Protocol-launched tokens have a minimum floor of 16/20 on `deployer_quality` and `contract_safety` because the launch infrastructure enforces verified mechanics by design.
- **Ecosystem bonus** — Verified ecosystem partners receive a small bonus (3-5 points) to `social_signals`, capped at 20. The bonus is shown transparently in the breakdown.
- **Social signals cap** — Maximum 20/20 regardless of bonuses.
- **NFA suffix enforcement** — Every analysis text ends with "NFA." (Not Financial Advice).

---

## The Five Criteria

### Deployer Quality (0-20)

Reflects the track record and credibility of the contract deployer.

**Bankr or Clanker launches:**
- Floor of 16. Protocol uses fresh deployer addresses per launch, so "no prior launches" is not a penalty.
- 18-20: clean signals across the board (verified, LP burned, low creator percentage, reasonable holder distribution)
- 16-17: bare minimum protocol baseline with no additional positive signals

**Direct deploys:**
- 14-16: all four positive markers (verified contract + LP burned + ownership renounced + holder count > 100)
- 9-12: two of those four markers
- 6-8: one of those four markers
- 2-5: zero positive markers
- 0-3: visible rug history on the deployer EOA

**Unknown launch protocol (detection failed):**
- 8 (neutral-low). Detection failure is itself a small negative signal — most legitimate tokens are detectable through Etherscan V2 + RPC fallback paths.

### Liquidity Health (0-20)

USD liquidity in the primary trading pair on Base.

| Liquidity USD | Score |
|---|---|
| ≥ $250,000 | 18-20 |
| $100K - $250K | 15-17 |
| $50K - $100K | 12-14 |
| $25K - $50K | 10-11 |
| $10K - $25K | 7-9 |
| $5K - $10K | 4-6 |
| $1K - $5K | 2-3 |
| < $1K | 0-1 |

Brand new tokens (<1h since launch) with null liquidity score 8 (neutral) — the absence of data is not a penalty when the token is too new for any to exist yet. Older tokens with null liquidity score 5 (concerning absence).

### Contract Safety (0-20)

Combination of contract verification, LP burn status, ownership renouncement, and absence of dangerous permissions.

**Bankr or Clanker launches:**
- Floor of 16. Protocol-deployed contracts use prebuilt audited patterns with safe ERC-20 mechanics, LP burn on graduation, mint disabled, and ownership renounced by design.

**Direct deploys:**
- 14-16: verified + LP burned + ownership renounced + no concerning permissions
- 11-13: verified + LP burned, ownership status unclear
- 8-10: verified only
- 0-4: unverified contract with LP retained
- 0-3: active red flags (mintable function + visible tax functions)

The GoPlus security advisory layer is **separate from this score** — see the Security Advisory section below.

### Market Signals (0-20)

Volume-to-liquidity ratio plus an absolute volume sanity check.

| Volume/Liquidity Ratio | Absolute Volume | Score |
|---|---|---|
| > 1.0 | > $50K | 16-19 |
| 0.5 - 1.0 | > $25K | 12-14 |
| 0.2 - 0.5 | — | 9-11 |
| 0.05 - 0.2 | — | 5-7 |
| < 0.05 | OR < $2K abs | 1-3 |

Brand new tokens (<1h, no volume yet) score 8 (neutral). Recent dumps (24h price change worse than -50%) subtract 3-5 points from whatever the ratio score would otherwise be.

### Social Signals (0-20)

Quality of the token's public presence — X handle, website, channel inventory.

| Signal Pattern | Score |
|---|---|
| X handle matches token + coherent website + multiple active channels | 16-19 |
| X handle + functional website | 13-15 |
| X handle only OR website only | 9-11 |
| X handle present but generic OR website is AI-template | 5-7 |
| No socials linked at all | 3-5 |
| Socials are obvious scam template | 0-2 |

**Ecosystem bonus:** When a token is part of a verified ecosystem partner program, an additional 3-5 points are added (visibly displayed in the breakdown as "(+3 ecosystem bonus)"). The total `social_signals` score is capped at 20 even with the bonus.

---

## Score Tiers

The overall 0-100 score is bucketed into tiers for quick interpretation:

| Score Range | Tier | Interpretation |
|---|---|---|
| 75-100 | `strong` | Multiple criteria are clearly strong; engine's most positive verdict |
| 60-74 | `solid` | Mixed but generally positive across criteria |
| 45-59 | `mixed` | Some criteria positive, others weak; nuanced |
| 30-44 | `weak` | Multiple criteria show concerning patterns |
| 0-29 | `red_flag` | Serious problems detected; rare verdict, treat with caution |

A high score does not mean the token will appreciate. A low score does not mean it will decline. The engine surfaces signal; the user interprets and decides. NFA.

---

## Security Advisory Layer

The WAKE engine integrates GoPlus Token Security as an **advisory layer separate from scoring**. When GoPlus flags concerning patterns, the engine surfaces them through the `security_advisory` field in the API response.

The advisory does **not** modify the engine's score because GoPlus has known false positives on legitimate tokens with transfer hooks, tax mechanics, or unusual but valid patterns. The advisory is a warning surface for the user to perform additional verification — not an automatic disqualifier.

### Advisory Levels

| Level | Trigger | Display |
|---|---|---|
| `clear` | No GoPlus flags detected | No advisory shown |
| `flagged_honeypot` | GoPlus flagged `is_honeypot`, `cannot_sell_all`, or high sell tax (≥25%) | Amber warning, "potential honeypot risk" |
| `flagged_contract_risk` | GoPlus detected hidden owner, ownership recovery, balance modification, transfer pause, or blacklist function | Amber warning, "contract permissions allow elevated control" |
| `data_unavailable` | GoPlus did not return data for this contract | Minor note that security data is unavailable |

When the advisory level is anything other than `clear`, agents should always relay the advisory message to the user.

---

## What the Engine Does Not Score

A few things the engine deliberately does not include in its scoring:

- **Token age** — Brand new tokens are not penalized for being new; their lack of historical data is treated as neutral.
- **Holder count alone** — Used as a component of deployer quality on direct deploys, but not weighted heavily because it can be inflated by airdrops or sniped distributions.
- **Twitter follower count** — Treated as low-signal because farming followers is cheap. The engine looks at coherence (does the handle match the token, are there real interactions) rather than raw counts.
- **Recent price action alone** — Captured in market signals via the volume/liquidity ratio and the 24h dump penalty, but the engine does not predict future price action.
- **Sentiment** — The engine does not score on social sentiment or hype levels.

---

## Reproducibility

Same inputs produce the same outputs. The engine's scoring is deterministic in its math and consistent in its interpretive layer. If two operators analyze the same token at the same time, they receive identical results. Cached results are shared across all operators, creating a network effect that improves the engine's value as more tokens are analyzed.

NFA.
