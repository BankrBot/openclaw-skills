# mythosforge-brandkit — agent instructions

Runtime-agnostic instructions for **Codex, Cursor, and any shell-capable AI agent**.
(Claude Code reads `SKILL.md`; tool-use LLMs read `tool-schema.json`. Same skill, one behavior.)

## What this does

Extract (from a reference image) or author a reusable **style token** (`brandkit.json`) — palette,
typography, feel words, `prompt_suffix` — that every generator + `lookgate` share for one consistent
visual identity. Extract mode uses your own key; author mode needs none.

**Read `references/brandkit-schema.md` first** — it's the style-token schema (owner: shiro).

## Setup

- Node 18+ (built-in `fetch`; no `npm install`).
- **Extract mode only:** export `GEMINI_API_KEY` (or `BRANDKIT_API_KEY`) — default provider is Google
  Gemini vision (https://aistudio.google.com/apikey). `BRANDKIT_BASE_URL`/`BRANDKIT_MODEL` retarget any
  OpenAI-compatible vision endpoint. **Author mode needs no key.**

## Run

```bash
node brandkit.mjs --from ./reference.png --name dusk-neon --out brandkit.json   # extract (needs key)
node brandkit.mjs --author --in partial.json --out brandkit.json                # author (no key)
node brandkit.mjs --schema                                                      # token schema, no key
node brandkit.mjs --from ./ref.png --dry-run                                    # composed request, no key
```

- `--from` (extract) | `--author` (define, `--in <partial.json>` optional), `--name`, `--out`,
  `--model`, `--base-url`, `--auth bearer|x-api-key`

## Result

Prints the style token JSON (+ `{ ok, mode, name, path, token }`) and writes `brandkit.json`. On
failure prints `{ "ok": false, "error": "..." }` and exits non-zero. Do not claim a token exists
unless `ok` was `true`.

## For hosted / tool-use LLMs (Bankr LLM, Surplus, OpenAI, Claude API)

The host hands the model `tool-schema.json` (the `openai` or `anthropic` block); when the model
emits a `mythosforge_brandkit` tool call, the host runs the `node brandkit.mjs …` command above
(extract mode: with `GEMINI_API_KEY` set) and feeds the token / path back as the tool result.
