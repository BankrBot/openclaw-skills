---
name: aeon-skill-evals
description: |
  Validate the output of any installed skill against an assertion manifest — word counts, required
  patterns, forbidden phrases, required sections, source citation. Detects regressions by diffing
  vs prior runs (NEW_FAIL / NEW_PASS / CHRONIC / STABLE_FAIL). Bootstrap mode generates a starter
  manifest from a skill's recent successful runs so manifests aren't written speculatively.
  Triggers: "evaluate this skill's output", "check skill X for regressions", "bootstrap evals
  for Y", "did this skill output pass quality gates".
---

# aeon-skill-evals

Quality net for installed skills. Each skill can declare an assertion manifest; outputs are checked against it; failing assertions surface regressions and route concrete fixes.

## Manifest format

```yaml
token-movers:
  min_words: 200
  required_patterns: ["Top movers", "24h"]
  forbidden_patterns: ["I cannot", "as an AI"]
  must_cite_source: true
  min_distinct_items: 5

narrative-tracker:
  min_words: 400
  required_sections: ["TRANSITIONS", "POSITIONS", "MAP"]
  forbidden_patterns: ["exciting", "consider"]
  must_have_position_call: true
```

Supported assertions: `min_words` / `max_words`, `required_patterns` / `forbidden_patterns`, `required_sections`, `must_cite_source`, `min_distinct_items`, `output_pattern` (regex), and per-skill-family custom binary checks.

## Operations

- `eval` — run every manifest-defined skill against its latest output.
- `eval --skill=NAME` — one skill.
- `bootstrap --skill=NAME` — generate a starter manifest from recent successful runs.

## Regression states

| State | Action |
|---|---|
| `NEW_FAIL` | Passing last run, failing now. Severity scales with pass streak. |
| `NEW_PASS` | Failing last run, passing now. Log the win. |
| `CHRONIC` | Failing > 3 consecutive runs. Recommend operator review. |
| `STABLE_FAIL` | Always failing. Manifest assertion mismatch — flag for review. |

State in local `evals-state.json`.

## Bootstrap mode

Samples last 5 successful runs of a skill. Computes:

- `min_words` at p25 of historical runs.
- Required patterns from common section headers.
- Forbidden patterns from default list (refusals, hedging filler).

Emits the proposed manifest for review. Never auto-commits — assertions need a human signoff.

## Rules

- Assertions are observations, not specifications. Bootstrap before writing speculatively.
- Forbidden patterns catch hallucination markers and refusals. Keep the list tight; don't lint stylistic choices.
- Chronic failures get a recommendation, not a re-file.
- Manifest changes are reviewed; never auto-edited by this skill.
