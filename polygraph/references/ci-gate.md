# Polygraph CI gate (GitHub Action)

Polygraph grades MCP servers and Agent Skills; the **CI gate** turns that grade into a build
check. Add it to a repo and the build **fails when an MCP server or a Skill it ships grades D/F** —
the same falsifiable grade described in [`../SKILL.md`](../SKILL.md), enforced on every pull request.

It wraps the open `@polygraphso/litmus` harness, so the gate is **reproducible**: anyone can re-run
it and the verdict must match. A grade is a *measurement, not a guarantee* — the gate catches a
target that misbehaves under the probes, not one that evades them.

---

## Add it to a repo

```yaml
# .github/workflows/mcp-gate.yml
name: mcp-gate
on: [pull_request]          # NOT pull_request_target — that runs with secrets in an untrusted fork's context
permissions:
  contents: read
jobs:
  gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: polygraphso/litmus@<commit-sha>   # pin a SHA, not the mutable @v1 tag, for a security gate
        with:
          # Name targets explicitly (recommended on public repos). Discovery is OFF by default.
          servers: |
            npm/@modelcontextprotocol/server-filesystem
          skills: |
            ./my-skill
          # discover: "true"  # opt in to .mcp.json/.vscode/.cursor + SKILL.md discovery — trusted repos only
          # min-grade: B      # stricter than the default D/F gate
          # strict: "true"    # also fail on targets that can't be graded
```

That is the whole setup. On each PR the action grades every named (or, with `discover: true`,
discovered) MCP server **and** skill, and fails the job on any **D** or **F**.

---

## Security on CI (read before enabling on a public repo)

Grading a server **runs its code** — the harness connects and exercises its tools (egress is
contained in a default-deny Docker sandbox, but the server still executes). On CI that means:

- **Trigger on `pull_request`, never `pull_request_target`.** `pull_request_target` runs with the
  base repo's secrets in the context of an untrusted fork's code — combined with a gate that
  executes targets, that is a credential-exfiltration path.
- **Don't expose secrets to untrusted PRs.** Fork PRs on `pull_request` get no secrets by default;
  keep it that way. Don't pass tokens/`bearer` into a job that grades fork-controlled targets.
- **Prefer an explicit allowlist over discovery on public repos.** Discovery is **off by default**;
  a PR can add a `.mcp.json` / `.vscode` / `.cursor` entry or a `SKILL.md` dir pointing at an
  attacker-chosen package, and `discover: true` would grade (run) it. Name `servers:` / `skills:`
  explicitly, or only enable discovery where the config isn't attacker-controllable.
- **Pin the action to a commit SHA** (`polygraphso/litmus@<sha>`), not the mutable `@v1` tag, and
  keep the `version` input pinned so the harness is reproducible.
- **`bearer` is sent as an `Authorization` header to the target.** Pass it only for an explicitly
  trusted, pinned remote; use a scoped, short-lived token; never with discovery or on untrusted PRs.

---

## How the gate decides

**MCP servers** — for each, in order:

1. **Published-grade lookup** — a sub-second check for an existing polygraph grade (the same data
   as `npx polygraphso check`). If one exists, it is used directly.
2. **Behavioral run** — if the server is not graded yet, the action runs the open harness in CI.
   GitHub runners provide Docker, so the egress probe is exercised for local/npm servers (no B cap),
   and the server is graded fresh.

**Agent Skills** — each `SKILL.md` bundle is graded by the **static** skill grader
(`runSkillLitmus`): a scan of its bytes, no execution, no Docker, no network. Fast and deterministic.

**Un-gradeable** — a target that can't be reached (a credential-gated server) or whose launch
command can't be mapped to a ref is reported and **warns** (it does not fail the build) unless you
set `strict: true`.

Gate result (servers and skills share one gate and one exit code):

| Outcome | Build |
|---|---|
| Every target grades **A / B** (or ≥ `min-grade`) | passes (exit 0) |
| Any target grades **D / F** (or below `min-grade`) | **fails** (exit 1) |
| A target cannot be graded | warns + passes, unless `strict: true` |

