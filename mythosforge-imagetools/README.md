# mythosforge-imagetools

Two image utility ops on [Replicate](https://replicate.com), one skill — **you bring your own
`REPLICATE_API_TOKEN`** (the same key the generators use):

- **upscale** — enlarge/enhance an image (Real-ESRGAN).
- **bg-remove** — cut the background to a transparent PNG (rembg).

Open-source, self-contained, usable by any AI runtime. Part of the
[MythosForge](https://www.mythosforge.xyz) open-source skill suite.

## Quick start

```bash
# Node 18+ required. No `npm install` — zero dependencies (built-in fetch).
export REPLICATE_API_TOKEN=xxx   # https://replicate.com/account/api-tokens

node imagetools.mjs --op upscale   --image ./in.png --scale 4 --out out/big.png
node imagetools.mjs --op bg-remove --image ./in.png --out out/cutout.png
```

Preview the request without spending anything (no key needed):

```bash
node imagetools.mjs --op upscale --image ./in.png --dry-run
```

## Ops

| `--op`      | Replicate model          | Does                                   | Output |
|-------------|--------------------------|----------------------------------------|--------|
| `upscale`   | nightmareai/real-esrgan  | enlarge/enhance (`--scale 1..10`)      | png    |
| `bg-remove` | cjwbw/rembg              | remove background → transparent cutout | png    |

Override a model with `--model <slug>`. Local images are sent as a data URI; URLs are passed through.

## Chains cleanly with the rest of the suite

```
imagegen (generate) -> imagetools --op upscale     # make a hero-res version
imagegen (generate) -> imagetools --op bg-remove   # get a game-ready sprite cutout
```

## Options

| Flag        | Meaning                                              | Default        |
|-------------|------------------------------------------------------|----------------|
| `--op`      | `upscale` \| `bg-remove` (**required**)              | —              |
| `--image`   | input image path or URL (**required**)               | —              |
| `--scale`   | upscale factor 1..10 (upscale op only)               | `4`            |
| `--out`     | output file path                                     | `out/<op>.png` |
| `--model`   | Replicate model slug override                        | per-op default |
| `--dry-run` | print request, spend nothing                         | off            |

## Usable by any AI runtime

- **Claude Code** — `SKILL.md`. **Codex / Cursor / shell** — `AGENTS.md`, run the CLI.
- **Tool-use / hosted LLMs** (Bankr LLM Gateway, Surplus, OpenAI, Claude API) — hand the model
  `tool-schema.json` (`openai` or `anthropic` block); the host runs the CLI on the tool call.

## Licensing

- The wrapper (`imagetools.mjs`, docs) is **MIT**. Ops run on **your** Replicate account/key.
- No model weights redistributed — only the API-calling wrapper.
