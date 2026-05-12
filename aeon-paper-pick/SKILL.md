---
name: aeon-paper-pick
description: |
  Surface the one AI / ML paper to read today from Hugging Face Papers, with a one-paragraph
  summary, the key claim, and why it's worth your hour. Filters out incremental work and
  benchmark-chasing in favor of papers with a falsifiable thesis or a method shift. Use as a
  daily morning brief input for AI-savvy operators.
  Triggers: "one paper to read today", "best AI paper today", "what's the must-read paper",
  "pick today's paper", "HF Papers top pick".
---

# aeon-paper-pick

One paper per day, picked from the HF Papers feed. Not a digest — one pick, with a short brief that lets the reader decide whether to invest the next hour reading the full PDF.

## How the pick works

1. **Ingest** — fetch the last 24h of Hugging Face Papers (`https://huggingface.co/papers`).
2. **Filter** — drop papers in three categories:
   - Pure benchmark-chasing (new SOTA on existing leaderboard, no method change).
   - Incremental scaling reports without a method delta.
   - Position papers without empirical claims.
3. **Score** the survivors on:
   - **Novelty** of the method or framing.
   - **Falsifiability** of the central claim (is there an experiment that would refute it?).
   - **Reproducibility signal** (code release? checkpoints? data?).
   - **Cross-discipline applicability** (does it port outside the lab that produced it?).
4. **Pick** the highest-scoring survivor. If two tie, the one with the sharper falsifiable claim wins.

## What the brief contains

```
*Paper Pick — 2026-05-12*

[Paper title]
Authors: A, B, C (Lab)
arXiv: 2505.xxxxx
HF Papers: huggingface.co/papers/2505.xxxxx

The central claim (1 sentence, plain English):
The authors argue that X causes Y when Z, demonstrated on dataset W.

Why it's worth an hour:
- It's a method shift, not a benchmark bump — they replace [common technique] with [new technique].
- The claim is falsifiable: ablation in §4 isolates X vs not-X cleanly.
- Code + weights released — reproducible at home with a single GPU.

Where it might be wrong:
- The training distribution is narrow (only dataset W). Open question whether the effect transfers.
- The comparison baseline is older than expected — would a 2025-tier baseline still trail?

Read order:
1. §3 (method) — 8 minutes
2. §4 (ablations) — 12 minutes
3. §6 (limitations) — 5 minutes
Optional: §5 (extended experiments)
```

## When this surfaces nothing

If the day's filter passes 0 papers (rare but happens on slow days), the output is:

```
*Paper Pick — 2026-05-12*

No surviving picks today. 14 papers were filtered out:
  - 6 benchmark-chasing
  - 5 incremental scaling
  - 3 position papers

Worth scrolling yourself: huggingface.co/papers
```

Honesty over manufactured picks.

## Guidelines

- One pick per day, not three. Three picks = digest, and digests are wallpaper.
- "Why it might be wrong" section is mandatory. No paper is bulletproof.
- Read order is required and time-budgeted. Save the reader from skimming the whole PDF.
- Cite the actual sections (§3, §4) so the reader can verify the brief.

## Pairs with

- `aeon-huggingface-trending` for breadth (models, datasets, spaces).
- `aeon-deep-research` when the paper sparks a research thread.
- `aeon-last30` to check whether the paper's claim is being discussed.

## Required keys

None — Hugging Face Papers is public.
