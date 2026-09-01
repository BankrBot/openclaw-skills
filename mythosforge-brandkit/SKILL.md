---
name: mythosforge-brandkit
description: Extract (from a reference image, via Gemini vision) or author a reusable brand/style token (brandkit.json) — palette, typography, feel words, prompt_suffix — that every generator + lookgate share for one consistent visual identity. Extract mode uses the caller's own GEMINI_API_KEY; author mode needs no key. No MythosForge account, wallet, or payment.
license: MIT
---

# mythosforge-brandkit

The **DIRECT** layer: distill a reusable **style token** once, then feed it into every generator's
prompt (`imagegen`, `pixelart`, `deck`, …) and into `lookgate`'s palette check — so a user's outputs
share ONE consistent visual identity instead of each rolling a random look.

> **Read `references/brandkit-schema.md` before running.** It is the style-token schema this skill
> emits (owner: shiro), and which the generators + lookgate consume.

## Two modes

- **extract** (vision): `GEMINI_API_KEY=xxx node brandkit.mjs --from ref.png` → Gemini reads the reference → style token.
- **author** (no key): `node brandkit.mjs --author [--in partial.json]` → validate/fill a hand-written token.

Output is a portable `brandkit.json` other skills load via `--theme brandkit.json` (and `lookgate`
via `--palette brandkit.json`) — that's the **brandkit → generate → lookgate** closed loop on one token.

## Prerequisites

- **Node 18+** (built-in `fetch`; no `npm install`).
- **GEMINI_API_KEY** (or `BRANDKIT_API_KEY`) — **extract mode only**; default provider is Google
  Gemini vision (https://aistudio.google.com/apikey). Set `BRANDKIT_BASE_URL`/`BRANDKIT_MODEL` for any
  other OpenAI-compatible vision endpoint. **Author mode needs no key.**

## How to run

```bash
# extract a theme from a reference image
GEMINI_API_KEY=xxx node brandkit.mjs --from ./reference.png --name dusk-neon --out brandkit.json

# author / validate a hand-written token (no key)
node brandkit.mjs --author --in partial.json --out brandkit.json

# keyless previews
node brandkit.mjs --schema                      # print the style-token schema
node brandkit.mjs --from ./ref.png --dry-run    # print the composed request
```

On success it writes `brandkit.json` and prints `{ ok, mode, name, path, token }`. On failure it
prints `{ "ok": false, "error": "..." }` and exits non-zero.

## Options

- `--from <path|url>` — extract mode: the reference image.
- `--author` — author mode (mutually exclusive with `--from`). `--in <partial.json>` fills from a partial token.
- `--name <name>` — override the token name.
- `--out <path>` — output file (default `brandkit.json`).
- `--model` / `--base-url` / `--auth bearer|x-api-key` — target a specific vision endpoint (extract mode).
- `--dry-run` (print request, no key) · `--schema` (print token schema, no key).

## Required self-report (for gated workflows)

Report the `mode` (extract/author), the token `name`, the `path` written, and whether it was a
`--dry-run`. Do not claim a token exists unless `ok` was `true`.

## Notes

- MIT wrapper. Extract mode calls the vision endpoint under *your* account/key. The emitted token is
  normalized to a complete, well-formed shape (missing fields defaulted) so downstream skills can rely
  on it. No model weights redistributed.
