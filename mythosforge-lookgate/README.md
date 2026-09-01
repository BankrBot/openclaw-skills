# mythosforge-lookgate

Score an image against a visual-QA rubric and return a structured PASS/FAIL verdict (JSON) — the
**self-verify half** of the MythosForge suite. Every generative skill (imagegen, video, 3d, …)
produces output nobody checks; lookgate is the one reusable gate they all call before shipping.
Open-source, self-contained, usable by any AI runtime — **you bring your own Gemini API key (`GEMINI_API_KEY`)**.

Part of the [MythosForge](https://www.mythosforge.xyz) open-source skill suite. Rubric + verdict
schema (owner: shiro) in [`references/lookgate-rubric.md`](references/lookgate-rubric.md).

## Quick start

```bash
# Node 18+ required. No `npm install` — zero dependencies (built-in fetch).
export GEMINI_API_KEY=xxx   # default provider: Google Gemini vision — https://aistudio.google.com/apikey
                            # (or set LOOKGATE_BASE_URL/LOOKGATE_MODEL for any other OpenAI-compatible vision endpoint)

node gate.mjs --image ./shot.png
# -> prints the verdict JSON: { verdict, score, criteria, fails, suggestion, rubric_id, image }
```

No-key previews:

```bash
node gate.mjs --schema                       # print the verdict schema
node gate.mjs --image ./shot.png --dry-run   # print the composed request (rubric + endpoint), spend nothing
```

## Two tiers, one rubric

- **tool tier** (Claude / Cursor / Codex — shell): screenshot a render, then `--image ./shot.png`.
- **prompt tier** (Bankr LLM / Surplus / any vision LLM): pass an image URL/path; same verdict, no capture.

## Options

| Flag          | Meaning                                                        | Default            |
|---------------|---------------------------------------------------------------|--------------------|
| `--image`     | path or URL to the image to score (**required**)              | —                  |
| `--rubric`    | JSON-array rubric file to override the default                | `default-visual-v1`|
| `--palette`   | theme/palette file (e.g. a `brandkit.json`) for `in_palette`  | none               |
| `--threshold` | `0..1`; switches strict-any-fail → score threshold            | strict             |
| `--set`       | distinctness add-on (see note below)                          | off                |
| `--model` / `--base-url` / `--auth` | target a specific vision endpoint (`bearer` or `x-api-key`) | Gemini, bearer |
| `--out`       | also write the verdict JSON to a file                         | stdout only        |
| `--dry-run` / `--schema` | no-key previews                                    | off                |

> **`--set` scope:** distinctness (≥3/5 differ, anti-cage) is judged *within a single composite
> frame* — a district establishing shot, a sprite sheet — since the gate scores one image per call.
> It does not compare across separate single-image calls.

## How the verdict can't be gamed

The model returns per-criterion `pass/fail/na` + reasons; **lookgate re-derives** the overall
`verdict`, `score`, and `fails` on our side from those results (strict, or `--threshold`). So the
gate's decision isn't whatever the model felt like stamping.

## Usable by any AI runtime

- **Claude Code** — `SKILL.md`. **Codex / Cursor / shell** — `AGENTS.md`, run the CLI.
- **Tool-use / hosted LLMs** (Bankr LLM Gateway, Surplus, OpenAI, Claude API) — hand the model
  `tool-schema.json` (`openai` or `anthropic` block); the host runs the CLI on the tool call.

## Licensing

- The wrapper (`gate.mjs`, docs) is **MIT**. Scoring runs on **your** vision-endpoint account/key.
- No model weights redistributed — only the API-calling wrapper.
