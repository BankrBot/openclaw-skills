---
name: aeon-skill-repair
description: |
  Auto-diagnose and fix a failing or degraded installed skill. Reads the SKILL.md plus recent error
  output, classifies the failure category (api-change / rate-limit / timeout / sandbox-limitation /
  prompt-bug / output-format / missing-secret / config), and applies the matching playbook. Every
  fix includes a verification block the operator can execute. Use when a previously-working skill
  has started failing or producing low-quality output.
  Triggers: "fix this skill", "skill X is broken", "diagnose this failure", "auto-repair my
  failing skill", "the output of X looks wrong".
---

# aeon-skill-repair

Targeted repair for a single failing skill. Builds a diagnostic dossier, classifies the failure into a known category, and applies the corresponding playbook with a minimum-edit principle. Every repair ships with a verification step.

## Phases

`PREFLIGHT → DIAGNOSE → REPAIR → VERIFY`

The skill stops at the appropriate exit code if any phase finds nothing actionable.

## Inputs

| Param | Description |
|---|---|
| `target` | Skill name or SKILL.md path. Required. |
| `error_output` | Optional. The skill's recent failed output (paste from run log). If absent, the skill will ask for it before proceeding. |
| `mode` | `repair` (default) — apply the fix. `dry-run` — diagnose and propose without writing. |

## Diagnostic dossier

Before touching any file, the skill assembles:

1. **Skill file** — reads the target SKILL.md. Identifies frontmatter, declared data sources, env-var references.
2. **Error analysis** — parses `error_output` for known signatures (HTTP status codes, common API error strings, rate-limit hits, timeout patterns, refusal markers).
3. **Source liveness check** — if the skill references URLs / APIs, WebFetch each to check for 404s, redirects, or schema changes.
4. **Frontmatter integrity** — verifies the skill's frontmatter is valid YAML.
5. **Reference parity** — if the skill links references files, verifies they exist.

## Categories and playbooks

| Category | Detection signal | Playbook |
|---|---|---|
| **api-change** | 404, 410, schema mismatch, deprecated endpoint warning | WebFetch the live API spec / status page / release notes. Update endpoints, payload shape, headers, error codes. Cite the spec URL in the fix notes. |
| **rate-limit** | 429, "too many requests", rolling-window quota error | Add backoff or fallback endpoint. Never raise the limit from the skill side. If the skill's invocation cadence is too aggressive, recommend reducing it but don't change it unilaterally. |
| **timeout** | Skill takes too long, partial output, killed mid-run | Stage the work, add early-return on partial success, downgrade the model if it doesn't need the most capable tier. |
| **sandbox-limitation** | Outbound curl fails with auth headers; secrets not expanded in shell | Convert curls to a prefetch pattern (write to a state file before the agent runs) or postprocess pattern (write requests to a queue, process after). |
| **prompt-bug** | Hallucination, refusal ("as an AI..."), missing required output section | Minimum-edit specificity insertion. Add the missing constraint, a forbidden phrase, a required output structure. Don't rewrite — < 30 lines diff. |
| **output-format / quality-regression** | Output passes execution but fails downstream parser; eval assertions fail | Cross-reference the skill's eval manifest if one exists; edit until the next run satisfies the failing assertion. |
| **missing-secret** | `not configured`, `API key missing`, env var unset | **Do not modify the skill.** Identify the missing env var by name, write a short note for the operator. Exit `REPAIR_DIAGNOSED_NO_FIX`. |
| **config** | Bad input config (watchlist, distribution list, RSS feeds) | Validate the config file shape, fix obvious errors (trailing commas, malformed YAML), but never invent entries. |
| **unknown** | None of the above | Don't edit blindly. Append the full dossier to a `repair-notes.md` file next to the skill, exit `REPAIR_DIAGNOSED_NO_FIX`. Operator triages. |

## Risk classes

Every proposed fix is labeled:

| Class | Scope | Auto-apply? |
|---|---|---|
| **LOW** | Clarifying prompt edit, fallback added, comment-only change, < 30 lines diff. | Yes |
| **MED** | Data source change, new env-var reference (must already be available), output format edit. | Yes with verification |
| **HIGH** | Touches behavior fundamentally, removes features, changes default config. | **No — operator review required.** |

## Verification block

Every repair (except `REPAIR_DIAGNOSED_NO_FIX`) emits a verification recipe:

```
## Verification

To verify this repair worked:

1. Re-run the skill: `<one-line invocation>`
2. Expected behavior: <category-specific signal — e.g. "no rate-limit errors in output" /
   "produces ≥ 200 words" / "output matches required pattern X">
3. If still failing: <fallback path — e.g. "the error category may have been mis-classified;
   delete the repair-history entry and re-run repair">
```

## Output

```
*Skill Repair — token-movers — 2026-05-12*

Diagnosis
  Category: api-change
  Signal: HTTP 410 from /v1/markets endpoint (consistent across 5 recent runs)
  Root cause: CoinGecko deprecated v1 in favor of /api/v3/coins/markets

Fix applied
  Updated 3 endpoint references in skills/token-movers/SKILL.md
  Risk: MED (data source change, no new env vars)
  Diff: +12 -9 lines

Verification
  Re-run: bankr-run token-movers
  Expected: output contains "Top movers" header, lists ≥ 5 coins, no HTTP 410 errors in trace

Notes
  CoinGecko v1 deprecation announced 2026-02-15. v3 schema is broadly compatible — field names
  preserved. If field-level differences surface in production, re-run skill-repair against the
  new error signature.
```

## Cooldown

A skill cannot be auto-repaired more than once in a 24h window without operator confirmation. Prevents repair loops on fixes that didn't stick. The cooldown state is stored in a local `repair-history.json`.

## Guardrails

- One target per run. Never bundles unrelated repairs.
- Minimum-edit principle. Diffs are small.
- Never modifies env-var configuration; missing secrets are flagged for the operator.
- HIGH-risk fixes are proposed, not applied.
- For repairs inside a git repo, changes land in a branch (`repair/${target}`), never directly on main.

## Required keys

None directly. The `api-change` playbook may use WebFetch to look up live API specs.

## Pairs with

- `aeon-skill-evals` upstream (surfaces what's failing).
- `aeon-autoresearch` for quality lifts vs deterministic bugs.
