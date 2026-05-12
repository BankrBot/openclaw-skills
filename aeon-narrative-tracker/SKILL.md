---
name: aeon-narrative-tracker
description: |
  Track rising, peaking, and fading crypto/tech narratives with quantitative mindshare + velocity
  signals and explicit positioning calls (FRONT-RUN / RIDE / FADE / WATCH / IGNORE). Triangulates
  xAI x_search, WebSearch, and prior-day memory. Use for daily macro reads, pre-trade context, or
  detecting reflexivity before it shows in price.
  Triggers: "track narratives", "what's running on CT", "narrative map", "is X peaking",
  "give me positions for today", "what narratives transitioned".
---

# aeon-narrative-tracker

Decision-grade narrative map. Every narrative gets a mindshare score (1–5), a velocity arrow, a phase label, a sentiment tag, named drivers (handles, not vibes), a sharp one-line bear case, and an explicit position call.

Classification without a position call is noise. Narratives that grade IGNORE are dropped unless structurally important.

## Signal sources

1. **xAI x_search** — pre-fetched cache of 12–15 distinct narrative threads over the last 3 days, with drivers, permalinks, and mention-volume descriptors.

   ```bash
   curl -s --max-time 60 -X POST "https://api.x.ai/v1/responses" \
     -H "Authorization: Bearer $XAI_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "model": "grok-4-1-fast",
       "input": [{"role":"user","content":"Search X for dominant crypto and tech narratives from FROM to TO. Return 12-15 distinct threads with labels, drivers, permalinks, mention-volume."}],
       "tools": [{"type":"x_search","from_date":"FROM","to_date":"TO"}]
     }'
   ```

2. **Web triangulation** — focused WebSearch queries against DefiLlama, Kaito mindshare leaderboard, and the broader open web for quantitative reference points.

3. **Memory diff** — narrative labels from the last 3 days of prior runs — basis for transition detection.

## Scoring rubric

| Field | Scale | Decision rule |
|---|---|---|
| **Mindshare** | 1–5 | 1 = fringe; 3 = known in sector; 5 = dominating timelines. Based on driver count + how unprompted it surfaced. |
| **Velocity** | ↑↑ / ↑ / → / ↓ / ↓↓ | Vs the 3-day window. ↑↑ = tripled. ↓↓ = was loud, now absent. |
| **Phase** | Emerging / Rising / Peak / Fading | Velocity × Mindshare combo. Emerging = low mind, high vel. Peak = high mind, flat/down. |
| **Sentiment** | Bull / Mixed / Bear / **Cope** | Cope = bag-holder energy, bear narratives dressed as bull takes. |
| **Drivers** | 2–3 named | Handles, projects, or funds. Anonymous "crypto Twitter" is not a driver. |
| **Bear case** | 1 line | Sharpest argument against. If consensus is obviously right, say "no contrarian edge". |
| **Position** | FRONT-RUN / RIDE / FADE / WATCH / IGNORE | FRONT-RUN = emerging + contrarian edge. RIDE = rising, not peaked. FADE = peak + weak fundamentals or reflexivity flip. WATCH = unclear but worth tracking. IGNORE = drop. |

## Transition detection

Vs the prior 3 days of logs:

- **NEW** — narrative absent from prior logs.
- **PROMOTED** — phase moved up (Emerging → Rising → Peak → Fading).
- **DEMOTED** — phase moved down.
- **DEAD** — was tracked, now absent across all signals.

Transitions are the highest-value output — a daily tracker that re-prints the zeitgeist is wallpaper.

## Reflexivity flagging

Each narrative is checked for whether the story is actively moving outcomes. Flag only with concrete evidence:

- Token prices moving on narrative alone (no fundamentals shift).
- Projects rebranding to ride the narrative.
- VCs publicly endorsing to manufacture legitimacy.
- On-chain flows reflecting narrative belief.

"Reflexivity" without evidence is hand-waving — drop.

## Output format

Lead with transitions and reflexivity (the decisions). Positions next. Static map last.

```
*Narrative Tracker — 2026-05-12*

TRANSITIONS
• NEW: agentic-payments — first-of-its-kind merchant adoption announcement — [link]
• PROMOTED: restaking — Rising → Peak (institutional ETF leak)
• DEMOTED: memecoin-szn — Peak → Fading (volumes collapsed 60% WoW)
• DEAD: parallel-EVM — absent across all signals

REFLEXIVITY ALERT
• prediction-markets — protocols rebranding around Polymarket S-1 leak; @handle, @handle pivoting

POSITIONS
• FRONT-RUN: agentic-payments (2 ↑↑, Bull) — @handle, @handle — bear: total volume still <$1M — [link]
• RIDE: AI-x-crypto (4 ↑, Mixed) — driver list — bear: hype/use ratio extreme
• FADE: restaking (5 → Cope) — driver list — reflexivity flagged

MAP
Emerging: agentic-payments, on-chain-credit
Rising: AI-x-crypto, prediction-markets
Peak: restaking, ETH-S-1
Fading: memecoin-szn
```

Quiet day output (no transitions, no reflexivity, no FRONT-RUN/FADE): one line — `no phase transitions, map unchanged from {prior_date}`. Silence is correct.

## Guidelines

- Quantitative over vibes. No mindshare score → drop the narrative.
- Transitions > classification. A tracker that just lists the weather is noise.
- Named drivers only. "Crypto Twitter is excited about X" is not a driver.
- Ruthless dedup. Same narrative under two labels = one narrative; merge.
- Position calls mandatory for Emerging/Rising/Peak. WATCH is acceptable when signals are genuinely ambiguous; never omit a position.
- Call out cope explicitly. Manufactured narratives, coordinated shilling, dead-cat bounces get tagged.

## Required keys

- `XAI_API_KEY` — for x_search ingest (falls back to WebSearch).
