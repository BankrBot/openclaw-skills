# references/ — mythosforge-audio

**Per-op model + input-field map** (in `audio.mjs`, `OPS`) — audio model fields **diverge hard by op**,
so each op has its own builder (a single shared input builder would be wrong):

| `--op`  | model slug                        | text field | duration field   | format field    | voice   | class     | out |
|---------|-----------------------------------|------------|------------------|-----------------|---------|-----------|-----|
| `tts`   | `minimax/speech-02-turbo`         | `text`     | — (text length)  | `audio_format`  | `voice_id` | official | mp3 |
| `music` | `meta/musicgen`                   | `prompt`   | `duration`       | `output_format` | —       | official  | mp3 |
| `sfx`   | `stackadoc/stable-audio-open-1.0` | `prompt`   | `seconds_total`  | — (→ wav)       | —       | community | wav |

**The divergences that matter (all handled by the per-op map):**
- **text field:** `text` (tts) vs `prompt` (music/sfx) — the CLI's uniform `--text` maps to the op's field.
- **duration field:** `duration` (music) vs `seconds_total` (sfx) vs none (tts). `--duration` errors if used on tts.
- **format field:** `audio_format` (tts) vs `output_format` (music) vs none (sfx→wav).
- **`voice_id`:** tts only, default `Wise_Woman` (a MiniMax Speech-02 system voice) — override with `--voice`.

**Outputs are plain audio URI strings** for all three ops → `pickUrl` handles them; there is **no
output-object gotcha** like the 3D skill.

**Endpoint:** `sfx` (stable-audio-open) is a **community** model → `resolveVersion() → /v1/predictions`
(also fine for the two official models). Poll to completion (300s) and download.

**Verify slugs + field names / valid voice ids from `https://replicate.com/<owner>/<model>/llms.txt`**
before relying on them — confirm `Wise_Woman` is a current Speech-02 system voice, and the accepted
`audio_format` / `output_format` values.

**License note:** MusicGen + MiniMax Speech are official Replicate models; `stable-audio-open-1.0` is a
**community** model (Stability community license — check for commercial use). The MIT wrapper
redistributes no weights; each model's terms are the key holder's responsibility.

**Design note:** audio has no visual design gate — it rounds out the suite so an agent can produce a
full asset set (image + 3D + video + **sound**) on one Replicate key, no human.
