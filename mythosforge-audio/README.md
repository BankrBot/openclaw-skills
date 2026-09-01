# mythosforge-audio

Three audio ops on [Replicate](https://replicate.com), one skill — **you bring your own
`REPLICATE_API_TOKEN`** (the same key the generators use):

- **tts** — text-to-speech (MiniMax Speech-02).
- **music** — music / ambience from a prompt (Meta MusicGen).
- **sfx** — sound effects from a prompt (Stable Audio Open).

Open-source, self-contained, usable by any AI runtime. Part of the
[MythosForge](https://www.mythosforge.xyz) open-source skill suite.

## Quick start

```bash
# Node 18+ required. No `npm install` — zero dependencies (built-in fetch).
export REPLICATE_API_TOKEN=xxx   # https://replicate.com/account/api-tokens

node audio.mjs --op tts   --text "Welcome, traveler." --voice Wise_Woman --out out/vo.mp3
node audio.mjs --op music --text "calm lo-fi rain ambience" --duration 12 --out out/bgm.mp3
node audio.mjs --op sfx   --text "sword clang, metallic ring" --duration 3 --out out/clang.wav
```

Preview the request without spending anything (no key needed):

```bash
node audio.mjs --op music --text "..." --dry-run
```

## Ops

| `--op`  | Replicate model                    | text field | duration field  | format field    | output |
|---------|------------------------------------|------------|-----------------|-----------------|--------|
| `tts`   | minimax/speech-02-turbo            | `text`     | — (text length) | `audio_format`  | mp3    |
| `music` | meta/musicgen                      | `prompt`   | `duration`      | `output_format` | mp3    |
| `sfx`   | stackadoc/stable-audio-open-1.0    | `prompt`   | `seconds_total` | —               | wav    |

The CLI is uniform (`--text` / `--duration`) — the per-op map wires each to the right model field.
Override a model with `--model <slug>` (must match the op's input fields).

## Chains cleanly with the rest of the suite

```
brandkit -> promptpack -> imagegen -> lookgate      # visual assets
audio --op music "dungeon ambience"  +  audio --op sfx "chest opens"   # the soundscape
```

## Options

| Flag         | Meaning                                                    | Default          |
|--------------|------------------------------------------------------------|------------------|
| `--op`       | `tts` \| `music` \| `sfx` (**required**)                   | —                |
| `--text`     | speech text (tts) or prompt (music/sfx) (**required**)     | —                |
| `--voice`    | tts only: MiniMax system voice id                          | `Wise_Woman`     |
| `--duration` | music/sfx only: seconds (positive integer)                 | model default    |
| `--format`   | tts `mp3\|wav\|flac\|pcm`, music `wav\|mp3`                 | mp3 (sfx = wav)  |
| `--out`      | output file path                                           | `out/<op>.<ext>` |
| `--model`    | Replicate model slug override                              | per-op default   |
| `--dry-run`  | print request, spend nothing                               | off              |

## Usable by any AI runtime

- **Claude Code** — `SKILL.md`. **Codex / Cursor / shell** — `AGENTS.md`, run the CLI.
- **Tool-use / hosted LLMs** (Bankr LLM Gateway, Surplus, OpenAI, Claude API) — hand the model
  `tool-schema.json` (`openai` or `anthropic` block); the host runs the CLI on the tool call.

## Licensing

- The wrapper (`audio.mjs`, docs) is **MIT**. Ops run on **your** Replicate account/key; each model
  carries its own terms (Stable Audio Open is a community model). No model weights redistributed.
