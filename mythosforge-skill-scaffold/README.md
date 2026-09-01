# mythosforge-skill-scaffold

Stamp out a new [MythosForge](https://www.mythosforge.xyz) skill on the **locked universal
template** with one command. Every generated skill is born cross-agent (Claude Code / Codex /
Cursor / any tool-use LLM) and BYO-key — identical in shape to the reference skill
[`mythosforge-imagegen`](https://github.com/ryjin111/mythosforge-imagegen), so there is
**zero template drift** across the whole open-source suite.

## Why

The suite is ~10+ skills. Hand-writing the 9-file template each time is slow and drifts.
This scaffold turns a new skill from ~1hr → a few minutes and guarantees a consistent shape.

## Quick start

```bash
# Node 18+. No `npm install` — zero dependencies.
node scaffold.mjs \
  --name mythosforge-video \
  --description "Generate a short video from a text prompt." \
  --model-slug some-owner/some-video-model \
  --ext mp4
```

Preview without writing anything:

```bash
node scaffold.mjs --name mythosforge-video --description "..." --dry-run
```

By default the new skill folder is created as a **sibling** of this repo (i.e. in
`D:\agentmanagerworks\<name>` per the project-location rule). Override with `--out <dir>`.

## What it generates

A complete, immediately-valid skill folder:

```
<name>/
  generate.mjs        # BYO-key CLI, --dry-run, JSON stdout, fetch->write bytes
  SKILL.md            # Claude Code frontmatter + usage
  AGENTS.md           # Codex / Cursor / shell entrypoint
  skill.json          # runtime-agnostic manifest
  tool-schema.json    # OpenAI + Anthropic function schemas (Bankr LLM / Surplus / any tool-use LLM)
  README.md
  package.json
  LICENSE             # MIT
  .gitignore
```

The generated `generate.mjs` is a working **Replicate**-pattern skeleton (prompt + aspect →
prediction → poll → download bytes → write). For a non-Replicate provider, replace the
`startPrediction`/`waitForImage`/download block; keep the arg-parsing + JSON-stdout + fetch→write
contract. Shape `buildInput()` to the model's real Replicate input schema (verify from
`https://replicate.com/<owner>/<model>/llms.txt` — don't guess fields).

## Options

| Flag           | Meaning                                              | Default                                   |
|----------------|------------------------------------------------------|-------------------------------------------|
| `--name`       | kebab-case skill name (**required**)                 | —                                         |
| `--description`| one-line description (**required**)                  | —                                         |
| `--tool-name`  | function name in `tool-schema.json`                  | `<name>` with hyphens → underscores       |
| `--env`        | required env var(s), comma-separated                 | `REPLICATE_API_TOKEN`                     |
| `--env-link`   | where to get the key (shown in docs)                 | Replicate token page                      |
| `--model-slug` | Replicate model the skeleton drives                  | `black-forest-labs/flux-schnell`          |
| `--ext`        | output file extension                                | `webp`                                    |
| `--out`        | parent dir for the new skill                         | sibling of this repo                      |
| `--force`      | overwrite a non-empty target                         | off                                       |
| `--dry-run`    | render + report, write nothing                       | off                                       |

## Output

Prints one JSON line: `{ ok, name, dir, files }` on success, or `{ ok: false, error }` (exit 1).

## License

MIT.