A **remote (HTTP) server caps at B** and passes — that is a limit of the measurement, not a mark
against the server (see "Reading a B" in [`../SKILL.md`](../SKILL.md)).

---

## Inputs

| Input | Default | Description |
|---|---|---|
| `servers` | — | Explicit MCP refs (newline- or comma-separated). Merged with discovery when on. |
| `skills` | — | Explicit skill directories (newline- or comma-separated). Merged with discovery when on. |
| `discover` | `false` | Discover targets from config files and `SKILL.md`. Off by default — opt in on trusted repos only (discovered targets are PR-controllable and grading runs their code). |
| `min-grade` | — | Minimum acceptable grade (`A`–`D`). Default gates on D/F. |
| `strict` | `false` | Treat un-gradeable targets as failures, not warnings. |
| `working-directory` | `.` | Directory scanned for MCP config files and `SKILL.md` bundles. |
| `version` | pinned | `@polygraphso/litmus` version to run (keep it pinned). |
| `api-url` | — | Override the lookup endpoint. HTTPS enforced; point only at the official endpoint or a mirror you trust. |
| `bearer` | — | Sent as an `Authorization` header to a gated remote (HTTPS) target. Trusted pinned remote only; scoped, short-lived; never with discovery or on untrusted PRs. |

Outputs: `result` (`pass` / `fail`), `failed` (count), and `report` (a JSON array of per-target
results, each with its `kind` of `server` or `skill`) — read them from a later step via
`steps.<id>.outputs.*`.

---

## Discovery

The action reads the standard MCP config files and maps each server's launch command to a
registry-prefixed ref, and walks the repo for `SKILL.md` bundles:

| Target | Discovered as |
|---|---|
| `{ "command": "npx", "args": ["-y", "@scope/srv"] }` | server `npm/@scope/srv` |
| `{ "command": "uvx", "args": ["srv-mcp"] }` | server `pypi/srv-mcp` |
| `{ "url": "https://example.com/mcp" }` | server — the HTTPS endpoint (remote) |
| a directory containing `SKILL.md` | skill — that directory |
| a bare binary / local script | reported as **un-gradeable** (never silently skipped) |

`node_modules`/`.git`/`dist`/etc. are pruned from the skill walk, and anything that can't be mapped
is surfaced rather than dropped — so coverage stays honest.

---

## Run it anywhere (not just GitHub)

The gate is a plain command in the harness, so it also works in any other CI or as a pre-commit
check:

```bash
# Gate the MCP servers and skills discovered in your own repo (pin the version):
npx @polygraphso/litmus@<version> ci

# In untrusted CI, turn discovery off and name targets explicitly:
npx @polygraphso/litmus@<version> ci --no-discover --server npm/@scope/your-mcp --skill ./your-skill --min-grade B --strict
```

It exits non-zero on a gated target, so any pipeline can use it. `--json` emits the full per-target
report; `--no-discover` and `--no-lookup` narrow what it does. Note the asymmetry: the **standalone
CLI discovers by default** (convenient for gating your own repo, and it prints a warning when it
does), while the **GitHub Action defaults discovery off** (the CI/PR surface, where config is
attacker-controllable). In untrusted CI, pass `--no-discover` and an explicit allowlist.

---

## Honest limits (carry these into your pipeline)

- **Reproducibility is the trust anchor.** The harness is open and deterministic, so the gate's
  verdict is falsifiable — not a black box.
- A passing gate means *these targets did not misbehave under these probes* — **not** that they are
  safe in every situation. A skill grade is a **static** read of its text and bundle — **not
  equivalent** to a behavioral server grade: static scanning can't see a command built or fetched at
  runtime, or a bundled script that runs on install. Treat a skill that executes install-time code or
  carries transaction instructions as needing manual security review regardless of its letter.
  **Evasion** (a server that detects the test context) is the disclosed residual limit.
- The gate does not replace your own runtime guards (for example, Bankr's transaction-verification
  checks — see [`bankr-integration.md`](bankr-integration.md)).

See [`../SKILL.md`](../SKILL.md) for the grade scale and [`methodology.md`](methodology.md) for the
probes behind each grade.
