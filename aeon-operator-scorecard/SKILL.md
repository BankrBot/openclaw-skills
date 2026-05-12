---
name: aeon-operator-scorecard
description: |
  Weekly plain-language synthesis of agent health + community growth + economic activity. Answers
  "was this week worth it?" in one notification. Use for Monday-morning operator reads, stakeholder
  updates, or the trigger that decides whether to keep running an agent.
  Triggers: "was this week worth it", "operator scorecard", "weekly synthesis",
  "is the agent earning its keep", "give me the weekly verdict".
---

# aeon-operator-scorecard

The one-page answer to "is this thing earning its keep?" Pulls three layers of signal — agent operational health, community growth, and economic activity — and synthesizes them into a single weekly verdict the operator can read in 30 seconds.

For autonomous-agent operators who don't have time to grep through 47 skill outputs every Monday morning.

## Three layers

### 1. Agent health

| Metric | Source |
|---|---|
| Skill-run pass rate (this week vs prior) | `aeon-skill-evals` aggregate |
| Chronic failures (>3 consecutive misses) | `aeon-skill-health` |
| Mean time-to-repair on filed issues | `aeon-skill-repair` history |
| Total API spend + delta vs prior week | Token usage CSV |

### 2. Community growth

| Metric | Source |
|---|---|
| Watched-repo stars / forks / contributors — net change | GitHub API |
| Inbound mentions on tracked social surfaces | X/Twitter, Farcaster |
| Newsletter / subscriber counts if applicable | Substack / Beehiiv API |
| Fork-cohort movement (COLD → STALE → ACTIVE → POWER) | `aeon-fork-cohort` |

### 3. Economic activity

| Metric | Source |
|---|---|
| Tokens distributed via `aeon-distribute-tokens` | State file aggregation |
| Wallet balance trajectory across Bankr wallets | `GET /wallet/portfolio` per instance |
| Revenue events (fees earned, deals closed, ad spend) | Custom signals |
| Net economic week (in/out) | Computed |

## Verdict

| Verdict | Condition |
|---|---|
| **WORTH IT** | Pass rate ≥ 90% AND community ≥ flat AND economic ≥ flat. |
| **MIXED** | One layer up, one flat, one down. |
| **STRUGGLING** | Two layers down OR pass rate < 70%. |
| **CRISIS** | All three down OR a critical issue open > 7 days. |

Verdict is reproducible from named inputs.

## Output

```
*Operator Scorecard — week of 2026-05-12 — WORTH IT*

Agent health
  Pass rate: 92% (▲ from 87%)
  Chronic failures: 2 (▼ from 4 — autoresearch fix on token-movers landed)
  Mean time-to-repair: 6h (▼ from 14h)
  API spend: $11.50 (▼ from $14.20)

Community
  Watched repos: +4 stars (▲), +2 forks, +1 contributor
  Inbound mentions: 18 (▲ from 11)
  Fork cohort: 1 → POWER, 2 stayed ACTIVE, 3 went COLD

Economic
  Distributed: $65 USDC to 5 contributors
  Wallet net: +$120 (inflows from Bankr token fee share)
  Revenue events: 1 ad spend ($25), 1 contributor reward ($65)
  Net week: +$30

What moved this week
  - Adding support for X drove the engagement bump
  - Skill Y stopped failing after autoresearch evolution
  - Wallet balance up on net inflows; spend remained controlled

On deck
  - Y skill still chronic — operator review needed
  - Pending: aeon-spawn-instance for prediction-markets vertical
```

## Bankr integration

When the operator's wallets are tracked, the skill pulls live balances from Bankr Wallet API for the economic layer:

```bash
curl -fsS "https://api.bankr.bot/wallet/portfolio?chain=base" \
  -H "X-API-Key: ${BANKR_API_KEY}"
```

Multi-wallet operators (e.g. via `aeon-fleet-control`) get a consolidated view across instances.

## Guidelines

- Plain language, no jargon — the scorecard is for human consumption (and for forwarding to stakeholders).
- Numbers + their delta — never raw numbers without context.
- "What moved" section is required; without causal narrative the numbers are noise.
- Silence on truly flat weeks is configurable (skip notify if no week-over-week movement).
- Be honest. CRISIS verdicts aren't softened; STRUGGLING isn't laundered into MIXED.

## Pairs with

- `aeon-skill-evals` (pass-rate input).
- `aeon-skill-repair` (repair velocity input).
- `aeon-fleet-control` (cross-fleet aggregation for multi-instance operators).
- Bankr Wallet API (economic-layer input).
