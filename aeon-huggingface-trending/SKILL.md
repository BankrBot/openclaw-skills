---
name: aeon-huggingface-trending
description: |
  Trending Hugging Face models, datasets, and spaces — filtered by relevance, clustered by theme,
  and labeled with a "why notable" line per pick. Goes beyond the raw download counter by surfacing
  what's actually shifting rather than just popular. Use for daily AI infra reads or to catch
  new model families before they mainstream.
  Triggers: "trending on HF", "what models are hot", "huggingface trending", "new spaces today",
  "best new datasets".
---

# aeon-huggingface-trending

Daily filtered scan over Hugging Face's trending feeds. Three surfaces — models, datasets, spaces — each cluster-ranked rather than raw-download ranked.

## Surfaces and HF endpoints

```bash
# Trending models (last 24h)
curl -s "https://huggingface.co/api/models?sort=trending&direction=-1&limit=30"

# Trending datasets
curl -s "https://huggingface.co/api/datasets?sort=trending&direction=-1&limit=30"

# Trending spaces
curl -s "https://huggingface.co/api/spaces?sort=trending&direction=-1&limit=30"

# Model detail (for the "why notable" line)
curl -s "https://huggingface.co/api/models/${author}/${name}"
```

## Filtering rules

A trending entry must survive:

| Filter | Drops |
|---|---|
| **License sanity** | Models with no declared license or unclear commercial-use status get a flag, not a drop. |
| **Repo size sanity** | Empty repos, no commits, or no model card → drop. |
| **Quantization-only** | If the entry is a quantization of an already-trending model from the same week → demoted to a "quantizations" tail section. |
| **Fork without delta** | Detected via README diff vs the upstream → drop. |
| **Spam handles** | Authors with > 5 trending entries in 24h get demoted (typically aggregators). |

## "Why notable" line

Per surfaced entry, a one-sentence tag based on:

- New architecture, novel training approach, first multi-modal in a domain, etc.
- Significant size / context-window step (`128k`, `1M context`, `100B params`).
- Author affiliation (major lab, prominent independent author).
- License change (e.g. previously non-commercial → commercial).

If no concrete reason exists, the entry says "no clear why — popular but unremarkable".

## Output

```
*HuggingFace Trending — 2026-05-12*

Models (5)
  1. lab/model-name (12k downloads / 24h)
     Why: first open-weight 1M-context model with full attention, not ring/sparse
  2. author/finetune-name (8k)
     Why: domain-specific finetune of llama-4 on medical data, MIT license
  3. team/release-v2 (6k)
     Why: replaces author's prior trending model with a method shift in §2 of the card
  ...

Datasets (3)
  1. lab/corpus-name (3k downloads)
     Why: synthetic dataset with verifiable provenance — first to attach generation logs

Spaces (4)
  1. author/demo-name (4k views)
     Why: live demo of yesterday's HF Papers pick; runs on a single A10
  2. team/tool-name (2k)
     Why: agent-first tool — exposes itself via x402, not just web UI

Quantizations (tail, 4 entries)
  - q/model-q4, q/model-q8, ... (low signal, listed for completeness)
```

## Guidelines

- "Why notable" is a hard requirement. No reason → no surface.
- Cluster quantizations away from headlines; they're useful but they're not the news.
- License flags appear inline (Apache 2.0, MIT, OpenRAIL-M, custom-no-commercial). Operators trading on model output care.
- Spaces section often beats the models section for builder-tier signal — a working demo is a stronger validation than a card claim.

## Pairs with

- `aeon-paper-pick` — yesterday's paper pick often appears as today's space.
- `aeon-deep-research` when a trending entry merits a DD.

## Required keys

None — Hugging Face API is public.
