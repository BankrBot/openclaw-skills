---
name: mythosforge-lookgate
description: Score an image against a visual-QA rubric and return a structured PASS/FAIL verdict (JSON). The self-verify half of the MythosForge suite — the reusable gate every generative skill calls before shipping. The calling agent supplies its own Gemini API key (GEMINI_API_KEY, or LOOKGATE_API_KEY) — default provider is Google Gemini vision; any OpenAI-compatible vision endpoint via --base-url. No MythosForge account, wallet, or payment.
license: MIT
---

# mythosforge-lookgate

Hand it an image (a render screenshot, a generated asset, a UI frame) → it scores against a
rubric → returns a **structured PASS/FAIL verdict**. Self-contained, **you bring your own key.**

> **Read `references/lookgate-rubric.md` before running.** It is the rubric + verdict schema this
> gate implements (owner: shiro). The rubric is data — callers may pass their own with `--rubric`.

## Prerequisites

- **Node 18+** (built-in `fetch`; no `npm install`).
- **GEMINI_API_KEY** (or `LOOKGATE_API_KEY`) — default provider is **Google Gemini** vision (via
  its OpenAI-compatible layer). Get a key at https://aistudio.google.com/apikey. To target another
  OpenAI-compatible vision endpoint, set `LOOKGATE_BASE_URL` / `LOOKGATE_MODEL`. Billed to your
  account, not MythosForge.

## Two tiers, one rubric

- **tool tier** (Claude Code / Cursor / Codex): screenshot a render yourself, then score `--image ./shot.png`.
- **prompt tier** (Bankr LLM / Surplus / any vision LLM): pass an image URL/path; same verdict comes back. No capture step.

## How to run

```bash
GEMINI_API_KEY=xxx node gate.mjs --image ./shot.png              # strict: fail if any criterion fails
GEMINI_API_KEY=xxx node gate.mjs --image ./shot.png --threshold 0.8 --palette brand.json --out verdict.json
node gate.mjs --schema                                            # print the verdict schema (no key)
node gate.mjs --image ./shot.png --dry-run                        # print the composed request (no key, no spend)
```

On success it prints the verdict JSON (shiro's schema):

```json
{ "verdict": "fail", "score": 0.88, "criteria": [ ... ], "fails": ["in_palette"],
  "suggestion": "re-roll with palette constraint; drop orange accent",
  "rubric_id": "default-visual-v1", "image": "./shot.png" }
```

On failure it prints `{ "ok": false, "error": "..." }` and exits non-zero.

## Options

- `--image <path|url>` — **required**, the image to score.
- `--rubric <file.json>` — override the default rubric (JSON array). Default `default-visual-v1`.
- `--palette <file>` — theme/palette (e.g. a `brandkit.json`) to check `in_palette` against.
- `--threshold <0..1>` — switch from strict-any-fail to a score threshold.
- `--set` — distinctness add-on when scoring a set of assets together.
- `--model` / `--base-url` / `--auth bearer|x-api-key` — target a specific vision endpoint.
- `--out <path>` — also write the verdict JSON to a file.
- `--dry-run` (print request, no key) · `--schema` (print verdict schema, no key).

## Required self-report (for gated workflows)

Report the `rubric_id`, the `verdict` + `score`, the `fails`, and whether it was `--dry-run` or a
live call. Do not claim a PASS unless the verdict JSON said so.

## Notes

- MIT wrapper. Calls the vision endpoint under *your* account/key. The gate re-derives `verdict`,
  `score`, and `fails` on our side from the model's per-criterion results, so the pass/fail can't be
  spoofed by the model. No model weights redistributed.
