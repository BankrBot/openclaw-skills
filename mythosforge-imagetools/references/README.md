# references/ — mythosforge-imagetools

**Op → Replicate model mapping** (in `imagetools.mjs`, `OPS`):

| `--op`      | model slug                | input fields                    | output |
|-------------|---------------------------|---------------------------------|--------|
| `upscale`   | `nightmareai/real-esrgan` | `{ image, scale, face_enhance }`| png    |
| `bg-remove` | `cjwbw/rembg`             | `{ image }`                     | png    |

**Endpoint (community-model-safe):** both are **community** models (individual usernames), so the
no-version `POST /v1/models/<slug>/predictions` endpoint (used by imagegen's *official* models) is
**not** reliable here. imagetools instead resolves the version first —
`GET /v1/models/<owner>/<name>` → `latest_version.id` → `POST /v1/predictions { version, input }` —
which works for **both** official and community models. Then it polls with `Prefer: wait` and
downloads the output URL. (Reuse this `resolveVersion()` pattern for any future community-model skill.)

**Verify a slug before relying on it.** Replicate renames/retires community models; confirm the
current slug + input schema from `https://replicate.com/<owner>/<model>/llms.txt` (don't guess
fields). Swap either op's model at the CLI with `--model <slug>` without editing code.

**Optional bg-remove upgrade (license caveat):** `cjwbw/rembg` (U2-Net) can degrade on hair/fine
detail. **RMBG-2.0 (BRIA)** is higher quality but is **non-commercial without a BRIA license**, so it
is deliberately NOT the default in this MIT tool. Use it only if your use qualifies, via
`--model <its-slug>` — the license is your responsibility as the key holder.

**Design note:** imagetools is a *post-process* utility, not a generator — it operates on an existing
image (from `imagegen`, or any source). Chain it: `imagegen → imagetools --op upscale` for hero-res,
or `--op bg-remove` for a game-ready sprite cutout, then feed the result to `lookgate` if gating.
