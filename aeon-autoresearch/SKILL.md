---
name: aeon-autoresearch
description: |
  Evolve an existing skill by generating four distinct improved variations, scoring them against a
  rubric, and shipping the winning version as a PR. Genetic-algorithm-style self-improvement for
  agent skills. Use when an existing skill is producing low-signal output, hitting deprecated APIs,
  or just feels stale and you want to harden it without rewriting by hand.
  Triggers: "improve this skill", "evolve token-movers", "auto-research $skill_name",
  "regenerate variations", "tune the output of $skill".
---

# aeon-autoresearch

Self-improvement loop for skills. Given a target SKILL.md, the agent generates four parallel improved variations along distinct theses, scores each on a weighted rubric, and applies the winner.

The point isn't to replace human-authored skills. It's to harden them — fix deprecated endpoints, sharpen output formats, add fallbacks — between maintenance windows.

## When to use this

- A skill's quality score (per `aeon-skill-evals`) has decayed.
- Run logs show empty data, dropped sources, or low-signal output.
- You're about to manually rewrite a skill — try evolving it first.

## Inputs

| Param | Required | Description |
|---|---|---|
| `target` | yes | Skill name to evolve (e.g. `token-movers`). |
| `mode` | no | `evolve` (default) writes a PR. `dry-run` scores variations and prints, writes nothing. |

## The four theses

| Variation | Focus |
|---|---|
| **A — Better inputs** | Improve data sources. Replace deprecated APIs, add fallbacks, fix broken endpoints. |
| **B — Sharper output** | Tighter format, signal over noise, explicit verdicts, banned filler phrases. |
| **C — More robust** | Empty-data handling, retries, dedup state, rate-limit awareness. |
| **D — Rethink** | Fundamentally different methodology for the same goal. |

Each variation must be a complete, runnable SKILL.md. Frontmatter shape is preserved (name, description, var, tags).

## Scoring rubric (1–5 per axis, weighted)

| Axis | Weight | What it measures |
|---|---|---|
| Improvement | 3× | How much better than the original. |
| Output value | 2× | Actionable, low noise, worth reading. |
| Clarity | 1.5× | Will an LLM execute this correctly? |
| Data quality | 1.5× | Sources reliable, diverse, likely to return useful data. |
| Robustness | 1.5× | Handles failures, empty data, edge cases. |
| Conventions | 1× | Frontmatter, logging, notification patterns. |

Tie-break (within 2 points): prefer the variation making the single biggest improvement over many small ones.

## Output

A PR titled `improve(${target}): autoresearch evolution` containing:
- The full scoring table for all four variations.
- The winning thesis and a paragraph rationale.
- Diff vs the original.
- One-paragraph summaries of the three runners-up.

## Safety guarantee

If every variation scores at or below the original on the **Improvement** axis, the run aborts with `AUTORESEARCH_NO_IMPROVEMENT` — no PR, no notify, no change. Never downgrade a working skill.

The skill also preserves the original's:
- Core purpose (evolution, not replacement).
- Tags and var semantics.
- Required env vars (so the workflow's secret manifest stays compatible).

## Example flow

```
target: token-movers

Variation A (Better inputs):  43/50  — added GeckoTerminal fallback, dropped deprecated v1 endpoint
Variation B (Sharper output): 47/50  — added pump-risk flags, banned hedge phrases, structured top-5
Variation C (Robustness):     41/50  — added retry + empty-data path
Variation D (Rethink):        38/50  — narrative-clustered instead of raw ranking

Winner: B (47/50). Diff: +84 / -52 lines. PR opened: aeonframework/aeon#412
```

## When this fails

- All four variations scored ≤ original → no change, log only.
- Target skill not found → abort.
- Pattern: chronic `AUTORESEARCH_NO_IMPROVEMENT` on the same target → the skill genuinely needs human authorship, escalate to operator.

## Pairs with

- `aeon-skill-evals` upstream (surfaces which skills need evolution).
- `aeon-skill-repair` downstream (handles deterministic bug fixes; autoresearch handles quality lifts).
