# lookgate — rubric + verdict schema

**Owner:** shiro (Designer). This is the design contract `gate.mjs` implements. Read before running.

**What it is:** hand lookgate an image (a render screenshot, a generated asset, a UI frame) → it
scores against a rubric → returns a **structured PASS/FAIL verdict**. The self-verify half of
"AI builds it, human doesn't touch it." Field-agnostic: the rubric is data; the caller can pass
their own with `--rubric <file.json>`.

## Two invocation tiers over ONE rubric

- **tool tier** (Claude Code / Cursor / Codex — shell): screenshot a render yourself, then score it:
  `node gate.mjs --image ./shot.png`
- **prompt tier** (Bankr LLM / Surplus / any vision LLM — brain, no hands): pass an image URL/path;
  the same rubric + verdict come back via the vision model. No capture step.

Same rubric, same verdict JSON, both tiers. The capture step is the caller's; scoring is universal.

## Default rubric (`default-visual-v1`) — caller may override

Each criterion scored `pass | fail | na` with a one-line reason.

| id | criterion | fail = |
|---|---|---|
| `crisp` | structured, readable form; sharp not blobby/melted | mushy, clay, artifacted |
| `subject_clear` | the intended subject is legible/identifiable | ambiguous, cropped, cut off |
| `in_palette` | colors sit inside the supplied theme/palette (if given via `--palette`) | off-ramp / clashing colors |
| `contrast` | subject reads against its background | washed out, muddy, low-contrast |
| `composition` | framed/balanced, not awkwardly cut or empty | subject jammed to edge, dead space |
| `no_artifacts` | no watermark, garbled text, extra limbs, seams | visible generation artifacts |
| `lighting` | intended lighting holds (e.g. night vs day if specified) | wrong time-of-day/mood |
| `text_legible` | any text/labels are readable (`na` if none) | garbled/unreadable text |

**Distinctness add-on** (`--set`): when scoring a *set* together (a district, a sprite sheet, a
deck), enable the ≥3-of-5 anti-reskin + anti-cage checks — no two items share silhouette+color;
structure sits on a solid body, not a hollow cage.

## Verdict schema (identical across both tiers)

```json
{
  "verdict": "pass | fail",
  "score": 0.0,
  "criteria": [
    { "id": "crisp", "result": "pass", "reason": "sharp edges, clean silhouette" },
    { "id": "in_palette", "result": "fail", "reason": "orange accent outside supplied violet ramp" }
  ],
  "fails": ["in_palette"],
  "suggestion": "re-roll with palette constraint; drop orange accent",
  "rubric_id": "default-visual-v1",
  "image": "./shot.png"
}
```

- `verdict = fail` if ANY non-`na` criterion fails (strict gate). `--threshold <0..1>` switches to a
  score threshold instead.
- `suggestion` = a concrete regen/nudge hint so the calling agent self-corrects without a human.
- Machine-readable so any runtime (including a pure function-calling loop) consumes it.

*Distilled from shiro's living spec `skills-design/lookgate-rubric.md`; shiro revises.*
