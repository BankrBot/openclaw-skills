---
name: aeon-skill-evals
description: |
  Validate the output of any installed skill against an assertion manifest — word counts, required
  patterns, forbidden phrases, output shape, source citation. Detects regressions before users do.
  Bootstrap mode generates a starter manifest from a skill's recent successful runs. Use as a
  pre-deploy gate on skill variations, continuous quality monitoring, or to catch hallucinated
  output before it goes downstream.
  Triggers: "evaluate this skill's output", "check skill X for regressions", "bootstrap evals
  for Y", "did this skill output pass quality gates", "is the output of X regressing".
---

# aeon-skill-evals

Quality net for installed skills. Each skill can declare an assertion manifest; every output run is checked against the manifest; failing assertions surface regressions and route concrete fixes.

The job isn't to prevent every bad output. It's to catch the regression the moment it happens and route it to repair before a human notices.

## Manifest format

A YAML or JSON file (e.g. `evals.yaml`) keyed by skill name:

```yaml
token-movers:
  min_words: 200
  required_patterns:
    - "Top movers"
    - "24h"
  forbidden_patterns:
    - "I cannot"
    - "as an AI"
    - "as a language model"
  must_cite_source: true
  min_distinct_items: 5

narrative-tracker:
  min_words: 400
  required_sections:
    - "TRANSITIONS"
    - "POSITIONS"
    - "MAP"
  forbidden_patterns:
    - "exciting"
    - "consider"
  must_have_position_call: true
  must_name_drivers: true

paper-pick:
  required_sections:
    - "central claim"
    - "why it's worth"
    - "where it might be wrong"
    - "read order"
  must_cite_paper: true
```

Assertion types:
- `min_words` / `max_words` — word count bounds.
- `required_patterns` / `forbidden_patterns` — substring matches.
- `required_sections` — markdown header presence.
- `must_cite_source` / `must_cite_paper` — at least one URL or arXiv link.
- `min_distinct_items` — list-output dedup floor.
- `output_pattern` — regex over the full output.
- Custom binary checks (`must_have_position_call`, etc.) — defined per skill family.

## Operations

| Operation | Description |
|---|---|
| `eval` | Run every manifest-defined skill against its latest output. |
| `eval --skill=NAME` | One skill. |
| `bootstrap --skill=NAME` | Generate a starter manifest from recent successful runs. |

## Regression detection

Compares the current run's assertion-pass set against the prior run:

| State | Meaning |
|---|---|
| **NEW_FAIL** | Passing last run, failing now. Severity scales with prior pass streak. |
| **NEW_PASS** | Failing last run, passing now. Logged as a win. |
| **CHRONIC** | Failing > 3 consecutive runs. Recommendation: disable until human review. |
| **STABLE_FAIL** | Always failing. Indicates a manifest assertion that doesn't match the skill's actual output — flag for manifest review. |

Stored in a local `evals-state.json`.

## Bootstrap mode

Pointed at a skill with no manifest, the skill:

1. Samples the last 5 successful run outputs.
2. Computes:
   - `min_words` at p25 of historical runs (so a slightly-shorter run still passes).
   - Required patterns from the most common section headers / structural elements.
   - Forbidden patterns from a default list (refusals, hedging filler, hallucination markers).
   - Custom binary checks where the skill family has them.
3. Emits the proposed manifest for review.

The operator reviews and saves the manifest. The skill never auto-commits a bootstrapped manifest — assertions are observations, and observations need a human signoff.

## Output

```
*Skill Evals — 2026-05-12*

Checked 14 skills against their manifests

PASS (11)
FAIL (2 NEW)
  token-movers — forbidden "as an AI" matched in output
    Pass streak before failure: 17 runs
    Severity: medium (regression, not always-broken)
    Recommended: aeon-skill-repair --target=token-movers

  paper-pick — required section "where it might be wrong" missing
    Pass streak before failure: 8 runs
    Severity: medium
    Recommended: aeon-skill-repair --target=paper-pick

NEW_PASS (1)
  github-trending — back to passing after a fix landed. Closing prior fail record.

CHRONIC (1)
  some-skill — failing 4 consecutive runs on "must_cite_source"
  Recommendation: operator review. Either fix the skill or relax the assertion.

COVERAGE
  3 installed skills have no manifest: huggingface-trending, hn-digest, rss-digest
  Run: bankr-run skill-evals bootstrap --skill=<name>
```

## Pipeline position

- **Downstream of**: any skill that writes output you care about.
- **Upstream of**:
  - `aeon-skill-repair` (failing assertions → fix targets).
  - Operator dashboards (pass rate / regression cadence).

## Guidelines

- Assertions are observations from real output, not specifications. Bootstrap before writing speculatively.
- Forbidden patterns catch hallucination markers and refusals. Keep the list tight; don't lint stylistic choices.
- Chronic failures get a recommendation, not a re-file. Same issue, same response.
- Manifest changes are reviewed; never auto-edited by this skill.
- Coverage gaps (skills without manifests) are surfaced separately — a known unknown is different from a failure.

## Required keys

None — local file evaluation only.

## Pairs with

- `aeon-skill-repair` downstream (consumes failing assertions as fix targets).
- `aeon-autoresearch` when failures are quality-regression rather than deterministic.
- `aeon-skill-security-scan` as a sibling input-safety net.
