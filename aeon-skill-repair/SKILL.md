---
name: aeon-skill-repair
description: |
  Auto-diagnose and fix a failing or degraded installed skill. Reads the SKILL.md plus recent
  error output, classifies the failure (api-change / rate-limit / timeout / sandbox-limitation /
  prompt-bug / output-format / missing-secret / config), applies the smallest fix that addresses
  the root cause, and attaches a verification recipe. Minimum-edit principle, never auto-applies
  high-risk changes.
  Triggers: "fix this skill", "skill X is broken", "diagnose this failure", "the output of X
  looks wrong".
---

# aeon-skill-repair

Targeted repair for one failing skill. Build a diagnostic dossier, classify the failure, apply the matching playbook, attach a verification recipe.

## Inputs

| Param | Description |
|---|---|
| `target` | Skill name or SKILL.md path. Required. |
| `error_output` | Recent failed output (paste from run log). Required if not auto-detectable. |
| `mode` | `repair` (default) or `dry-run` (diagnose only). |

## Diagnosis sources

- The skill file (frontmatter, declared sources, env-var references).
- Error output signature (HTTP codes, common API errors, rate-limit hits, refusal markers).
- Source liveness — WebFetch on referenced URLs to detect 404s, redirects, schema changes.
- Frontmatter integrity (valid YAML).

## Failure categories and fix scope

| Category | Detection | Fix scope |
|---|---|---|
| `api-change` | 404/410, schema mismatch | Update endpoints/payload/headers per live spec. Cite the spec URL. |
| `rate-limit` | 429, "too many requests" | Add backoff or fallback endpoint. Never raise the limit. |
| `timeout` | Killed mid-run, partial output | Stage the work, add early-return on partial success. |
| `sandbox-limitation` | Auth-bearing curl fails | Convert to prefetch / postprocess pattern. |
| `prompt-bug` | Hallucination, refusal, missing required section | Minimum-edit specificity insertion. < 30 lines diff. |
| `output-format` | Output passes execution but fails downstream parser | Edit until next run satisfies the failing assertion. |
| `missing-secret` | "API key missing", env var unset | **No code change.** Name the missing var for the operator. Exit `REPAIR_DIAGNOSED_NO_FIX`. |
| `config` | Bad input config (watchlist, list file) | Fix obvious shape errors. Never invent entries. |
| `unknown` | None of the above | Don't edit blindly. Append dossier to repair-notes, exit `REPAIR_DIAGNOSED_NO_FIX`. |

## Risk classes

- **LOW** — fallback added, comment-only, < 30 lines. Auto-applied.
- **MED** — data source change, output format edit. Auto-applied with verification recipe.
- **HIGH** — touches behavior fundamentally, changes defaults. **Operator review required, not auto-applied.**

## Verification recipe (every repair)

```
1. Re-run the skill: <one-line invocation>
2. Expected: <category-specific signal — "no rate-limit in trace" / "≥ 200 words" / "matches pattern X">
3. If still failing: <fallback path>
```

## Cooldown

24h cooldown per skill — prevents repair loops on fixes that didn't stick. State in local `repair-history.json`.

## Rules

- One target per run. Never bundle unrelated repairs.
- Minimum-edit principle. Small diffs.
- Never modify env-var configuration. Missing secrets are flagged for the operator.
- Inside a git repo: branch + diff, never directly to main.
