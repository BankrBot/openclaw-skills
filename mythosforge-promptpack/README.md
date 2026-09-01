# mythosforge-promptpack

Compose a **generator-ready prompt** from a curated recipe library — pick a recipe, drop in your
subject, optionally fold in a `brandkit.json` for on-theme output. **No API key, no network** — pure
composition. It's the bridge from `brandkit` → the generators (`imagegen`, `pixelart`, …).

Open-source, self-contained, usable by any AI runtime. Part of the
[MythosForge](https://www.mythosforge.xyz) open-source skill suite.

## Quick start

```bash
# Node 18+ required. No `npm install`, zero dependencies, no key.
node promptpack.mjs --list                                     # see recipes
node promptpack.mjs --recipe neon-noir --subject "a lone fox"  # compose
```

Output:

```json
{ "ok": true, "recipe": "neon-noir", "prompt": "a lone fox, neon noir, rain-slick streets, ...",
  "model": "flux", "aspect": "landscape", "negative": "flat, daytime, ..." }
```

Then feed it straight into a generator:

```bash
node ../mythosforge-imagegen/generate.mjs --prompt "a lone fox, neon noir, ..." --model flux --aspect landscape
```

## On-theme with brandkit (the closed loop)

```bash
node promptpack.mjs --recipe cozy-isometric --subject "a bakery" --theme brandkit.json
```

`--theme` folds a `brandkit.json` in: `feel_words` + `prompt_suffix` append to the prompt, `anti_feel`
merges into `negative`. So **brandkit → promptpack → generate → lookgate** all ride one theme token.

## Recipes

Bundled `recipes.json` ships 8 starters (concept-splash, product-hero, pixel-sprite, cozy-isometric,
neon-noir, flat-vector-icon, storybook, seamless-texture). Each carries a suggested `model`, `aspect`,
a `{subject}` template, and a `negative`. Curate your own and pass `--recipes <file>`.

## Options

| Flag         | Meaning                                                         |
|--------------|----------------------------------------------------------------|
| `--list`     | list recipes (id / title / model / aspect)                     |
| `--recipe`   | recipe id to compose (with `--subject`)                        |
| `--subject`  | what to drop into the recipe's `{subject}` slot                |
| `--theme`    | a `brandkit.json` to fold in (on-theme)                        |
| `--recipes`  | custom recipe library JSON (overrides bundled)                 |
| `--out`      | also write the composed prompt JSON                            |
| `--schema`   | print the recipe schema                                        |

## Usable by any AI runtime

- **Claude Code** — `SKILL.md`. **Codex / Cursor / shell** — `AGENTS.md`, run the CLI.
- **Tool-use / hosted LLMs** (Bankr LLM Gateway, Surplus, OpenAI, Claude API) — hand the model
  `tool-schema.json` (`openai` or `anthropic` block); the host runs the CLI on the tool call.

## License

MIT. Pure composition — no model calls, nothing billed. Recipes are open data; curate freely.
