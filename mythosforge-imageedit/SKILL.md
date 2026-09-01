---
name: mythosforge-imageedit
description: Edit an image with a prompt (instruction img2img) or inpaint a masked region, via Replicate. The calling agent supplies its own REPLICATE_API_TOKEN — no MythosForge account, wallet, or payment.
license: MIT
---

# mythosforge-imageedit

Two edit ops on an input image, **you bring your own key** (the same `REPLICATE_API_TOKEN` the
generators use):
- **edit** — instruction img2img: transform an image with a prompt (Flux Kontext).
- **inpaint** — fill a masked region with a prompt (Flux Fill).

> **Read `references/README.md`** for the op→model mapping, input fields, and how to verify/override a slug.

## Prerequisites

- **Node 18+** (built-in `fetch`; no `npm install`).
- **REPLICATE_API_TOKEN** — your own key (https://replicate.com/account/api-tokens). Billed to your account.

## How to run

```bash
REPLICATE_API_TOKEN=xxx node imageedit.mjs --op edit    --image ./in.png --prompt "make it snowy at dusk" --out out/edit.png
REPLICATE_API_TOKEN=xxx node imageedit.mjs --op inpaint --image ./in.png --mask ./mask.png --prompt "a red wooden door" --out out/fix.png
node imageedit.mjs --op edit --image ./in.png --prompt "..." --dry-run   # print the request, no key, no spend
```

On success it writes the output and prints one JSON line:

```json
{ "ok": true, "op": "edit", "image": "./in.png", "path": "/abs/out/edit.png", "bytes": 391244 }
```

Read `path`. On failure it prints `{ "ok": false, "error": "..." }` and exits non-zero.

## Options

- `--op edit|inpaint` — **required**, which operation.
- `--image <path|url>` — **required**, the input image (local paths are sent as a data URI).
- `--prompt "..."` — **required**, the edit instruction (max 2000 chars).
- `--mask <path|url>` — **required for inpaint**; white marks the area to fill.
- `--out <path>` — output file. Default `out/<op>.png`.
- `--model <slug>` — override the Replicate model slug for the op.
- `--dry-run` — print the request that WOULD be sent and exit. Spends nothing, needs no key.

## Required self-report (for gated workflows)

Report the `op`, the output `path`, `bytes` written, and whether it was a `--dry-run` or a live call.
Do not claim an output exists unless JSON `ok` was `true`.

## Notes

- MIT wrapper. Calls Replicate under *your* account/key; each underlying model carries its own terms
  (Flux Kontext/Fill Pro are commercial per-call models). No model weights redistributed. Chain it
  after `imagegen` (generate → edit) or before `lookgate`.
