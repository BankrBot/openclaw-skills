# references/ — mythosforge-video

**Models + the image-input field map** (in `video.mjs`, `MODELS`):

| slug (default = seedance) | image-input field   | notes                                  | output |
|---------------------------|---------------------|----------------------------------------|--------|
| `bytedance/seedance-2.0`  | `image`             | **default** — cheap/fast (~$0.022/s), `resolution` 480p/720p, `duration` int (`-1`=auto) | mp4 |
| `minimax/hailuo-2.3`      | `first_frame_image` | quality alt, up to 1080p; 1080p→6s only, 10s→768p only | mp4 |

**⚠️ Video models do NOT share a uniform image-input field.** seedance=`image`,
hailuo=`first_frame_image`, others use `start_image` / `image_url`. So `--image` cannot forward to a
hardcoded key across `--model` swaps. `video.mjs` keeps the per-model map above; for a `--model` not
listed, image-to-video requires `--image-field <key>` (confirm it from the model's `llms.txt`).
**Text→video is uniform** (`prompt` only), so it works with any video model regardless.

**Endpoint (community-model-safe, reused):** `GET /v1/models/<slug>` → `latest_version.id` →
`POST /v1/predictions { version, input }`, then poll and download. **Timeout is 600s (10 min)** —
video gen is far slower than images; a shorter cap false-times-out on legit renders.

**Verify slug + input keys from `https://replicate.com/<owner>/<model>/llms.txt` before relying on
them** — video model APIs drift/rename more often than image models.

**`--model` upgrade menu** (verify fields per model; note the image field differs):
- `google/veo-3.1-fast` — quality + native audio (~$0.10/s)
- `kwaivgi/kling-v3-omni-video` — high fidelity + audio
- `wan-video/wan-2.5-t2v` — open weights

**License note:** these are **commercial, per-call** models billed to the key holder's account. The
MIT wrapper redistributes no weights; each model's use is governed by its own Replicate terms.

**Design note:** chain after `imagegen` — generate a still, then pass it as `--image` (image-to-video),
or go straight text→video.
