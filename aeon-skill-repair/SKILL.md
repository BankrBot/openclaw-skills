---
name: aeon-skill-repair
description: |
  Auto-diagnose and fix failing or degraded skills. Triages systemic first (one shared fix for N
  skills hitting the same root cause), then per-category playbook (api-change, rate-limit, timeout,
  sandbox-limitation, prompt-bug, output-format, missing-secret, config). Every PR includes a
  verification block the operator can execute. Use when one or more skills are failing consecutively
  or producing low-quality output.
  Triggers: "fix skill X", "repair the failing skills", "auto-fix the catalog", "skill X is broken".
---

# aeon-skill-repair

Self-healing fleet. Reads skill-run state, builds a diagnostic dossier (including a regression-hunter pass over git history), classifies the failure category, and applies the matching playbook. Every PR ships with a `## Verification` section the operator can execute manually.

## Phases

`PREFLIGHT → TRIAGE → DIAGNOSE → REPAIR → VERIFY → LOG`

The skill stops early at the appropriate exit code if any phase finds nothing actionable.

## Systemic-first triage

Before treating any single skill, the skill checks for clusters: if 2+ skills fail with the same normalized error signature or category, one shared issue is filed and one shared fix opened — instead of N redundant per-skill patches.

Categories that trigger systemic mode: `api-change`, `rate-limit`, `missing-secret`, `sandbox-limitation`.

## Inputs

| Param | Description |
|---|---|
| `target` | Optional. Skill name to repair. If empty, runs auto-selection. |
| `mode` | `repair` (default) or `dry-run` (diagnose only). |

## Auto-selection rules

Reads `memory/cron-state.json` and `memory/issues/INDEX.md`. Candidates: any skill where

- `consecutive_failures >= 2`, **or**
- `success_rate < 0.5` and `total_runs >= 3`, **or**
- `last_status == failed` and `last_failed` within 48h, **or**
- `last_quality_score <= 2` (degraded output).

Sort: critical issue > high issue > consecutive_failures desc > lowest success_rate > stalest `last_success`. Skip `permanent-limitation` and any target under cooldown.

## Diagnostic dossier

Built before touching any file. Six sources, each tagged `ok` / `empty` / `fail`:

1. **Skill file** — frontmatter, declared data sources, env-var references.
2. **Cron state** — `last_error`, `consecutive_failures`, `success_rate`, `last_quality_score`.
3. **Regression hunter** — `git log --since=$LAST_SUCCESS` against the skill file, `aeon.yml`, `scripts/`. A single suspect commit becomes the prime root-cause hypothesis.
4. **Recent failed runs** — `gh run view --log-failed` for the last 5 + check-run annotations for cleaner error rows.
5. **Logs** — last 3 days of run logs for the skill name.
6. **Eval assertions** — if the skill has an `aeon-skill-evals` manifest, the failing assertions become the fix target.

Distinguish **consistent** (same signature 4–5/5 runs → deterministic bug) from **intermittent** (1–2/5 → rate limit, flaky upstream).

## Per-category playbooks

| Category | Playbook |
|---|---|
| `api-change` | WebFetch the live spec/status page. Update endpoints, payload, headers. Cite the spec URL in the PR. Never guess — if WebFetch fails, drop to `REPAIR_DIAGNOSED_NO_FIX`. |
| `rate-limit` | Add backoff or fallback endpoint. Never raise the limit from the skill side. |
| `timeout` | Stage the work, add early-return on partial success, downgrade model if not Opus-critical. |
| `sandbox-limitation` | Convert auth-bearing curls to the prefetch (`scripts/prefetch-*.sh`) or postprocess (`.pending-*/` + `scripts/postprocess-*.sh`) pattern. |
| `prompt-bug` | Minimum-edit specificity insertion. Don't rewrite — add the missing constraint, a forbidden phrase, a required output structure. < 30 lines diff. |
| `output-format` / `quality-regression` | Cross-reference `aeon-skill-evals` assertions. Edit until the next run satisfies the failing assertion. |
| `missing-secret` | **Do not modify the workflow.** File an issue naming the secret, notify operator, exit `REPAIR_DIAGNOSED_NO_FIX`. |
| `config` | Reversible `aeon.yml` edits only — `schedule`, `var`, `model`, `enabled: false`. Keep diff < 5 lines. |
| `unknown` | Don't edit blindly. Append the dossier to the issue file as `## Diagnosis Notes`, exit `REPAIR_DIAGNOSED_NO_FIX`. |

## Risk classes (gate the PR)

| Class | Scope | Auto-merge? |
|---|---|---|
| **LOW** | Clarifying prompt, fallback, comment-only, < 30 lines diff. | Yes |
| **MED** | Data source change, new env-var reference (already in workflow), output format edit. | Yes if tests pass |
| **HIGH** | Touches workflows, removes features, disables a skill, modifies `scripts/*.sh`. | **No — `manual-review` label, human only.** |

## Verification block

Every PR (except `REPAIR_DIAGNOSED_NO_FIX`) includes:

```markdown
## Verification

**Manual trigger:** dispatch the skill with `skill=${target}` and `var=${var}`.

**Expected:**
- Workflow conclusion: `success`
- Output matches: `${eval_pattern or "memory/logs/${today}.md mentions ${target}"}`
- ${category-specific signal}

**If still failing after this PR:** delete `memory/state/skill-repair-history.json[${target}]` to clear cooldown, then re-dispatch for a second pass.
```

## Cooldown

A target cannot be repaired twice within 24h without operator clearing `memory/state/skill-repair-history.json`. Prevents repair loops on fixes that didn't stick.

Also rate-limits: max 3 skill-repair PRs per UTC day.

## Exit taxonomy

| Code | Meaning |
|---|---|
| `REPAIR_OK_FIXED` | Per-skill fix applied, PR opened. |
| `REPAIR_OK_SYSTEMIC` | Shared root cause across N skills — single shared fix or shared issue filed. |
| `REPAIR_DIAGNOSED_NO_FIX` | Root cause known, needs operator action. |
| `REPAIR_NO_TARGETS` | Fleet healthy. |
| `REPAIR_DRY_RUN` | Diagnostic only. |
| `REPAIR_BLOCKED` | Preflight failed or cooldown active. |

## Guardrails

- One target per run (or one systemic cluster).
- Minimum-edit principle — diffs are small. The fix is rarely "rewrite the skill".
- Never modify workflow files, secrets, or the messages spec.
- Never push to main — branch + PR only.
- HIGH-risk PRs are human-merge only.

## Pairs with

- `aeon-skill-evals` upstream (surfaces what's failing).
- `aeon-autoresearch` for quality-lift evolution (this skill handles deterministic bugs).
