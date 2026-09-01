---
name: mythosforge-skill-scaffold
description: Generate a new MythosForge skill folder on the locked universal template (cross-agent CLI + SKILL.md + AGENTS.md + skill.json + tool-schema.json + README + LICENSE + .gitignore + package.json). Use when creating a new BYO-key open-source skill so every skill in the suite has an identical, drift-free shape.
license: MIT
---

# mythosforge-skill-scaffold

Stamp out a new skill on the locked universal template. Zero dependencies (Node 18+).

## How to run

```bash
node scaffold.mjs --name mythosforge-video --description "Generate a short video from a prompt." \
  --model-slug some-owner/model --ext mp4
```

- `--name` — **required**, kebab-case (e.g. `mythosforge-video`).
- `--description` — **required**, one line.
- `--tool-name` — function name for `tool-schema.json` (default: name with `-`→`_`).
- `--env` — required env var(s), comma-separated (default `REPLICATE_API_TOKEN`).
- `--env-link` — where to get the key (default Replicate token page).
- `--model-slug` / `--ext` — the Replicate model the generated skeleton drives + output extension.
- `--out` — parent dir (default: sibling of this repo, i.e. `D:\agentmanagerworks\<name>`).
- `--force` — overwrite a non-empty target. `--dry-run` — render + report, write nothing.

On success prints `{ "ok": true, "name", "dir", "files": [...] }`. Read `dir` for the new skill.

## After scaffolding

1. Shape `buildInput()` in the generated `generate.mjs` to the model's real Replicate input
   schema (verify from `https://replicate.com/<owner>/<model>/llms.txt` — don't guess).
2. `node generate.mjs --prompt "..." --dry-run` to confirm the request shape.
3. Live-test with a real key, then Reviewer audit → push to `origin/main`.
