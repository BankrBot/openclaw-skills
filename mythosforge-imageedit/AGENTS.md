# mythosforge-imageedit — agent instructions

Runtime-agnostic instructions for **Codex, Cursor, and any shell-capable AI agent**.
(Claude Code reads `SKILL.md`; tool-use LLMs read `tool-schema.json`. Same skill, one behavior.)

## What this does

Two edit ops on an input image via Replicate: **edit** (instruction img2img, Flux Kontext) and
**inpaint** (masked fill, Flux Fill). You bring your own key — no wallet, no MythosForge account.

**Read `references/README.md`** for the op→model mapping + input fields.

## Setup

- Node 18+ (built-in `fetch`; no `npm install`).
- Export `REPLICATE_API_TOKEN` (https://replicate.com/account/api-tokens). Billed to your account.

## Run

```bash
node imageedit.mjs --op edit    --image ./in.png --prompt "make it snowy"
node imageedit.mjs --op inpaint --image ./in.png --mask ./mask.png --prompt "a red door"
node imageedit.mjs --op edit    --image ./in.png --prompt "..." --dry-run   # request preview, no key
```

- `--op edit|inpaint` (required), `--image <path|url>` (required), `--prompt "..."` (required),
  `--mask <path|url>` (inpaint), `--out <path>`, `--model <slug>`

## Result

Prints `{ ok, op, image, path, bytes }` and writes the output file. On failure prints
`{ "ok": false, "error": "..." }` and exits non-zero. Do not claim an output exists unless `ok` was `true`.

## For hosted / tool-use LLMs (Bankr LLM, Surplus, OpenAI, Claude API)

The host hands the model `tool-schema.json` (the `openai` or `anthropic` block); when the model emits
a `mythosforge_imageedit` tool call, the host runs the `node imageedit.mjs …` command above (with
`REPLICATE_API_TOKEN` set) and feeds `path` back as the tool result.
