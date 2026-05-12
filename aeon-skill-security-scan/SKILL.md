---
name: aeon-skill-security-scan
description: |
  Audit skills, workflows, and companion scripts for injection, exfiltration, traversal, and
  prompt-override risks — with delta tracking, baseline suppression, issue filing, and per-finding
  remediation. Designed to integrate with Bankr Safety Scores. Use when adding or updating a skill,
  on a periodic catalog audit, or after an upstream skill source is reported compromised.
  Triggers: "scan this skill", "audit my skills", "security scan the catalog", "check workflow injection",
  "verify this skill is safe to install".
---

# aeon-skill-security-scan

Catalog-wide security scanner aimed at the specific risks of agent skill files: shell injection, secret exfiltration via outbound HTTP, GitHub Actions script injection through user-controlled template expressions, path traversal, prompt-override payloads, destructive commands, and 2026-era obfuscation tricks (zero-width Unicode, bidi override, base64-decode pipes, SSRF webhook hosts).

Silence is correct on no-op weeks. The notify is for inflection points only.

## Scope

| Target | Why |
|---|---|
| `skills/*/SKILL.md` | Primary — skill instructions tell Claude what to do. |
| `skills/*/*.sh` + `skills/*/*.py` | Companion scripts the skill invokes. |
| `.github/workflows/*.yml` | CI files — `run:` blocks that interpolate `${{ ... }}`. |
| `scripts/*.sh` | Repo-level scripts. |

## Inputs

| Param | Description |
|---|---|
| `var` | Optional. SKILL.md path, skill name, or directory. Empty → full corpus. |

## Threat patterns

| Category | What it looks like |
|---|---|
| Shell injection | Unquoted variable expansion, `eval`, backticks, `$(...)` with user data. |
| Secret exfiltration | Env vars or file contents piped to outbound HTTP. |
| Actions script injection | `${{ github.event.* }}` interpolated directly inside a `run:` block. |
| Path traversal | `../..` chains, absolute paths reaching outside the repo root. |
| Prompt override | "Ignore previous instructions", persona swaps, instructions inside fetched content. |
| Destructive commands | Recursive deletes rooted at `/` or `~`, device writes, force-push to main. |
| Obfuscation | U+200B / U+FEFF / U+202E (Trojan Source), base64-decode-into-shell pipes, webhook SSRF hosts. |

## How findings are processed

1. **Run the pattern scanner** (`scan.sh --json`) over the resolved scope. Capture structured output keyed by file + line + matched pattern.
2. **Trusted-source filter** — load `security/trusted-sources.txt`. If the scanned skill's `origin:` or repo remote matches an entry, downgrade to format-only validation (frontmatter has `name`, `description`, `tags`, `var`). Downgrade is opt-in only.
3. **Code-fence downgrade** — matches inside fenced code blocks (markdown ```` ``` ```` or YAML `run: |` example blocks documented as examples) drop one severity tier. Real workflow `run:` steps are never downgraded; they execute.
4. **Baseline suppression** — drop any finding whose (file, pattern, line) tuple is in `security/scan-baseline.yml`.
5. **Delta computation** — fingerprint each surviving finding by `sha256(file + line_content + pattern)` and compare to `state/security-scan.json`:
   - **NEW** — present now, absent last run → file an issue if HIGH.
   - **RESOLVED** — present last run, absent now → close the matching open issue.
   - **PERSISTENT** — present in both → counted but not re-notified.

## Per-finding remediation

For each HIGH finding, attach a one-line remediation hint:

| Pattern | Remediation |
|---|---|
| `eval` / backticks / `$(...)` with a variable | Quote the variable; replace `eval` with a function. |
| `curl`/`wget` with an env var in URL or body | Move the secret into a prefetch script — never interpolate secrets into shell strings. |
| `${{ github.event.* }}` inside `run:` | Rebind to an `env:` key first, then read `$_SAFE_NAME` in shell. |
| Path traversal sequence | Validate against an allow-list; reject absolute paths. |
| Prompt-override phrasing | If documentation, add a baseline suppression. If payload, delete it. |
| Recursive delete rooted at `/` or `~` | Scope to `$REPO_ROOT`. |
| Force-push to main | Remove or gate behind explicit human dispatch. |
| Obfuscation | Delete unless there's a documented, reviewed reason. |

## Baseline file

`security/scan-baseline.yml`:

```yaml
suppressions:
  - file: skills/some-skill/SKILL.md
    pattern: <regex from scan.sh>
    lines: "15-25"
    reason: "documentation in threat model section"
    reviewed_by: "operator"
    reviewed_at: "2026-04-20"
```

Bootstrapped on first run with seeds for known false positives (this skill's own documentation, security-digest example curls).

## Output

`articles/security-scan-${date}.md` — written only if there are NEW, RESOLVED, or any current HIGH findings:

- Verdict line: `CLEAN` / `ATTENTION` / `DEGRADED`.
- Needs-attention section per NEW HIGH with one-line remediation.
- Resolved-since-last-scan section.
- Per-file results table.
- Appendix with full structured dump.

## Exit codes

| Code | Meaning |
|---|---|
| `SECURITY_SCAN_OK` | No findings after suppression, no delta. |
| `SECURITY_SCAN_NEW` | At least one NEW HIGH. |
| `SECURITY_SCAN_RESOLVED` | No new HIGH, at least one resolved. |
| `SECURITY_SCAN_NOCHANGE` | Findings exist but identical to last run. |
| `SECURITY_SCAN_BOOTSTRAPPED` | Baseline created on first run. |

## Guardrails

- Never auto-deletes a baseline suppression. Suppression is a human decision.
- Never edits the pattern library from inside the skill — that's a separately reviewed PR.
- Never notifies on a pure no-op week. Silence is correct.
- Trusted-source downgrades are explicit-list-only, never inferred from git remote alone.

## Pairs with

- `aeon-workflow-security-audit` for the CI-specific deep audit.
- `aeon-vuln-scanner` for application-code vulnerability research.
