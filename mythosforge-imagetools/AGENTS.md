# mythosforge-imagetools — agent instructions

Runtime-agnostic instructions for **Codex, Cursor, and any shell-capable AI agent**.
(Claude Code reads `SKILL.md`; tool-use LLMs read `tool-schema.json`. Same skill, one behavior.)

## What this does

Two image utility ops on Replicate: **upscale** (Real-ESRGAN) and **bg-remove** (rembg → transparent
PNG). You bring your own key — no wallet, no MythosForge account, no payment.

**Read `references/README.md`** for the op→model mapping.

## Setup

- Node 18+ (built-in `fetch`; no `npm install`).
- Export `REPLICATE_API_TOKEN` (https://replicate.com/account/api-tokens). Billed to your account.

## Run

```bash
node imagetools.mjs --op upscale   --image ./in.png --scale 4
node imagetools.mjs --op bg-remove --image ./in.png
node imagetools.mjs --op upscale   --image ./in.png --dry-run   # request preview, no key
```

- `--op upscale|bg-remove` (required), `--image <path|url>` (required), `--scale <1..10>` (upscale),
  `--out <path>`, `--model <slug>`

## Result

Prints `{ ok, op, image, path, bytes }` and writes the output file. On failure prints
`{ "ok": false, "error": "..." }` and exits non-zero. Do not claim an output exists unless `ok` was `true`.

## For hosted / tool-use LLMs (Bankr LLM, Surplus, OpenAI, Claude API)

The host hands the model `tool-schema.json` (the `openai` or `anthropic` block); when the model emits
a `mythosforge_imagetools` tool call, the host runs the `node imagetools.mjs …` command above (with
`REPLICATE_API_TOKEN` set) and feeds `path` back as the tool result.
