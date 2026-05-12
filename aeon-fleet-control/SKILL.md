---
name: aeon-fleet-control
description: |
  Monitor and operate a fleet of agent instances — check health across registered instances,
  dispatch skills to one or many, aggregate output across the fleet, quarantine suspect instances.
  Parent-side control plane for multi-agent topologies. Use when running multiple specialized
  child agents and needing consolidated status, cross-fleet dispatch, or aggregated reporting.
  Triggers: "fleet status", "dispatch X to my agents", "aggregate Y across instances",
  "quarantine instance Z", "what's running across the fleet".
---

# aeon-fleet-control

Parent-side control plane for an agent fleet. Reads the registered-instances list (populated by `aeon-spawn-instance`), pulls live health from each, dispatches skills against one or many, and aggregates output into a single decision-ready view.

For the multi-agent topology where one parent operator runs N specialized child agents and needs to (a) know when one is down, (b) trigger work across the fleet without N manual dispatches, and (c) consolidate fleet output without context-switching.

## Operations

| Operation | Description |
|---|---|
| `status` | Health check across every registered instance. |
| `dispatch --skill=NAME [--target=INSTANCE]` | Trigger a skill on one or all instances. |
| `aggregate --skill=NAME` | Pull and merge the latest output of a skill from every instance. |
| `quarantine --instance=NAME` | Exclude from dispatch and aggregation (reversible). |
| `archive --instance=NAME` | Permanently remove from the registry (operator confirmation required). |

## Health per instance

For each registered instance, the skill checks:

| Signal | Source |
|---|---|
| Last successful workflow run | `gh run list --workflow=aeon.yml` |
| 7-day pass rate | Aggregated from recent runs |
| Pending-secrets status | Workflow runs all fail → secrets not set |
| Open critical issues | The instance's `memory/issues/INDEX.md` |
| Reachability | Fork accessible, Actions enabled |
| Wallet balance (if Bankr-linked) | Bankr Wallet API via the instance's key |

Verdict per instance:

| Status | Meaning |
|---|---|
| **HEALTHY** | Recent successful run, pass rate ≥ 90%. |
| **DEGRADED** | Pass rate 70–90% or one chronic skill failure. |
| **STALLED** | No successful run in 4+ days. |
| **PENDING_SECRETS** | Instance configured but never had a successful run. |
| **UNREACHABLE** | Fork inaccessible, Actions disabled, or auth lost. |
| **QUARANTINED** | Operator-marked, excluded from operations. |

## Dispatch

Uses `gh workflow run` with `workflow_dispatch` inputs:

```bash
gh workflow run aeon.yml --repo "${OWNER}/${INSTANCE_REPO}" \
  -f skill="${SKILL_NAME}" -f var="${VAR_VALUE}"
```

The skill:
- Resolves the target set (single, all healthy, or tag-filtered).
- Validates each target has the requested skill enabled.
- Records dispatched run IDs to `state/fleet-dispatches.json` so `status` can later report outcomes.
- Respects per-instance rate limits — never floods one instance.

**Dispatch never propagates secrets** — only `inputs`.

## Aggregation

For "give me skill X across every healthy instance":

1. Pull the most recent workflow run output for skill X from each instance via the GitHub API.
2. Normalize into one structured output (per-instance section, sorted by signal score or recency).
3. Dedupe content where instances overlap (same source, same finding).

Useful for: cross-fleet `narrative-tracker` reads, multi-instance `monitor-runners` consolidation, fleet-wide `vuln-scanner` reports.

## Quarantine vs archive

- **Quarantine** is reversible. The instance stays in the registry, excluded from dispatch and aggregation until un-quarantined.
- **Archive** is permanent. Used when an instance is decommissioned. Requires explicit operator confirmation.

## Output

`status` produces a single-screen view:

```
*Fleet Control — 2026-05-12*

Verdict: FLEET_DEGRADED — 1 of 7 instances stalled

HEALTHY (4)
  defi-watch         pass 94%   ↳ last run 2h ago
  prediction-watch   pass 91%   ↳ last run 4h ago
  repo-watch         pass 98%   ↳ last run 1h ago
  social-watch       pass 92%   ↳ last run 30m ago

DEGRADED (1)
  macro-watch        pass 76%   3 of 14 skills failing — see ISS-091

STALLED (1)
  contracts-watch    no successful run in 4 days
                     Last error: workflow disabled (likely Actions perm flipped)
                     Recovery: re-enable Actions at https://github.com/owner/aeon-contracts-watch/...

PENDING_SECRETS (1)
  nft-watch          created 2 days ago, awaiting secrets

Cross-fleet wallet totals (Bankr Wallet API)
  Total USDC across healthy instances: $1,847
  Total native ETH: 0.43

Active dispatches: 2 in progress, 1 completed in last 6h
```

## Bankr-aware fleets

When instances use Bankr-backed wallets, `fleet-control` can surface cross-fleet treasury totals — sum of wallet balances across all healthy instances via per-key `GET /wallet/portfolio` calls. Useful for treasury sanity checks before fleet-wide `distribute-tokens` runs.

## Guidelines

- Never propagate secrets across the fleet. Each instance manages its own.
- Dispatch is fire-and-forget — record the run ID, don't block waiting for results.
- Aggregation is read-only — never writes back to child instances.
- Quarantine is reversible; archive is permanent and requires operator confirmation.
- Cross-fleet wallet totals are read-only — no transfers happen from this skill.

## Pairs with

- `aeon-spawn-instance` (the source of registered instances).
- `aeon-operator-scorecard` (weekly synthesis across the fleet).
