---
name: aeon-huggingface-trending
description: |
  Trending Hugging Face models, datasets, and spaces — filtered by license sanity, dedup vs same-week
  quantizations, with a "why notable" line per pick (architecture shift, size step, license change,
  notable author). Surfaces what's actually shifting rather than just popular.
  Triggers: "trending on HF", "what models are hot", "huggingface trending", "new spaces today",
  "best new datasets".
---

# aeon-huggingface-trending

Daily filtered scan over HF's three trending surfaces — models, datasets, spaces — cluster-ranked rather than raw-download ranked.

## Endpoints

```bash
curl -s "https://huggingface.co/api/models?sort=trending&direction=-1&limit=30"
curl -s "https://huggingface.co/api/datasets?sort=trending&direction=-1&limit=30"
curl -s "https://huggingface.co/api/spaces?sort=trending&direction=-1&limit=30"
```

## Filters

- Empty repos, no commits, no model card → drop.
- Same-week quantization of an already-trending model → demoted to "Quantizations" tail.
- Fork without README delta vs upstream → drop.
- Authors with > 5 trending entries in 24h → demoted (typically aggregators).
- License unclear or missing → flagged inline, not dropped.

## "Why notable" line

Per surfaced entry, a one-sentence tag: new architecture / size step / context-window jump / notable author affiliation / license change. If no concrete reason exists, the entry says "no clear why — popular but unremarkable" rather than inventing one.

## Output

Three sections — Models, Datasets, Spaces — each with the surviving picks, "why notable", license, and download/view count. Tail section for quantizations.

## Rules

- "Why notable" is a hard requirement. No reason → no surface.
- License flags appear inline (Apache 2.0, MIT, OpenRAIL-M, custom-no-commercial). Operators trading on model output care.
- Spaces section often beats Models for builder-tier signal — a working demo is stronger validation than a card claim.
