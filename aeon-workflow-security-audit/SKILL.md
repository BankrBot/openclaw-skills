---
name: aeon-workflow-security-audit
description: |
  Audit GitHub Actions workflows and composite actions with zizmor + actionlint plus hand-rolled
  checks. Classify findings against the prior audit (NEW / REINTRODUCED / UNCHANGED / RESOLVED),
  auto-fix Critical/High regressions via env: rebind, open a PR only when something actually
  changed. Silent on clean and unchanged runs. Use weekly or after adding/modifying a workflow.
  Triggers: "audit my workflows", "scan .github for injection", "check CI security",
  "workflow security audit", "fix the toJson injection".
---

# aeon-workflow-security-audit

CI security audit designed to surface *changes* — new vulnerabilities and regressions of previously fixed ones. Not "run monthly and paste findings". Built around zizmor (Trail of Bits' SARIF-capable Actions auditor) and actionlint, with hand-rolled checks for patterns the tools miss.

The whole point: silence is correct on a clean week. Notify on inflection points so it doesn't train the operator to ignore the channel.

## Preflight

```bash
# zizmor (pin for reproducibility)
ZIZMOR_VERSION="1.24.1"
pipx install "zizmor==${ZIZMOR_VERSION}" || python3 -m pip install --user "zizmor==${ZIZMOR_VERSION}"

# actionlint
bash <(curl -sL https://raw.githubusercontent.com/rhysd/actionlint/main/scripts/download-actionlint.bash)
```

If both fail to install, exit `WORKFLOW_AUDIT_TOOL_FAIL` and notify once.

## Targets

```bash
find .github/workflows -maxdepth 2 -type f \( -name "*.yml" -o -name "*.yaml" \)
find .github/actions -type f \( -name "action.yml" -o -name "action.yaml" \)
```

## Scanners and severity mapping

**zizmor** (primary, SARIF):

| zizmor level + confidence | Our severity |
|---|---|
| `error` + confidence ≥ high | **Critical** |
| `error` (other confidence) OR `warning` + confidence=high | **High** |
| `warning` | **Medium** |
| `note` | **Low** |

**actionlint** (secondary): raise to High when touching `expression` rule or shellcheck SC2086/SC2046 over a `${{ github.* }}` interpolation; else Medium.

**Hand-rolled backstop checks** (always run):

| Pattern | Severity |
|---|---|
| `toJson(github.event.*)` piped into shell or via `$(...)` | Critical |
| `persist-credentials: true` + checkout `ref: ${{ github.event.pull_request.head.sha }}` | Critical on `pull_request_target`, High on `workflow_run` |
| `GITHUB_ENV` / `GITHUB_OUTPUT` writes with user-controlled data (newline injection) | High |
| Spawn/dispatch/chain-runner jobs passing `${{ inputs.* }}` directly into `gh workflow run`, `gh api dispatches`, or a `run:` shell | High |
| Mutable third-party action ref (`uses: owner/action@branch`, where owner ∉ trusted vendors) | Medium |

## Delta classification

Findings are fingerprinted by `sha256(rule_id + file + step_name_or_context)` — anchored to step name where available so line drift on unrelated edits doesn't invalidate the hash.

Vs the most recent prior report:

- **NEW** — fingerprint absent from prior.
- **REINTRODUCED** — was marked auto-fixed or resolved, now back.
- **UNCHANGED** — present in both.
- **RESOLVED** — present prior, gone now.

## Auto-fix scope

**Only NEW and REINTRODUCED Critical/High.** UNCHANGED findings are not thrashed — they either failed a prior auto-fix or are known-manual.

### Script-injection fix template

```yaml
# BEFORE
- name: Step
  run: |
    VAR="${{ inputs.user_input }}"

# AFTER
- name: Step
  env:
    _USER_INPUT: ${{ inputs.user_input }}
  run: |
    VAR="$_USER_INPUT"
```

### toJson-into-shell fix template

```yaml
# BEFORE
MESSAGE=$(echo '${{ toJson(github.event.client_payload.message) }}' | jq -r '.')

# AFTER
env:
  _PAYLOAD: ${{ toJson(github.event.client_payload.message) }}
...
MESSAGE=$(printf '%s' "$_PAYLOAD" | jq -r '.')
```

### Idempotency check before fixing

Inspect the step's `env:` block. If a key (`_*`) already maps to the same expression as the vulnerable interpolation, the fix is in place — flag as stale. Validate YAML loads after every edit; revert and flag `Manual required — invalid YAML` if not.

### Manual-only categories

`permissions`, `unpinned-uses`, and `persist-credentials` findings are **never** auto-fixed. Operator judgment required (which jobs need write scope, intended commit SHA verification).

## Exit modes

| Mode | Condition | Notify? | PR? |
|---|---|---|---|
| `CLEAN` | No findings. | No | No |
| `UNCHANGED` | Only carry-overs. | No | No |
| `NEW_INFO` | New medium/low only. | No (logged) | Optional |
| `NEW_HIGH` | New high (no critical). | Yes | Yes |
| `NEW_CRITICAL` | New critical. | Yes | Yes |
| `REGRESSION` | Reintroduced finding. | Yes | Yes |
| `TOOL_FAIL` | Both scanners unavailable. | Yes (once) | No |

## Report format

`articles/workflow-security-audit-${today}.md`. Per Critical/High finding, an **attack-chain narrative**:

1. **Entry** — trigger + who can reach it (external, collaborator, scheduled).
2. **Vector** — which field is attacker-controlled.
3. **Sink** — where it gets evaluated (shell, `with:`, github-script, `GITHUB_ENV` write).
4. **Reachable secrets** — secrets in scope at this step.
5. **Blast radius** — what the reachable token can do (push, dispatch, comment, cross-repo).

Medium/Low get a compact table.

A fingerprint trailer at the bottom is the machine-readable input to the next run's delta classification — never strip it.

## PR lifecycle

- Reuses an open `fix/workflow-security-audit` branch — comments on the existing PR.
- Version-suffixes the branch only if the prior PR was closed/merged.
- Never creates duplicate PRs.

## Guardrails

- Never auto-fixes UNCHANGED findings.
- Never auto-fixes permissions / pinning / `persist-credentials`.
- Never destructive git on main.
- `CLEAN` and `UNCHANGED` exit modes write a log entry only — no PR, no notify.
- `TOOL_FAIL` reports an error; never declares clean.
