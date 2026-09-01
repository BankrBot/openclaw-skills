# mythosforge-imageedit

Two edit ops on an input image via [Replicate](https://replicate.com), one skill — **you bring your
own `REPLICATE_API_TOKEN`** (the same key the generators use):

- **edit** — instruction img2img: transform an image with a prompt (Flux Kontext).
- **inpaint** — fill a masked region with a prompt (Flux Fill).

Open-source, self-contained, usable by any AI runtime. Part of the
[MythosForge](https://www.mythosforge.xyz) open-source skill suite.

## Quick start

```bash
# Node 18+ required. No `npm install` — zero dependencies (built-in fetch).
export REPLICATE_API_TOKEN=xxx   # https://replicate.com/account/api-tokens

node imageedit.mjs --op edit    --image ./in.png --prompt "make it snowy at dusk"
node imageedit.mjs --op inpaint --image ./in.png --mask ./mask.png --prompt "a red wooden door"
```

Preview the request without spending anything (no key needed):

```bash
node imageedit.mjs --op edit --image ./in.png --prompt "..." --dry-run
```

## Ops

| `--op`    | Replicate model                  | Does                                    | Needs            |
|-----------|----------------------------------|-----------------------------------------|------------------|
| `edit`    | black-forest-labs/flux-kontext-pro | prompt-guided edit of the whole image | `--image --prompt` |
| `inpaint` | black-forest-labs/flux-fill-pro  | fill a masked region from the prompt    | `--image --mask --prompt` |

Override a model with `--model <slug>`. Local images/masks are sent as data URIs; URLs pass through.
For inpaint, the mask's **white** pixels mark the area to fill.

## Chains cleanly with the rest of the suite

```
imagegen (generate) -> imageedit --op edit "make it night"    # iterate a generated image
brandkit -> promptpack -> imagegen -> imageedit -> lookgate    # generate, refine, then gate
```

## Options

| Flag        | Meaning                                                    | Default        |
|-------------|------------------------------------------------------------|----------------|
| `--op`      | `edit` \| `inpaint` (**required**)                         | —              |
| `--image`   | input image path or URL (**required**)                     | —              |
| `--prompt`  | edit instruction, max 2000 chars (**required**)            | —              |
| `--mask`    | inpaint only: mask path/URL (white = fill)                 | —              |
| `--out`     | output file path                                           | `out/<op>.png` |
| `--model`   | Replicate model slug override                              | per-op default |
| `--dry-run` | print request, spend nothing                               | off            |

## Usable by any AI runtime

- **Claude Code** — `SKILL.md`. **Codex / Cursor / shell** — `AGENTS.md`, run the CLI.
- **Tool-use / hosted LLMs** (Bankr LLM Gateway, Surplus, OpenAI, Claude API) — hand the model
  `tool-schema.json` (`openai` or `anthropic` block); the host runs the CLI on the tool call.

## Licensing

- The wrapper (`imageedit.mjs`, docs) is **MIT**. Ops run on **your** Replicate account/key; the
  Flux Kontext/Fill Pro models are commercial per-call. No model weights redistributed.
