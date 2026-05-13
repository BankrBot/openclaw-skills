---
name: aeon-deal-flow
description: |
  Weekly funding round tracker across configurable verticals (AI, crypto, prediction markets,
  agentic infrastructure, etc.). Primary-source-required (Form D, press release, or verified
  founder/firm post) — filters re-announcements and rumored rounds. Per round: lead, size,
  valuation if disclosed, what they do, why now, and the sharpest risk.
  Triggers: "this week in funding", "deal flow", "who raised this week",
  "crypto funding rounds", "AI funding tracker".
---

# aeon-deal-flow

Weekly synthesis of announced funding rounds. Read in 3 minutes — round → company → why it matters → who else is in the space.

## Inputs

| Param | Description |
|---|---|
| `verticals` | Comma-separated, e.g. `ai, crypto, prediction-markets, agentic-infra`. |
| `min_round_usd` | Floor. Default $1M. Suppresses seed noise. |
| `geo` | Optional: `us`, `eu`, `asia`, `latam`, empty for all. |

## Sources

Crunchbase news, TechCrunch funding tag, Pitchbook where accessible, SEC Form D filings, company press releases, founder/firm X & LinkedIn posts as confirmation only.

A round needs **at least one primary source** (Form D, press release, or verified founder/firm post). Pure rumor entries excluded.

## Filters

Re-announcements (same round previously reported), rumored / TBA without filing, undisclosed-amount bridge rounds, below `min_round_usd`, off-topic verticals.

## Per-round fields

```
Company: [name]
What they do: [one sentence, plain English]
Round: Seed / Series A / etc. — $XM at $YM post if disclosed
Lead: [firm]
Other participants: [firm1, firm2]
Source: [primary link]
Why it matters:
  - Why now (named catalyst — model breakthrough, regulatory clarity, etc.)
  - Who else is in the space (2-3 competitors by name)
  - One sharp risk
```

## Output

Group by vertical, lead with the headline (biggest round or theme of the week). Show "Filtered out" footer (rumored, re-announced, below floor) so the operator can see what's excluded.

## Rules

- Primary source required.
- "Why it matters" must include a catalyst, not just sector framing. "AI is hot" is not a catalyst.
- Risk section mandatory and specific — never "execution risk" filler.
- Bias toward rounds that change the structure of a category, not just the leader.
