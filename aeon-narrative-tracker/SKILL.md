---
name: aeon-narrative-tracker
description: |
  Daily narrative map for crypto and AI. Each narrative gets a mindshare score (1-5), a velocity
  arrow (↑↑ ↑ → ↓ ↓↓), a phase label (Emerging / Rising / Peak / Fading), named drivers (@handles,
  not "people are saying"), and an explicit position call (FRONT-RUN / RIDE / FADE / WATCH / IGNORE).
  Drops narratives that grade IGNORE. Surfaces transitions vs prior runs as the headline.
  Triggers: "track narratives", "what's running on CT", "is X peaking", "narrative positions today".
---

# aeon-narrative-tracker

Decision-grade narrative map. The point isn't to print today's zeitgeist — it's to catch phase transitions and flag when the story is moving outcomes (reflexivity).

## Signal sources

1. **xAI x_search** (optional `XAI_API_KEY`) — pre-fetched cache of 12-15 narrative threads from the last 3 days.
2. **WebSearch** — DefiLlama, Kaito mindshare, broader web.
3. **Memory diff** — narrative labels from prior runs, to compute transitions.

## Output

Lead with transitions and reflexivity. Positions next. Static map last.

```
TRANSITIONS
  NEW: agentic-payments — first merchant adoption announcement
  PROMOTED: restaking — Rising → Peak (ETF leak)
  DEMOTED: memecoin-szn — Peak → Fading (60% vol drop WoW)
  DEAD: parallel-EVM — gone

REFLEXIVITY
  prediction-markets — protocols rebranding around the Polymarket S-1 leak

POSITIONS
  FRONT-RUN: agentic-payments (mindshare 2 ↑↑) — drivers, bear case, link
  FADE: restaking (5 → Cope) — driver list, reflexivity flagged

MAP
  Emerging: agentic-payments
  Rising: AI-x-crypto
  Peak: restaking
  Fading: memecoin-szn
```

Quiet day: one line — `no phase transitions, map unchanged from {date}`. Silence is correct.

## Rules

- Drop narratives that grade IGNORE.
- Named drivers only. "Crypto Twitter is excited" is not a driver.
- Cope sentiment is a first-class tag (bag-holder energy, bear-narratives-dressed-as-bull).
- Reflexivity only flagged with concrete evidence (rebrands, on-chain flows, named endorsements).
