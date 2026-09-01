# mythosforge-3d

Turn an image into a game-ready **3D model (`.glb`)** via [Replicate](https://replicate.com) — **you
bring your own `REPLICATE_API_TOKEN`** (the same key the generators use). Default model = Microsoft
**TRELLIS** (MIT-licensed).

Open-source, self-contained, usable by any AI runtime. Part of the
[MythosForge](https://www.mythosforge.xyz) open-source skill suite.

## Quick start

```bash
# Node 18+ required. No `npm install` — zero dependencies (built-in fetch).
export REPLICATE_API_TOKEN=xxx   # https://replicate.com/account/api-tokens

node to3d.mjs --image ./sprite.png --out out/model.glb
```

Preview the request without spending anything (no key needed):

```bash
node to3d.mjs --image ./sprite.png --dry-run
```

> **3D generation is slow** — the CLI polls up to 10 minutes for the model to finish.

## Models

| slug (default = trellis) | input mode      | output key   | license               | output |
|--------------------------|-----------------|--------------|-----------------------|--------|
| `firtoz/trellis`         | `images:[ref]`  | `model_file` | **MIT**               | glb    |
| `ndreca/hunyuan3d-2`     | `image:ref`     | `mesh`       | Tencent community (non-MIT) | glb |

Override with `--model <slug>`. For a model not in the map, pass `--image-mode array|single` and
`--output-key <key>` (see `references/README.md`). Local images are sent as a data URI.

**Why the output-key matters:** 3D models return an **object** (`{ model_file: ... }` /
`{ mesh: ... }`), not a bare URL — the skill extracts the named GLB key, so a "successful but empty"
result can't slip through.

## Chains cleanly with the rest of the suite

```
imagegen (generate a sprite) -> 3d --image sprite.png   # 2D concept -> game-ready 3D asset
brandkit -> promptpack -> imagegen -> 3d                  # on-theme sprite, then a model of it
```

## Options

| Flag           | Meaning                                                     | Default          |
|----------------|-------------------------------------------------------------|------------------|
| `--image`      | source image path or URL (**required**)                     | —                |
| `--out`        | output file path                                            | `out/model.glb`  |
| `--model`      | Replicate 3D model slug override                            | `firtoz/trellis` |
| `--image-mode` | `array` / `single` — image input mode for an unmapped model | per-model map    |
| `--output-key` | named GLB key in the output for an unmapped model           | per-model map    |
| `--dry-run`    | print request, spend nothing                                | off              |

## Usable by any AI runtime

- **Claude Code** — `SKILL.md`. **Codex / Cursor / shell** — `AGENTS.md`, run the CLI.
- **Tool-use / hosted LLMs** (Bankr LLM Gateway, Surplus, OpenAI, Claude API) — hand the model
  `tool-schema.json` (`openai` or `anthropic` block); the host runs the CLI on the tool call.

## Licensing

- The wrapper (`to3d.mjs`, docs) is **MIT**. Generation runs on **your** Replicate account/key.
  TRELLIS (default) is MIT; the Hunyuan alt carries a Tencent community (non-MIT) license — your
  responsibility as the key holder. No model weights redistributed.
