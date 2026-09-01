---
name: mythosforge-imagegen
description: Generate a 2D image from a text prompt via MythosForge's Replicate-backed engine (flux-schnell, retro-diffusion pixel-art, or nano-banana-2 2K). Use when an agent needs to create an image, concept art, texture, sprite, or reference from a prompt. The calling agent supplies its OWN REPLICATE_API_TOKEN — no MythosForge account, wallet, or payment involved.
license: MIT
---

# mythosforge-imagegen

Generate an image from a prompt using MythosForge's render engine, lifted out of the
Bankr/x402 paywall into a self-contained script. **You bring your own Replicate key.**

## When to use

Any time you need to turn a text prompt into an image file: concept art, textures,
sky/background plates, pixel-art sprites, marketing stills, thumbnails, or an
image-to-3D source.

## Prerequisites

- **Node 18+** (uses the built-in `fetch` — no `npm install`, zero dependencies).
- **A Replicate API token** — get one at https://replicate.com/account/api-tokens
  and export it as `REPLICATE_API_TOKEN`. Generation is billed to *your* Replicate
  account, not MythosForge.

## How to run

Always pass a `--prompt`. Pick a `--model` and `--aspect` for the job:

```bash
REPLICATE_API_TOKEN=r8_xxx node generate.mjs \
  --prompt "a foggy neon city at dusk, cinematic" \
  --model flux \
  --aspect landscape \
  --out out/city.webp
```

On success it writes the image file and prints one JSON line:

```json
{ "ok": true, "model": "flux-schnell", "aspect": "landscape", "prompt": "...", "path": "/abs/out/city.webp", "bytes": 148213 }
```

Read `path` to find the generated image. On any failure it prints `{ "ok": false, "error": "..." }` and exits non-zero.

## Models

| `--model` | Replicate model          | Best for                    | Output |
|-----------|--------------------------|-----------------------------|--------|
| `flux`    | black-forest-labs/flux-schnell | fast general images (default) | webp   |
| `retro`   | retro-diffusion/rd-plus  | pixel-art sprites / tiles   | png    |
| `nano`    | google/nano-banana-2     | high-detail 2K images       | png    |

## Options

- `--prompt "..."` — **required**, max 2000 chars.
- `--model flux|retro|nano` — default `flux`. (Full slugs like `flux-schnell` also accepted.)
- `--aspect square|landscape|portrait` — default `square`.
- `--out <path>` — output file path. Default `out/<model>-<aspect>.<ext>`.
- `--dry-run` — print the exact Replicate request that WOULD be sent and exit. Spends nothing, needs no token. Use this to self-verify before generating.

## Required self-report (for gated workflows)

After running, report: the `--model`/`--aspect` used, the output `path`, `bytes`
written, and whether it was a `--dry-run` or a live generation. Do not claim an
image exists unless the JSON `ok` was `true` and the file was written.

## Notes

- MIT-licensed wrapper. It calls Replicate's hosted API under *your* account/key;
  each underlying model (flux-schnell / rd-plus / nano-banana-2) carries its own
  Replicate model terms, which are your responsibility as the key holder.
- No model weights are redistributed here — only the thin API-calling wrapper.
