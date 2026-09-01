# mythosforge-skill-scaffold — agent instructions

Runtime-agnostic instructions for **Codex, Cursor, and any shell-capable AI agent**.
(Claude Code reads `SKILL.md`; tool-use LLMs read `tool-schema.json`.)

## What this does

Generates a new MythosForge skill folder on the locked universal template. No key needed — it
only writes files locally.

## Setup

- Node 18+ (no `npm install`).

## Run

```bash
node scaffold.mjs --name mythosforge-video --description "Generate a short video from a prompt."
```

- `--name` (required, kebab-case), `--description` (required, one line)
- `--tool-name`, `--env`, `--env-link`, `--model-slug`, `--ext`, `--out` — see `README.md`
- `--force` overwrite non-empty target; `--dry-run` render + report, write nothing

## Result

Prints one JSON line: `{ "ok": true, "name": "...", "dir": "...", "files": [...] }`. Read `dir`
for the generated skill. On failure prints `{ "ok": false, "error": "..." }` and exits non-zero.

## After scaffolding

Shape `buildInput()` in the generated `generate.mjs` to the model's real Replicate input schema,
confirm with `--dry-run`, live-test with a real key, then audit + push.
