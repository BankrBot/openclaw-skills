---
name: mythosforge-audio
description: Generate audio via Replicate — text-to-speech (tts), music/ambience (music), or sound effects (sfx). The calling agent supplies its own REPLICATE_API_TOKEN — no MythosForge account, wallet, or payment.
license: MIT
---

# mythosforge-audio

Three audio ops on Replicate, **you bring your own key** (the same `REPLICATE_API_TOKEN` the
generators use):
- **tts** — text-to-speech (MiniMax Speech-02).
- **music** — music / ambience from a prompt (Meta MusicGen).
- **sfx** — sound effects from a prompt (Stable Audio Open).

> **Read `references/README.md`** for the per-op model + input-field map (the fields diverge by op).

## Prerequisites

- **Node 18+** (built-in `fetch`; no `npm install`).
- **REPLICATE_API_TOKEN** — your own key (https://replicate.com/account/api-tokens). Billed to your account.

## How to run

```bash
REPLICATE_API_TOKEN=xxx node audio.mjs --op tts   --text "Welcome, traveler." --voice Wise_Woman --out out/vo.mp3
REPLICATE_API_TOKEN=xxx node audio.mjs --op music --text "calm lo-fi rain ambience" --duration 12 --out out/bgm.mp3
REPLICATE_API_TOKEN=xxx node audio.mjs --op sfx   --text "sword clang, metallic ring" --duration 3 --out out/clang.wav
node audio.mjs --op music --text "..." --dry-run   # print the request, no key, no spend
```

On success it writes the audio file and prints one JSON line:

```json
{ "ok": true, "op": "music", "text": "...", "path": "/abs/out/bgm.mp3", "bytes": 481233 }
```

Read `path`. On failure it prints `{ "ok": false, "error": "..." }` and exits non-zero.

## Options

- `--op tts|music|sfx` — **required**, which generator.
- `--text "..."` — **required**, the speech text (tts) or the prompt (music/sfx).
- `--voice <id>` — **tts only**, a MiniMax system voice id (default `Wise_Woman`).
- `--duration <sec>` — **music/sfx only**, a positive integer of seconds.
- `--format <fmt>` — tts `mp3|wav|flac|pcm`, music `wav|mp3` (sfx is always wav).
- `--out <path>` — output file. Default `out/<op>.<ext>`.
- `--model <slug>` — override the Replicate model for the op (must match the op's input fields).
- `--dry-run` — print the request that WOULD be sent and exit. Spends nothing, needs no key.

## Required self-report (for gated workflows)

Report the `op`, the output `path`, `bytes` written, and whether it was a `--dry-run` or a live call.
Do not claim an audio file exists unless JSON `ok` was `true`.

## Notes

- MIT wrapper. Runs on **your** Replicate account/key; each underlying model carries its own terms
  (Stable Audio Open is a community model). No model weights redistributed.
