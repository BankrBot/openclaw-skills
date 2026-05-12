---
name: aeon-autoresearch
description: |
  Evolve any installed skill by generating four variations along separate theses (better inputs /
  sharper output / more robust / rethink), scoring them on a weighted rubric, and applying the
  winner. Never downgrades a working skill — aborts cleanly if no variation improves the original.
  Use when an installed skill is producing low-signal output, hitting deprecated APIs, or feels
  stale.
  Triggers: "improve this skill", "evolve $skill", "auto-research my X", "regenerate variations".
---

# aeon-autoresearch

Self-improvement loop. Given a target SKILL.md, generates four parallel improved variations, scores each, applies the winner.

## Inputs

| Param | Description |
|---|---|
| `target` | Skill name or path to SKILL.md. Required. |
| `mode` | `evolve` (default) writes the diff. `dry-run` scores and prints, writes nothing. |

## The four variations

- **A — Better inputs**: replace deprecated APIs, add fallbacks, fix broken endpoints.
- **B — Sharper output**: tighter format, signal over noise, explicit verdicts, banned filler.
- **C — More robust**: empty-data handling, retries, dedup state, rate-limit awareness.
- **D — Rethink**: fundamentally different methodology for the same goal.

Each is a complete runnable SKILL.md. Frontmatter shape preserved.

## Scoring

1-5 per axis, weighted total max 50:

| Axis | Weight |
|---|---|
| Improvement vs original | 3× |
| Output value | 2× |
| Clarity, data quality, robustness | 1.5× each |
| Conventions | 1× |

Tie-break (within 2 points): prefer the variation making the biggest single improvement over many small ones.

## Safety guarantee

If every variation scores ≤ original on **Improvement**, the skill aborts with `AUTORESEARCH_NO_IMPROVEMENT`. No file written. Working skills are never downgraded.

Preserves the original's core purpose, frontmatter shape, and declared env vars.

## Versioning

Inside a git repo, changes land in a branch (`autoresearch/${target}`) — operator reviews the diff before merging. Outside a repo, the original is preserved at `${target}/SKILL.md.before-autoresearch` for rollback.

## Output

The diff, plus a report with the scoring table for all four variations and a one-paragraph rationale for the winner.

Pairs with `aeon-skill-evals` (surfaces what's underperforming) and `aeon-skill-repair` (deterministic bugs; autoresearch handles quality lifts).
