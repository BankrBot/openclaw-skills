---
name: mythosforge-promptpack
description: Compose a generator-ready prompt from a curated recipe library, optionally themed with a brandkit token. No API key, no network — pure composition. The bridge from brandkit to the generators; feed its output to mythosforge-imagegen and friends.
license: MIT
---

# mythosforge-promptpack

Pick a recipe, drop in your subject, get a generator-ready prompt — **no API key, no network.**
Optionally fold in a `brandkit.json` so the prompt stays on-theme. This is the bridge from
`brandkit` → the generators.

> **Read `references/README.md`** for how the recipe library is curated. Recipes are plain data
> (`recipes.json`) — pass your own with `--recipes <file>`.

## Prerequisites

- **Node 18+** (no `npm install`, zero dependencies). **No key required.**

## How to run

```bash
node promptpack.mjs --list                                        # see available recipes
node promptpack.mjs --recipe neon-noir --subject "a lone fox"     # compose a prompt
node promptpack.mjs --recipe pixel-sprite --subject "a mushroom" --theme brandkit.json --out prompt.json
node promptpack.mjs --schema                                      # recipe schema
```

On success it prints:

```json
{ "ok": true, "recipe": "neon-noir", "prompt": "a lone fox, neon noir, rain-slick streets, ...",
  "model": "flux", "aspect": "landscape", "negative": "flat, daytime, ..." }
```

Feed `prompt` (+ `model` + `aspect`) straight into a generator, e.g.
`node ../mythosforge-imagegen/generate.mjs --prompt "<prompt>" --model <model> --aspect <aspect>`.
On failure it prints `{ "ok": false, "error": "..." }` and exits non-zero.

## Options

- `--list` — list recipes (id / title / model / aspect).
- `--recipe <id>` + `--subject "..."` — compose a prompt from that recipe.
- `--theme <brandkit.json>` — fold in a brandkit token: `feel_words` + `prompt_suffix` append to the
  prompt, `anti_feel` merges into `negative`. (This is the **brandkit → promptpack → generate** hop.)
- `--recipes <file>` — use a custom recipe library instead of the bundled `recipes.json`.
- `--out <path>` — also write the composed prompt JSON.
- `--schema` — print the recipe schema.

## Required self-report (for gated workflows)

Report the `recipe` used, the resulting `model`/`aspect`, and whether a `--theme` was applied. The
composed prompt is deterministic — no key, no network.

## Notes

- MIT. Pure composition — no model calls, nothing billed. Recipes are open data; curate freely.
