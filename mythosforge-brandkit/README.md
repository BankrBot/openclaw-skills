# mythosforge-brandkit

The **DIRECT** layer of the MythosForge suite: extract (from a reference image) or author a reusable
**style token** (`brandkit.json`) — palette, typography, feel words, `prompt_suffix` — that every
generator (`imagegen`, `pixelart`, `deck`, …) and `lookgate` share. One token → **one consistent
visual identity** across everything, instead of each generator rolling a random look.

Open-source, self-contained, usable by any AI runtime. **Extract mode brings your own
`GEMINI_API_KEY`; author mode needs no key.** Style-token schema (owner: shiro) in
[`references/brandkit-schema.md`](references/brandkit-schema.md).

## Quick start

```bash
# Node 18+ required. No `npm install` — zero dependencies (built-in fetch).

# extract a theme from a reference image (Gemini vision)
export GEMINI_API_KEY=xxx   # https://aistudio.google.com/apikey
node brandkit.mjs --from ./reference.png --name dusk-neon --out brandkit.json

# author / validate a hand-written token (no key)
node brandkit.mjs --author --in partial.json --out brandkit.json
```

No-key previews:

```bash
node brandkit.mjs --schema                     # print the style-token schema
node brandkit.mjs --from ./ref.png --dry-run   # print the composed request (endpoint + fields)
```

## The closed loop

`brandkit.json` is loaded by the generators via `--theme brandkit.json` (its `prompt_suffix` +
`feel_words` steer every prompt) and by `lookgate` via `--palette brandkit.json` (its `palette` +
`rule` become the gate's `in_palette` check). So **brandkit → generate → lookgate** verifies against
the exact look the generator targeted — all from one token.

## Options

| Flag         | Meaning                                                          | Default         |
|--------------|------------------------------------------------------------------|-----------------|
| `--from`     | extract mode: path or URL to a reference image                   | —               |
| `--author`   | author mode: validate/fill a hand-written token (no key)         | —               |
| `--in`       | author mode: partial token JSON to fill from                     | —               |
| `--name`     | override the token name                                          | `untitled-theme`|
| `--out`      | output path for `brandkit.json`                                  | `brandkit.json` |
| `--model` / `--base-url` / `--auth` | target a specific vision endpoint (extract)       | Gemini, bearer  |
| `--dry-run` / `--schema` | no-key previews                                      | off             |

## Usable by any AI runtime

- **Claude Code** — `SKILL.md`. **Codex / Cursor / shell** — `AGENTS.md`, run the CLI.
- **Tool-use / hosted LLMs** (Bankr LLM Gateway, Surplus, OpenAI, Claude API) — hand the model
  `tool-schema.json` (`openai` or `anthropic` block); the host runs the CLI on the tool call.

## Licensing

- The wrapper (`brandkit.mjs`, docs) is **MIT**. Extract mode runs on **your** vision-endpoint key.
- No model weights redistributed — only the API-calling wrapper.
