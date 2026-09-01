---
name: mythosforge-imagetools
description: Upscale or remove the background of an image via Replicate — two utility ops (upscale, bg-remove) in one skill. The calling agent supplies its own REPLICATE_API_TOKEN — no MythosForge account, wallet, or payment.
license: MIT
---

# mythosforge-imagetools

Two image utility ops on Replicate, **you bring your own key** (the same `REPLICATE_API_TOKEN` the
generators use):
- **upscale** — enlarge/enhance an image (Real-ESRGAN).
- **bg-remove** — cut out the background to a transparent PNG (rembg).

> **Read `references/README.md`** for the op→model mapping and how to verify a model slug before use.

## Prerequisites

- **Node 18+** (built-in `fetch`; no `npm install`).
- **REPLICATE_API_TOKEN** — your own key (https://replicate.com/account/api-tokens). Billed to your account.

## How to run

```bash
REPLICATE_API_TOKEN=xxx node imagetools.mjs --op upscale   --image ./in.png --scale 4 --out out/big.png
REPLICATE_API_TOKEN=xxx node imagetools.mjs --op bg-remove --image ./in.png --out out/cutout.png
node imagetools.mjs --op upscale --image ./in.png --dry-run   # print the request, no key, no spend
```

On success it writes the output and prints one JSON line:

```json
{ "ok": true, "op": "upscale", "image": "./in.png", "path": "/abs/out/big.png", "bytes": 482113 }
```

Read `path`. On failure it prints `{ "ok": false, "error": "..." }` and exits non-zero.

## Options

- `--op upscale|bg-remove` — **required**, which operation.
- `--image <path|url>` — **required**, the input image (local paths are sent as a data URI).
- `--scale <1..10>` — upscale factor (upscale op only, default `4`).
- `--out <path>` — output file. Default `out/<op>.png`.
- `--model <slug>` — override the Replicate model slug for the op.
- `--dry-run` — print the request that WOULD be sent and exit. Spends nothing, needs no key.

## Required self-report (for gated workflows)

Report the `op`, the output `path`, `bytes` written, and whether it was a `--dry-run` or a live call.
Do not claim an output exists unless JSON `ok` was `true`.

## Notes

- MIT wrapper. Calls Replicate under *your* account/key; each underlying model carries its own terms.
  No model weights redistributed. Chain it after a generator (imagegen → upscale) or before a gate.
