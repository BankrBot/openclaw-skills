---
name: mythosforge-video
description: Generate a short video from a text prompt, optionally image-to-video from a first frame, via Replicate. The calling agent supplies its own REPLICATE_API_TOKEN — no MythosForge account, wallet, or payment.
license: MIT
---

# mythosforge-video

Generate a short video from a text prompt — **you bring your own key** (the same
`REPLICATE_API_TOKEN` the generators use). Pass a `--image` first frame to do image-to-video.

> **Read `references/README.md`** for the model, input fields, and how to verify/override the slug.
> **Note:** video generation can take **minutes** — the CLI polls up to 10 min.

## Prerequisites

- **Node 18+** (built-in `fetch`; no `npm install`).
- **REPLICATE_API_TOKEN** — your own key (https://replicate.com/account/api-tokens). Billed to your account.

## How to run

```bash
REPLICATE_API_TOKEN=xxx node video.mjs --prompt "a slow drone shot over a foggy neon city at dusk" --out out/clip.mp4
REPLICATE_API_TOKEN=xxx node video.mjs --prompt "camera pushes in, gentle parallax" --image ./first.png --out out/clip.mp4
node video.mjs --prompt "..." --dry-run   # print the request, no key, no spend
```

On success it writes the `.mp4` and prints one JSON line:

```json
{ "ok": true, "prompt": "...", "image": null, "path": "/abs/out/clip.mp4", "bytes": 2841100 }
```

Read `path`. On failure it prints `{ "ok": false, "error": "..." }` and exits non-zero.

## Options

- `--prompt "..."` — **required**, the video description / motion instruction (max 4000 chars).
- `--image <path|url>` — optional first-frame image → image-to-video (local paths sent as a data URI).
- `--image-field <key>` — image-input field for a `--model` not in the built-in map (e.g. `image`, `first_frame_image`, `start_image`).
- `--duration <n>` / `--resolution <e.g. 720p>` — optional model params (only sent when provided).
- `--out <path>` — output file. Default `out/video.mp4`.
- `--model <slug>` — override the Replicate video model slug (default `bytedance/seedance-2.0`).
- `--dry-run` — print the request that WOULD be sent and exit. Spends nothing, needs no key.

**Note on `--image` + `--model`:** video models don't share a uniform image field (seedance=`image`,
hailuo=`first_frame_image`). The built-in models are mapped; for another `--model`, pass `--image-field`.

## Required self-report (for gated workflows)

Report the output `path`, `bytes` written, whether an `--image` first frame was used, and whether it
was a `--dry-run` or a live call. Do not claim an output exists unless JSON `ok` was `true`.

## Notes

- MIT wrapper. Calls Replicate under *your* account/key; the video model is commercial per-call and
  carries its own terms. No model weights redistributed. Chain it after `imagegen`
  (generate a still → use it as the `--image` first frame).
