# references/ — mythosforge-3d

**Models + per-model config** (in `to3d.mjs`, `MODELS`) — TWO things differ across 3D models:

| slug (default = trellis) | image input mode | output GLB key | license               | output |
|--------------------------|------------------|----------------|-----------------------|--------|
| `firtoz/trellis`         | `images: [ref]` (ARRAY) | `model_file` | **MIT** (default — cleanest for an MIT tool) | glb |
| `ndreca/hunyuan3d-2`     | `image: ref` (string)   | `mesh`       | Tencent community (non-MIT) | glb |

**⚠️ THE GOTCHA — output is an OBJECT with a named key, NOT a bare string/array.** TRELLIS returns
`{ model_file: <glb>, color_video, gaussian_ply, ... }`; Hunyuan returns `{ mesh: <glb> }`. A plain
string/array URL picker returns **null on a *successful* render** → "no URL" even though it worked,
and the keyless dry-run can't see it. `to3d.mjs`'s `pickGlb()` extracts the named key first, then
falls back to scanning the object for a `.glb` uri (so an unmapped `--model` still works if it emits one).

**Input mode also differs** — TRELLIS wants an **array** (`images: [ref]`), Hunyuan a **string**
(`image: ref`). `buildInput()` handles both via the per-model `imageMode`. For a `--model` not in the
map, pass `--image-mode array|single` and `--output-key <key>`.

**Endpoint (community-model-safe, reused):** both are community models →
`GET /v1/models/<slug>` → `latest_version.id` → `POST /v1/predictions { version, input }`, then poll
(600s; 3D is slow) and download the GLB. Output ext = **`.glb`**.

**Verify slug + input/output keys from `https://replicate.com/<owner>/<model>/llms.txt`** before
relying on them.

**License note:** `firtoz/trellis` (Microsoft TRELLIS) is **MIT** → safe MIT default.
`ndreca/hunyuan3d-2` (Tencent) is under a **community, non-commercial-leaning license** → kept as a
non-default `--model` upgrade; usage is the key holder's responsibility. The MIT wrapper redistributes
no weights.

**Design note:** chain after `imagegen` — generate a clean sprite/concept, then convert it to a
game-ready 3D asset (2D → 3D pipeline, no human).
