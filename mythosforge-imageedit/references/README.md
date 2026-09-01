# references/ — mythosforge-imageedit

**Op → Replicate model mapping** (in `imageedit.mjs`, `OPS`):

| `--op`    | model slug                          | input fields                          | output |
|-----------|-------------------------------------|---------------------------------------|--------|
| `edit`    | `black-forest-labs/flux-kontext-pro`| `{ prompt, input_image, output_format }` | png |
| `inpaint` | `black-forest-labs/flux-fill-pro`   | `{ prompt, image, mask, output_format }` | png |

**Endpoint (community-model-safe, reused from `imagetools`):** resolve the version first —
`GET /v1/models/<slug>` → `latest_version.id` → `POST /v1/predictions { version, input }` — which
works for both official and community models. Then poll with `Prefer: wait` and download the output URL.

**Verify slugs + input field names before relying on them.** Flux Kontext/Fill are Black Forest Labs
models; confirm the current slug + exact input keys (`input_image` vs `image`, mask field name) from
`https://replicate.com/<owner>/<model>/llms.txt` — don't guess. Swap either op's model with
`--model <slug>` (and match its input keys) without editing code.

**License note:** `flux-kontext-pro` and `flux-fill-pro` are **commercial, per-call** models on
Replicate — billed to the key holder's account. The MIT wrapper redistributes no weights; usage of
each model is governed by its own Replicate terms, which are the key holder's responsibility.

**Design note:** imageedit is a *transform* step, not a generator — it operates on an existing image
(from `imagegen`, or any source). Chain: `imagegen → imageedit --op edit` to iterate, or `--op inpaint`
to fix a region, then feed the result to `lookgate` if gating.
