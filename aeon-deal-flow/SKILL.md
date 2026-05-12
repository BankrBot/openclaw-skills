---
name: aeon-deal-flow
description: |
  Weekly funding round tracker across configurable verticals (AI, crypto, prediction markets, agentic
  infrastructure, etc.). Surfaces lead investor, round size, valuation if disclosed, and what the
  company actually does — filters out re-announcements and rumored rounds without a primary source.
  Use for competitive intel, market sizing, or sourcing.
  Triggers: "this week in funding", "deal flow", "who raised this week", "crypto funding rounds",
  "AI funding tracker".
---

# aeon-deal-flow

Weekly synthesis of announced funding rounds in your tracked verticals. Designed to be read in 3 minutes — round → company → why it matters → who else is in the space.

## Inputs

| Param | Description |
|---|---|
| `verticals` | Comma-separated. Examples: `ai`, `crypto`, `prediction-markets`, `agentic-infra`, `devtools`, `bio`. |
| `min_round_usd` | Optional floor. Default $1M. Suppresses seed noise. |
| `geo` | Optional. `us`, `eu`, `asia`, `latam`, or empty for all. |

## Sources

| Source | Used for |
|---|---|
| Crunchbase news pages | Round announcements with verified details. |
| TechCrunch funding tag | Coverage timeline. |
| Pitchbook (where accessible) | Valuation + cap-table info. |
| SEC Form D filings | Primary source for U.S. private placements. |
| Company press releases | Direct primary source. |
| X / LinkedIn announcements | Confirmation, never primary. |

A round must have at least one **primary source** (Form D, press release, or founder/firm post with verifiable account) to be included. Pure rumor entries are excluded.

## Filters

| Filter | What it drops |
|---|---|
| Re-announcement | Round was announced earlier in the year, now hitting press again. |
| Rumored / TBA | "Reportedly in talks", "expected to close" without filing. |
| Bridge / extension without disclosed amount | If the size isn't public, skip. |
| Below min_round_usd | Pre-seed / friends-and-family below floor. |
| Not in tracked verticals | Off-topic. |

## Per-round fields

```
Company: [name]
What they do: [one-sentence plain English]
Round: Seed / Series A / etc. — $XM at $YM post (if disclosed)
Lead: [firm]
Other participants: [firm1, firm2, ...]
Source: [primary link]
Why it matters:
  - Why now (catalyst — model breakthrough, regulatory clarity, prior round's follow-through, etc.)
  - Who else is in the space (2-3 named competitors)
  - One sharp risk
```

## Output

```
*Deal Flow — week of 2026-05-12*

This week's headline: AI agent infrastructure raised $215M across 5 rounds, biggest week YTD.

CRYPTO (3 rounds)
  • Polymarket — Series C — $200M @ $4B post — Lead: Founders Fund
    What: prediction markets
    Why: post-no-action-letter regulatory clarity unlocked institutional path
    Competitors: Kalshi, Augur (defunct), Manifold
    Risk: subsidiary structure may not preserve permissionless on-chain integrations
    Source: techcrunch.com/...

  • Stakr — Series A — $12M @ undisclosed — Lead: Multicoin
    What: ERC-4626 vault tooling for ERC-20 tokens
    Source: company-blog.example/...
    ...

AI AGENTS (2 rounds)
  • [company] — Series A — $40M @ $200M — Lead: ...
    ...

AGENTIC INFRA (2)
  • ...

REGULATORY / COMPLIANCE (1)
  • ...

Filtered out
  - 3 rumored rounds (no primary source)
  - 2 re-announcements
  - 4 below floor
```

## Guidelines

- Primary source required. "Reportedly" without a filing or company post is rumor — exclude.
- "Why it matters" must include a catalyst, not just sector framing. "AI is hot" is not a catalyst.
- Risk section is mandatory and must be specific (regulatory exposure, dependency, market timing) — not "execution risk" filler.
- Bias toward rounds that change the structure of a category, not just the leader.

## Pairs with

- `aeon-narrative-tracker` — funded categories are often the narratives running on X.
- `aeon-reg-monitor` — regulatory clarity often precedes large rounds.
- `aeon-deep-research` for a DD on any single round that warrants more.

## Required keys

None — public sources only. Optional Pitchbook access enriches valuation data.
