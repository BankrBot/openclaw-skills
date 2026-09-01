# mythosforge-video

Generate a short video from a text prompt via [Replicate](https://replicate.com) — **you bring your
own `REPLICATE_API_TOKEN`** (the same key the generators use). Pass a `--image` first frame for
image-to-video.

Open-source, self-contained, usable by any AI runtime. Part of the
[MythosForge](https://www.mythosforge.xyz) open-source skill suite.

## Quick start

```bash
# Node 18+ required. No `npm install` — zero dependencies (built-in fetch).
export REPLICATE_API_TOKEN=xxx   # https://replicate.com/account/api-tokens

node video.mjs --prompt "a slow drone shot over a foggy neon city at dusk" --out out/clip.mp4
node video.mjs --prompt "camera pushes in, gentle parallax" --image ./first.png --out out/clip.mp4
```

Preview the request without spending anything (no key needed):

```bash
node video.mjs --prompt "..." --dry-run
```

> **Video generation is slow** — the CLI polls up to 10 minutes for the model to finish.

## Models

| slug (default = seedance)  | modes                               | output |
|----------------------------|-------------------------------------|--------|
| `bytedance/seedance-2.0`   | text→video; `--image` = image→video | mp4    |
| `minimax/hailuo-2.3`       | quality alt, up to 1080p (`--model`)| mp4    |

Override with `--model <slug>`. Local first-frame images are sent as a data URI; URLs pass through.
**Heads-up:** video models use different image-input field names (seedance=`image`,
hailuo=`first_frame_image`); the built-in ones are mapped, and for any other `--model` you pass
`--image-field <key>` for image-to-video. See `references/README.md` for the upgrade menu.

## Chains cleanly with the rest of the suite

```
imagegen (generate a still) -> video --image still.png "camera pushes in"   # animate a generated frame
brandkit -> promptpack -> imagegen -> video                                  # on-theme still, then motion
```

## Options

| Flag        | Meaning                                                    | Default          |
|-------------|------------------------------------------------------------|------------------|
| `--prompt`      | video description / motion instruction (**required**)  | —                     |
| `--image`       | optional first-frame image (path/URL) → image-to-video | —                     |
| `--image-field` | image-input key for an unmapped `--model`              | per-model map         |
| `--duration` / `--resolution` | optional model params (sent only if set) | model default         |
| `--out`         | output file path                                       | `out/video.mp4`       |
| `--model`       | Replicate video model slug override                    | `bytedance/seedance-2.0` |
| `--dry-run`     | print request, spend nothing                           | off                   |

## Usable by any AI runtime

- **Claude Code** — `SKILL.md`. **Codex / Cursor / shell** — `AGENTS.md`, run the CLI.
- **Tool-use / hosted LLMs** (Bankr LLM Gateway, Surplus, OpenAI, Claude API) — hand the model
  `tool-schema.json` (`openai` or `anthropic` block); the host runs the CLI on the tool call.

## Licensing

- The wrapper (`video.mjs`, docs) is **MIT**. Generation runs on **your** Replicate account/key; the
  video model is commercial per-call. No model weights redistributed.
