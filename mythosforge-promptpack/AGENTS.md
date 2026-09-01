# mythosforge-promptpack — agent instructions

Runtime-agnostic instructions for **Codex, Cursor, and any shell-capable AI agent**.
(Claude Code reads `SKILL.md`; tool-use LLMs read `tool-schema.json`. Same skill, one behavior.)

## What this does

Compose a generator-ready prompt from a curated recipe library, optionally themed with a
`brandkit.json`. **No API key, no network** — pure composition. The bridge from `brandkit` → the
generators.

## Setup

- Node 18+ (no `npm install`, zero dependencies). **No key required.**

## Run

```bash
node promptpack.mjs --list
node promptpack.mjs --recipe neon-noir --subject "a lone fox"
node promptpack.mjs --recipe pixel-sprite --subject "a mushroom" --theme brandkit.json --out prompt.json
node promptpack.mjs --schema
```

- `--list` | `--recipe <id>` + `--subject "..."` | `--theme <brandkit.json>` | `--recipes <file>` | `--out <path>` | `--schema`

## Result

Prints `{ ok, recipe, prompt, model, aspect, negative }`. Feed `prompt` (+ `model` + `aspect`) into a
generator like `mythosforge-imagegen`. On failure prints `{ "ok": false, "error": "..." }` and exits
non-zero.

## For hosted / tool-use LLMs (Bankr LLM, Surplus, OpenAI, Claude API)

The host hands the model `tool-schema.json` (the `openai` or `anthropic` block); when the model
emits a `mythosforge_promptpack` tool call, the host runs the `node promptpack.mjs …` command above
(no key needed) and feeds the composed prompt back as the tool result.
