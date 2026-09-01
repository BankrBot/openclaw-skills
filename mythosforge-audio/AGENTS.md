# mythosforge-audio — agent instructions

Runtime-agnostic instructions for **Codex, Cursor, and any shell-capable AI agent**.
(Claude Code reads `SKILL.md`; tool-use LLMs read `tool-schema.json`. Same skill, one behavior.)

## What this does

Three audio ops on Replicate: **tts** (text-to-speech, MiniMax), **music** (music/ambience, MusicGen),
**sfx** (sound effects, Stable Audio Open). You bring your own key — no wallet, no MythosForge account.

**Read `references/README.md`** for the per-op model + input-field map (fields diverge by op).

## Setup

- Node 18+ (built-in `fetch`; no `npm install`).
- Export `REPLICATE_API_TOKEN` (https://replicate.com/account/api-tokens). Billed to your account.

## Run

```bash
node audio.mjs --op tts   --text "Welcome, traveler." --voice Wise_Woman
node audio.mjs --op music --text "calm lo-fi rain ambience" --duration 12
node audio.mjs --op sfx   --text "sword clang" --duration 3
node audio.mjs --op music --text "..." --dry-run   # request preview, no key
```

- `--op tts|music|sfx` (required), `--text "..."` (required)
- `--voice <id>` (tts), `--duration <sec>` (music/sfx, positive int), `--format <fmt>`, `--out <path>`, `--model <slug>`

## Result

Prints `{ ok, op, text, path, bytes }` and writes the audio file. On failure prints
`{ "ok": false, "error": "..." }` and exits non-zero. Do not claim a file exists unless `ok` was `true`.

## For hosted / tool-use LLMs (Bankr LLM, Surplus, OpenAI, Claude API)

The host hands the model `tool-schema.json` (the `openai` or `anthropic` block); when the model emits
a `mythosforge_audio` tool call, the host runs the `node audio.mjs …` command above (with
`REPLICATE_API_TOKEN` set) and feeds `path` back as the tool result.
