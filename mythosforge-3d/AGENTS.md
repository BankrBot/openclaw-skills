# mythosforge-3d — agent instructions

Runtime-agnostic instructions for **Codex, Cursor, and any shell-capable AI agent**.
(Claude Code reads `SKILL.md`; tool-use LLMs read `tool-schema.json`. Same skill, one behavior.)

## What this does

Convert an image into a 3D model (`.glb`) via Replicate (default Microsoft TRELLIS, MIT). You bring
your own key — no wallet, no MythosForge account. **3D gen can take minutes.**

**Read `references/README.md`** for the model map + the output-key extraction (3D outputs are objects,
not bare URLs).

## Setup

- Node 18+ (built-in `fetch`; no `npm install`).
- Export `REPLICATE_API_TOKEN` (https://replicate.com/account/api-tokens). Billed to your account.

## Run

```bash
node to3d.mjs --image ./sprite.png
node to3d.mjs --image ./sprite.png --model ndreca/hunyuan3d-2
node to3d.mjs --image ./sprite.png --dry-run   # request preview, no key
```

- `--image <path|url>` (required), `--out <path.glb>`, `--model <slug>`, `--image-mode array|single`,
  `--output-key <key>` (the last two only for an unmapped `--model`)

## Result

Prints `{ ok, image, model, path, bytes }` and writes the `.glb`. On failure prints
`{ "ok": false, "error": "..." }` and exits non-zero. Do not claim a `.glb` exists unless `ok` was `true`.

## For hosted / tool-use LLMs (Bankr LLM, Surplus, OpenAI, Claude API)

The host hands the model `tool-schema.json` (the `openai` or `anthropic` block); when the model emits
a `mythosforge_3d` tool call, the host runs the `node to3d.mjs …` command above (with
`REPLICATE_API_TOKEN` set) and feeds `path` back as the tool result.
