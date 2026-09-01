# mythosforge-video — agent instructions

Runtime-agnostic instructions for **Codex, Cursor, and any shell-capable AI agent**.
(Claude Code reads `SKILL.md`; tool-use LLMs read `tool-schema.json`. Same skill, one behavior.)

## What this does

Generate a short video from a text prompt via Replicate (pass `--image` for image-to-video from a
first frame). You bring your own key — no wallet, no MythosForge account. **Video gen can take minutes.**

**Read `references/README.md`** for the model + input fields.

## Setup

- Node 18+ (built-in `fetch`; no `npm install`).
- Export `REPLICATE_API_TOKEN` (https://replicate.com/account/api-tokens). Billed to your account.

## Run

```bash
node video.mjs --prompt "a drone shot over a neon city"
node video.mjs --prompt "camera pushes in" --image ./first.png
node video.mjs --prompt "..." --dry-run   # request preview, no key
```

- `--prompt "..."` (required), `--image <path|url>` (optional first frame), `--out <path>`, `--model <slug>`

## Result

Prints `{ ok, prompt, image, path, bytes }` and writes the `.mp4`. On failure prints
`{ "ok": false, "error": "..." }` and exits non-zero. Do not claim an output exists unless `ok` was `true`.

## For hosted / tool-use LLMs (Bankr LLM, Surplus, OpenAI, Claude API)

The host hands the model `tool-schema.json` (the `openai` or `anthropic` block); when the model emits
a `mythosforge_video` tool call, the host runs the `node video.mjs …` command above (with
`REPLICATE_API_TOKEN` set) and feeds `path` back as the tool result.
