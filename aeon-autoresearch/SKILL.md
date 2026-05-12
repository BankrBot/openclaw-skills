---
name: aeon-autoresearch
description: |
  Evolve any installed Bankr skill by generating four distinct improved variations along separate
  theses (better inputs / sharper output / more robust / rethink), scoring them on a weighted
  rubric, and applying the winning version. Genetic-algorithm-style self-improvement. Never
  downgrades a working skill. Use when an installed skill is producing low-signal output, hitting
  deprecated APIs, or just feels stale.
  Triggers: "improve this skill", "evolve $skill_name", "auto-research my $skill", "regenerate
  variations for X", "tune the output of skill Y".
---

# aeon-autoresearch

Self-improvement loop for any installed skill. Given a target SKILL.md, generates four parallel improved variations along distinct theses, scores each on a weighted rubric, and applies the winner.

Not a replacement for human authorship — a way to harden working skills between maintenance windows. Fix deprecated endpoints, sharpen output formats, add fallbacks.

## Inputs

| Param | Description |
|---|---|
| `target` | Skill name (e.g. `token-movers`) or path to a SKILL.md. Required. |
| `mode` | `evolve` (default) — score, apply winner, write diff. `dry-run` — score and print, write nothing. |

## The four theses

The skill generates exactly four variations, each with a different focus:

| Variation | Focus |
|---|---|
| **A — Better inputs** | Improve data sources. Replace deprecated APIs, add fallbacks, fix broken endpoints. |
| **B — Sharper output** | Tighter format, signal over noise, explicit verdicts, banned filler phrases. |
| **C — More robust** | Empty-data handling, retries, dedup state, rate-limit awareness. |
| **D — Rethink** | Fundamentally different methodology for the same goal. |

Each must be a complete, runnable SKILL.md. Frontmatter shape preserved (name, description, tags, any custom fields).

## Scoring rubric

Each variation scored 1–5 on:

| Axis | Weight |
|---|---|
| Improvement vs original | 3× |
| Output value | 2× |
| Clarity (LLM-executable) | 1.5× |
| Data quality | 1.5× |
| Robustness | 1.5× |
| Conventions (frontmatter, structure) | 1× |

Max weighted total: 50. Tie-break within 2 points: prefer the variation making the biggest single improvement over many small ones.

## Safety guarantee

If every variation scores ≤ original on the **Improvement** axis, the skill aborts with `AUTORESEARCH_NO_IMPROVEMENT`. No file written, no change applied. Working skills are never downgraded.

The skill also preserves the original's:
- Core purpose (evolution, not replacement).
- Frontmatter shape and required fields.
- Any env vars the skill already declares (no new dependencies introduced silently).

## Output

A diff against the target SKILL.md, plus a report:

```
*Autoresearch — token-movers — 2026-05-12*

Variation A (Better inputs):  43/50  — added GeckoTerminal fallback, dropped deprecated v1 endpoint
Variation B (Sharper output): 47/50  — added pump-risk flags, banned filler phrases, structured top-5
Variation C (Robustness):     41/50  — added retry + empty-data path
Variation D (Rethink):        38/50  — narrative-clustered instead of raw ranking

Winner: B (47/50)
Reason: largest improvement axis (5) — output value bump is the biggest single gain.

Diff:
  SKILL.md  +84  -52
  References to deprecated /v1/markets removed (3 places)
  Added pump-risk flag table (8 lines)
  Banned filler phrase list added to constraints (4 lines)

Runners-up summary:
  A: improvement was real but smaller — same output shape with better sources.
  C: tightened reliability without changing the core output. Strong second.
  D: interesting reframe but data-quality unproven on the new methodology.
```

In `evolve` mode, the target SKILL.md is replaced with the winner. In `dry-run` mode, the report is emitted and no files change.

## Integration with version control

If the target skill is inside a git repo, the skill creates a branch (`autoresearch/${target}`), writes the changes, and offers a `git diff` for review. It never pushes — the operator commits and pushes manually after reading the diff.

If not inside a repo, the original SKILL.md is preserved at `${target}/SKILL.md.before-autoresearch` so the operator can roll back.

## When this fails

| Condition | Exit |
|---|---|
| All variations ≤ original on improvement | `AUTORESEARCH_NO_IMPROVEMENT` — no change. |
| Target skill not found | `AUTORESEARCH_TARGET_NOT_FOUND`. |
| Repeated `AUTORESEARCH_NO_IMPROVEMENT` on the same target | Indicates the skill genuinely needs human authorship; flag for operator. |

## Guidelines

- Improvement is the headline. A variation that scores high on clarity but doesn't improve over the original is not the winner.
- Tie-breaker rewards bold improvement over incremental polish.
- Preserves the skill's core purpose. The skill's name and stated description are inviolate; evolution refines how it accomplishes that purpose.

## Required keys

None directly. The skill may invoke WebFetch / WebSearch during the "Better inputs" variation to research current APIs.

## Pairs with

- `aeon-skill-evals` upstream (surfaces which skills need evolution — low scores on the eval manifest are the trigger).
- `aeon-skill-repair` for deterministic bug fixes; autoresearch handles quality lifts.
