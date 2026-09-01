# MythosForge image gen — Replicate API reference

Auth: `Authorization: Bearer $REPLICATE_API_TOKEN` on every request.

This skill uses Replicate's **official-model predictions** endpoint
(`POST /v1/models/<owner>/<model>/predictions`), which runs a model by name
without pinning a version hash. The prediction lifecycle, headers, polling, and
error handling are identical across models — only the `input` schema and the
output shape differ. The three supported models and their schemas are below;
all were verified from each model's `llms.txt` on Replicate.

## flux-schnell — `POST /v1/models/black-forest-labs/flux-schnell/predictions`

Create a prediction (one image).

Full URL:
`https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions`

### Headers

| Header          | Value                          | Notes                                                       |
| --------------- | ------------------------------ | ----------------------------------------------------------- |
| `Authorization` | `Bearer $REPLICATE_API_TOKEN`  | Required.                                                   |
| `Content-Type`  | `application/json`             | Required.                                                   |
| `Prefer`        | `wait`                         | Block up to ~60s so the response is usually already done.   |

### Request body — `input` fields

| Field            | Type    | Notes                                                  |
| ---------------- | ------- | ------------------------------------------------------ |
| `prompt`         | string  | The text description (required).                       |
| `num_outputs`    | integer | Number of images (this skill uses `1`).                |
| `aspect_ratio`   | string  | `1:1` (square), `16:9` (landscape), `3:4` (portrait).  |
| `output_format`  | string  | `webp` (default), `png`, or `jpg`.                     |
| `output_quality` | integer | 0–100 (this skill uses `85`).                          |
| `go_fast`        | boolean | `true` → fastest path for Schnell.                     |

### Example

```bash
curl -sS -X POST \
  "https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions" \
  -H "Authorization: Bearer $REPLICATE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Prefer: wait" \
  -d '{
    "input": {
      "prompt": "a neon cyberpunk fox, glowing eyes, rain",
      "num_outputs": 1,
      "aspect_ratio": "1:1",
      "output_format": "webp",
      "output_quality": 85,
      "go_fast": true
    }
  }'
```

### Response (prediction object)

```json
{
  "id": "abc123",
  "status": "succeeded",
  "output": ["https://replicate.delivery/.../out-0.webp"],
  "urls": { "get": "https://api.replicate.com/v1/predictions/abc123", "cancel": "..." },
  "error": null
}
```

- `output` is an **array of image URLs** (take `output[0]`). On some models it
  can be a single string — handle both.
- `status` is one of `starting`, `processing`, `succeeded`, `failed`,
  `canceled`.

## nano-banana-2 — `POST /v1/models/google/nano-banana-2/predictions`

High-quality general model (Google). Same headers/lifecycle as above.

### Request body — `input` fields

| Field           | Type    | Notes                                                                 |
| --------------- | ------- | --------------------------------------------------------------------- |
| `prompt`        | string  | The text description (required).                                      |
| `aspect_ratio`  | string  | `1:1`, `3:4`, `4:3`, `16:9`, `9:16`, … (`match_input_image` also valid). |
| `resolution`    | string  | `512px`, `1K`, `2K`, `4K` (this skill uses `2K`).                      |
| `output_format` | string  | `jpg` (default) or `png` — **no webp** (skill coerces webp→png).       |
| `image_input`   | array   | Optional reference images (unused here).                              |

> Output is a **single URL string** in `output` (not an array). `generate.sh`
> handles both array and string.

## retro-diffusion — `POST /v1/models/retro-diffusion/rd-plus/predictions`

Pixel-art / game-asset model. Same headers/lifecycle as above.

### Request body — `input` fields

| Field      | Type    | Notes                                                                       |
| ---------- | ------- | --------------------------------------------------------------------------- |
| `prompt`   | string  | The text description (required).                                            |
| `style`    | string  | enum incl. `default`, `retro`, `cartoon`, `item_sheet`, `isometric`, `topdown_map`, … (skill uses `default`). |
| `width`    | integer | Pixel width (skill maps aspect → 256 / 384).                                |
| `height`   | integer | Pixel height (skill maps aspect → 256 / 384).                               |
| `remove_bg`| boolean | Optional transparent background (unused here).                              |
| `tile_x` / `tile_y` | boolean | Optional seamless tiling (unused here).                             |

> No `aspect_ratio` field — set `width`/`height` directly. Output is an **array
> of URLs**; always PNG.

## Prediction lifecycle (polling)

With `Prefer: wait` the first response is usually `succeeded`. If it's still
`starting`/`processing`, poll `urls.get` until terminal:

```bash
curl -sS "https://api.replicate.com/v1/predictions/<id>" \
  -H "Authorization: Bearer $REPLICATE_API_TOKEN"
```

Stop on `succeeded` (read the output URL), or fail on `failed` / `canceled`
(read `error`). `generate.sh` polls up to 30× at 2s intervals, then treats it as
a timeout and exits non-zero.

> ⚠️ Output URLs on `replicate.delivery` are **temporary** (they expire, often
> within ~1h). Download the bytes to a file or re-host them immediately — don't
> store the raw URL as if it were permanent. `generate.sh` downloads on success.

### Common errors

Non-2xx responses carry a JSON body with `detail` / `title` — e.g. `401`
(bad/missing token), `402` (payment/credits), `422` (invalid input).
`generate.sh` treats any non-2xx as a hard failure and writes no file.
