---
name: aeon-skill-evals
description: |
  Validate skill outputs against assertion manifests, diff vs prior runs to flag regressions, file
  issues for new failures, queue concrete fixes. Production-grade quality net for the skill catalog.
  Use for continuous quality monitoring, pre-deploy gates on new skill variations, or triage source
  for systemic catalog issues.
  Triggers: "evaluate my skills", "check skill output quality", "regression scan", "bootstrap evals
  for skill X", "which skills are failing assertions".
---

# aeon-skill-evals

Quality net for the skill catalog. Each skill can declare an assertion manifest — pattern matches, word-count floors, forbidden phrases, required structure. Every run's output is checked against the manifest; failing assertions produce regression alerts and queued fixes routed to `aeon-skill-repair`.

The job isn't to prevent bad output. It's to catch it the moment it ships and route the fix before a human notices.

## Manifest format

```yaml
# evals.json (or YAML)
token-movers:
  min_words: 200
  required_patterns:
    - "Top movers"
    - "24h"
  forbidden_patterns:
    - "I cannot"
    - "as an AI"
  output_pattern: "memory/logs/*.md"
  min_distinct_tokens: 5
  must_cite_source: true

narrative-tracker:
  min_words: 400
  required_patterns:
    - "TRANSITIONS"
    - "MAP"
  required_sections:
    - "transitions"
    - "positions"
  forbidden_patterns:
    - "exciting"
    - "consider"
  must_have_position_call: true
```

Assertion types: minimum/maximum word counts, required substrings, forbidden phrases, output-shape regex, source-citation requirements, deduplication minimums, per-section presence checks, position-call requirements.

## Regression detection

Compares the current run's assertion-pass set against the prior run's:

| State | Meaning | Action |
|---|---|---|
| **NEW_FAIL** | Passing last run, failing now. | File an issue; severity scales with prior pass streak. |
| **NEW_PASS** | Failing last run, passing now. | Close the open issue, log the win. |
| **CHRONIC** | Failing > 3 consecutive runs. | Escalate severity, recommend `enabled: false` until repair. |
| **STABLE_FAIL** | Always failing. | Don't re-file; flag as known issue needing redesign. |

## Issue filing

For each `NEW_FAIL`, files a structured issue:

```yaml
---
id: ISS-104
title: "token-movers: forbidden 'as an AI' matched in output"
status: open
severity: medium
category: quality-regression
detected_by: aeon-skill-evals
detected_at: 2026-05-12
affected_skills: [token-movers]
---

## Failing assertion
forbidden_patterns: "as an AI"

## Where it appeared
memory/logs/2026-05-12.md, line 42 of token-movers output

## Pass streak before failure
17 consecutive runs

## Recommended next
aeon-skill-repair --target=token-movers (category: prompt-bug)
```

## Bootstrap mode

Pointed at a skill with no manifest:

| Field | How bootstrapped |
|---|---|
| Word-count floor | p25 of historical successful runs. |
| Required patterns | Most common section headers in recent successful outputs. |
| Forbidden patterns | Default list (refusals, hedging filler, hallucination markers). |
| Output pattern | The skill's actual write target. |

Proposed manifest is presented as a PR for review, never auto-committed.

## Output

```
*Skill Evals — 2026-05-12*

47 skills checked
  42 PASS
  3 NEW_FAIL — issues filed
  2 NEW_PASS — issues closed
  5 CHRONIC — operator review recommended
  1 coverage gap (no manifest)

NEW_FAIL details
  token-movers — forbidden "as an AI" matched (3-line refusal in output)
    Pass streak before failure: 17 runs
    Severity: medium (regression, not always-broken)
    Filed: ISS-104, recommended next: aeon-skill-repair --target=token-movers

  daily-routine — required pattern "Top tokens" absent (output truncated)
    Pass streak before failure: 8 runs
    Severity: medium
    Filed: ISS-105, recommended next: aeon-skill-repair --target=daily-routine

  narrative-tracker — min_words 400 not met (actual 220 — empty signals day)
    This may be expected on a quiet day; flagged as intermittent.

NEW_PASS
  github-trending — back to passing after autoresearch evolution last week. ISS-098 closed.
  paper-pick — back to passing after repair PR #412 landed. ISS-101 closed.

CHRONIC — recommend operator review
  ai-framework-watch (4 runs failing): required pattern "watchlist" absent
  ...

Coverage
  46/47 skills have manifests; bootstrap recommended for: spawn-instance
```

## Pipeline integration

- **Downstream of:** any skill that writes output.
- **Upstream of:**
  - `aeon-skill-repair` (uses failing assertions as fix targets).
  - `aeon-skill-health` (consumes pass-rate over time).
  - `aeon-operator-scorecard` (weekly synthesis input).

## Guidelines

- Assertions are observations, not specifications. Bootstrap from real output, don't write speculatively.
- Forbidden patterns catch hallucination markers and refusals — keep the list tight.
- Chronic failures get escalated, not re-filed.
- Manifest changes go through PR, never inline.
- Coverage gaps (skills without manifests) are surfaced separately — they're a different problem from failures.

## Pairs with

- `aeon-skill-repair` (downstream — fixes the failures).
- `aeon-autoresearch` (when failures are quality-regression, not deterministic).
