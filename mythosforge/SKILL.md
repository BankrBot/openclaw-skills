---
name: mythosforge
description: MythosForge image generation — create an image from a text prompt via Replicate. Use when the user wants to generate an image, illustration, artwork, avatar, banner, scene, concept art, or pixel-art / game asset from a description — e.g. "make an image of a neon cyberpunk fox", "generate a banner for my token", "pixel-art sprite of a knight". Choose a model with --model: flux-schnell (default, fast/general), nano-banana-2 (high-quality, general), or retro-diffusion (pixel-art / game assets). Supports square / landscape / portrait and webp/png/jpg. Returns an image file. Requires a Replicate API token (REPLICATE_API_TOKEN).
metadata:
  {
    "clawdbot":
      {
        "emoji": "🖼️",
        "homepage": "https://www.mythosforge.xyz",
        "requires":
          { "bins": ["bash", "curl", "jq"], "env": ["REPLICATE_API_TOKEN"] },
      },
  }
---

## Overview

This is **MythosForge's image-generation skill** — turn a text prompt into an
image. Its default engine is the exact one MythosForge
([mythosforge.xyz](https://www.mythosforge.xyz)) uses in production: **Flux
Schnell** on [Replicate](https://replicate.com). It also exposes two more
Replicate models through one `--model` flag, so you can pick the right engine
for the job:

| `--model`         | Replicate model                   | Best for                          | Formats   |
| ----------------- | --------------------------------- | --------------------------------- | --------- |
| `flux-schnell` ⭐  | `black-forest-labs/flux-schnell`  | fast, general (default)           | webp/png/jpg |
| `nano-banana-2`   | `google/nano-banana-2`            | high-quality, general (2K)        | png/jpg   |
| `retro-diffusion` | `retro-diffusion/rd-plus`         | pixel-art / game assets           | png       |

Bankr's own LLM gateway is text-only, so image generation runs through this
dedicated provider, mirroring MythosForge's production call pattern.

## Getting Started

### 1. Get a Replicate API token

Create one at
[replicate.com/account/api-tokens](https://replicate.com/account/api-tokens).
Replicate uses Bearer auth and bills per prediction.

### 2. Export the token

```bash
export REPLICATE_API_TOKEN="r8_your_token"
```

Keep it in an environment variable — **never hardcode it**, and add your
`.env` to `.gitignore`.

### 3. Generate an image

```bash
./scripts/generate.sh "a neon cyberpunk fox, glowing eyes, rain"
# → ✓ wrote mythosforge-20260605-201500.webp (model: flux-schnell, square, webp, prompt: "a neon cyberpunk fox, ...")
```

## Usage

```
scripts/generate.sh "<prompt>" [options]

Options:
  -m, --model NAME    flux-schnell | nano-banana-2 | retro-diffusion
                      (default: flux-schnell — MythosForge's production default)
  -o, --out FILE      Output image path (default: mythosforge-<timestamp>.<ext>)
  -a, --aspect RATIO  square | landscape | portrait  (default: square)
  -f, --format FMT    webp | png | jpg               (default: webp; coerced per model)
  -h, --help          Show help
```

### Examples

```bash
# Default (Flux Schnell): landscape banner as PNG
./scripts/generate.sh "epic fantasy castle at sunset" -a landscape -f png -o banner.png

# High-quality general image (Nano Banana 2)
./scripts/generate.sh "portrait of a cyber-samurai" -m nano-banana-2 -a portrait -o avatar.png

# Pixel-art game asset (Retro Diffusion)
./scripts/generate.sh "pixel-art knight with a sword" -m retro-diffusion -o knight.png
```

## How it works

`generate.sh` selects the chosen model's Replicate endpoint
(`https://api.replicate.com/v1/models/<owner>/<model>/predictions`), builds that
model's input body (each model has its own schema — see references), POSTs with
`Prefer: wait` (so the prediction usually completes in one call), polls
`urls.get` if it's still processing, then downloads the resulting image URL to a
file. Output is a URL array (flux / retro-diffusion) or a single URL
(nano-banana-2) — both are handled. It is **fail-closed**: a missing token, a
non-2xx status, a `failed` / `canceled` prediction, a timeout, or an empty
download all exit non-zero with a clear message and leave no partial file.

See [`references/image-gen-api.md`](references/image-gen-api.md) for
the exact request/response shape and the prediction lifecycle.

## Notes & limits

- **Pick the model for the job.** `flux-schnell` / `nano-banana-2` for general
  images; `retro-diffusion` for pixel-art and game assets.
- **Aspect handling.** flux & nano-banana-2 use `aspect_ratio`; retro-diffusion
  has no aspect ratio, so square/landscape/portrait map to pixel canvas sizes
  (256×256 / 384×256 / 256×384).
- **Format.** `nano-banana-2` outputs png/jpg only (webp is coerced to png);
  `retro-diffusion` always outputs png.
- **Cost.** Each generation is a billed Replicate prediction (nano-banana-2 at
  2K costs more than flux-schnell).
- **Determinism.** Output varies per run; refine the prompt for control.
- **Requires** `bash`, `curl`, and `jq` on PATH.
