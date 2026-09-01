# mythosforge-lookgate — agent instructions

Runtime-agnostic instructions for **Codex, Cursor, and any shell-capable AI agent**.
(Claude Code reads `SKILL.md`; tool-use LLMs read `tool-schema.json`. Same skill, one behavior.)

## What this does

Score an image against a visual-QA rubric → structured PASS/FAIL verdict JSON. The self-verify
half of the suite: the gate a generative skill calls before shipping. You bring your own key — no
wallet, no MythosForge account, no payment.

**Read `references/lookgate-rubric.md` first** — it's the rubric + verdict schema (owner: shiro).

## Setup

- Node 18+ (built-in `fetch`; no `npm install`).
- Export `GEMINI_API_KEY` (or `LOOKGATE_API_KEY`) — default provider is **Google Gemini** vision
  (key: https://aistudio.google.com/apikey). Target any other OpenAI-compatible vision endpoint via
  `LOOKGATE_BASE_URL` / `LOOKGATE_MODEL`.

## Run

```bash
node gate.mjs --image ./shot.png                       # strict gate
node gate.mjs --image https://.../asset.png --threshold 0.8 --out verdict.json
node gate.mjs --schema                                 # verdict schema, no key
node gate.mjs --image ./shot.png --dry-run             # composed request, no key/spend
```

- `--image` (required, path or URL), `--rubric <file.json>` (override), `--palette <file>`,
  `--threshold <0..1>`, `--set`, `--model`, `--base-url`, `--auth bearer|x-api-key`, `--out <path>`

## Result

Prints the verdict JSON: `{ verdict, score, criteria[], fails[], suggestion, rubric_id, image }`.
On failure prints `{ "ok": false, "error": "..." }` and exits non-zero. Do not claim a PASS unless
`verdict` was `"pass"`.

## For hosted / tool-use LLMs (Bankr LLM, Surplus, OpenAI, Claude API)

The host hands the model `tool-schema.json` (the `openai` or `anthropic` block); when the model
emits a `mythosforge_lookgate` tool call, the host runs the `node gate.mjs …` command above (with
`GEMINI_API_KEY` set) and feeds the verdict JSON back as the tool result.
