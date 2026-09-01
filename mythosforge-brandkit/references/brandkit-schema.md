# brandkit — style-token schema

**Owner:** shiro (Designer). This is the design contract `brandkit.mjs` implements. Read before running.

**What it is:** the DIRECT layer. Extract-or-define a reusable **style token** once (from a reference
image, or authored), then feed it into every generator (`imagegen`, `pixelart`, `deck`, `diagram`,
`dataviz`) so a user's outputs share **one consistent visual identity** instead of each rolling a
random look. Field-agnostic: a game team, a startup deck, a teacher's worksheets.

## Two modes

- **extract**: `node brandkit.mjs --from ref.png` → vision LLM reads the reference → emits a style token JSON.
- **author**: `node brandkit.mjs --author [--in partial.json]` → validates/fills a hand-written token (no key needed).

Output is a portable `brandkit.json` any other skill loads via `--theme brandkit.json`
(and `lookgate` via `--palette brandkit.json`).

## Style-token schema

```json
{
  "name": "dusk-neon",
  "north_star": "dark-violet neon city at night, sculptural landmarks",
  "palette": {
    "base": ["#1c1830", "#2a2342", "#14121f"],
    "accent_primary": "#8a63d2",
    "accent_highlight": "#c9b3f0",
    "accents_allowed": ["#8a63d2", "#6b7dff", "#d263b8", "#63b8d2"],
    "rule": "violet base everywhere + ONE per-asset accent from accents_allowed; no raw red/green/orange"
  },
  "typography": { "display": "Space Grotesk", "body": "Inter", "mono": "JetBrains Mono" },
  "feel_words": ["nocturnal", "neon", "crystalline", "civic"],
  "anti_feel": ["clay", "beige", "daytime", "flat-arcade"],
  "lighting": "cool moonlight key #cdbff0 + fog #160f28; night not noon",
  "emblem_refs": ["./logo.png"],
  "prompt_suffix": "dark-violet neon, emissive edges, night lighting, sculptural, crisp"
}
```

**Key fields the generators actually consume:**
- `prompt_suffix` — appended to every imagegen/pixelart prompt so outputs stay on-theme with zero per-call effort.
- `palette` + `rule` — fed to `lookgate`'s `in_palette` criterion so the gate checks against the SAME
  theme the generator used. (brandkit → generate → gate is a closed loop on one token.)
- `feel_words` / `anti_feel` — steer style; `anti_feel` doubles as negative-prompt material.
- `typography` — for `deck`/`diagram`/`dataviz` text rendering.

*Distilled from shiro's living spec `skills-design/brandkit-schema.md`; shiro revises.*
