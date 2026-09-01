---
name: mythosforge-3d
description: Convert an image into a 3D model (GLB) via Replicate. The calling agent supplies its own REPLICATE_API_TOKEN — no MythosForge account, wallet, or payment.
license: MIT
---

# mythosforge-3d

Turn an image into a game-ready **3D model (`.glb`)** — **you bring your own key** (the same
`REPLICATE_API_TOKEN` the generators use). Default model = Microsoft **TRELLIS** (MIT-licensed).

> **Read `references/README.md`** for the model map, input mode, output-key extraction, and license
> notes. **Note:** 3D generation can take **minutes** — the CLI polls up to 10 min.

## Prerequisites

- **Node 18+** (built-in `fetch`; no `npm install`).
- **REPLICATE_API_TOKEN** — your own key (https://replicate.com/account/api-tokens). Billed to your account.

## How to run

```bash
REPLICATE_API_TOKEN=xxx node to3d.mjs --image ./sprite.png --out out/model.glb
REPLICATE_API_TOKEN=xxx node to3d.mjs --image ./sprite.png --model ndreca/hunyuan3d-2   # quality alt
node to3d.mjs --image ./sprite.png --dry-run   # print the request, no key, no spend
```

On success it writes the `.glb` and prints one JSON line:

```json
{ "ok": true, "image": "./sprite.png", "model": "firtoz/trellis", "path": "/abs/out/model.glb", "bytes": 1841002 }
```

Read `path`. On failure it prints `{ "ok": false, "error": "..." }` and exits non-zero.

## Options

- `--image <path|url>` — **required**, the source image (local paths sent as a data URI).
- `--out <path>` — output file. Default `out/model.glb`.
- `--model <slug>` — override the Replicate 3D model (default `firtoz/trellis`; alt `ndreca/hunyuan3d-2`).
- `--image-mode array|single` — image input mode for a `--model` not in the built-in map.
- `--output-key <key>` — the named output key holding the GLB for an unmapped `--model`.
- `--dry-run` — print the request that WOULD be sent and exit. Spends nothing, needs no key.

## Required self-report (for gated workflows)

Report the output `path`, `bytes` written, the `model` used, and whether it was a `--dry-run` or a
live call. Do not claim a `.glb` exists unless JSON `ok` was `true`.

## Notes

- MIT wrapper. Runs on **your** Replicate account/key. TRELLIS is MIT; the Hunyuan alt is under a
  Tencent community (non-MIT) license — see `references/`. No model weights redistributed. Chain it
  after `imagegen` (generate a sprite → convert to a 3D asset).
