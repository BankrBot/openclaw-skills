---
name: aeon-paper-pick
description: |
  Surface the one AI / ML paper to read today from Hugging Face Papers, with the central claim,
  why it's worth an hour, where it might be wrong, and a time-budgeted read order. Filters out
  pure benchmark-chasing and incremental scaling reports. Use as a daily morning brief input
  for AI-savvy operators.
  Triggers: "one paper to read today", "best AI paper today", "what's the must-read paper",
  "HF Papers top pick".
---

# aeon-paper-pick

One paper per day. Not a digest — one pick, with a short brief that lets the reader decide whether to invest the next hour.

## How the pick works

1. Fetch last 24h of HF Papers (`https://huggingface.co/papers`).
2. Drop pure benchmark-chasing (new SOTA on existing leaderboard, no method change), incremental scaling reports, and position papers without empirical claims.
3. Score survivors on novelty of method/framing, falsifiability of central claim, reproducibility signal (code + weights + data), and cross-discipline applicability.
4. Pick the highest scoring. Tie-break: sharper falsifiable claim.

## Brief format

```
[Paper title]
Authors: A, B, C (Lab)
arXiv: 2505.xxxxx

Central claim: [one sentence, plain English]

Why it's worth an hour:
- [method shift, not benchmark bump — they replace X with Y]
- [claim is falsifiable: ablation in §4 isolates X vs not-X cleanly]
- [code + weights released, reproducible at home]

Where it might be wrong:
- [training distribution is narrow — open question whether the effect transfers]
- [comparison baseline is older than expected]

Read order:
1. §3 (method) — 8 min
2. §4 (ablations) — 12 min
3. §6 (limitations) — 5 min
Optional: §5 (extended experiments)
```

## Empty days

If 0 papers survive the filter:

```
No surviving picks today. 14 papers filtered out: 6 benchmark-chasing, 5 incremental scaling, 3 position papers.
Worth scrolling yourself: huggingface.co/papers
```

Honesty over manufactured picks.

## Rules

- One pick, not three. Three picks is a digest, and digests become wallpaper.
- "Where it might be wrong" is mandatory.
- Read order time-budgeted. Save the reader from skimming the whole PDF.
- Cite actual sections so the reader can verify the brief.
