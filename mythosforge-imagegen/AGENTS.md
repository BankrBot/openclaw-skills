# mythosforge-imagegen — agent instructions

Runtime-agnostic instructions for **Codex, Cursor, and any shell-capable AI agent**.
(Claude Code reads `SKILL.md`; tool-use LLMs read `tool-schema.json`. Same skill, one behavior.)

## What this does

Generate a 2D image from a text prompt. You bring your own Replicate key — no wallet,
no MythosForge account, no payment.

## Setup

- Node 18+ (uses built-in `fetch`; no `npm install`).
- Export your own key: `REPLICATE_API_TOKEN` (https://replicate.com/account/api-tokens).
  Generation is billed to your account.

## Run

```bash
node generate.mjs --prompt "a foggy neon city at dusk" --model flux --aspect landscape
```

- `--prompt` (required, ≤2000 chars)
- `--model` `flux` (default, fast general) | `retro` (pixel-art) | `nano` (2K detail)
- `--aspect` `square` (default) | `landscape` | `portrait`
- `--out <path>` optional; defaults to `out/<model>-<aspect>.<ext>`
- `--dry-run` prints the request without spending or needing a key

## Result

On success, prints one JSON line and writes the image file:

```json
{ "ok": true, "model": "flux-schnell", "aspect": "landscape", "prompt": "...", "path": "/abs/out/...", "bytes": 148213 }
```

Read `path` for the generated image. On failure it prints `{ "ok": false, "error": "..." }` and exits non-zero. Never claim an image exists unless `ok` was `true`.

## For hosted / tool-use LLMs (Bankr LLM, Surplus, OpenAI, Claude API)

Those models can't run a shell themselves. The host harness hands the model
`tool-schema.json` (the `openai` or `anthropic` block), and when the model emits a
`mythosforge_generate_image` tool call, the host runs the `node generate.mjs …`
command above (with `REPLICATE_API_TOKEN` set) and feeds `path` back as the tool result.
