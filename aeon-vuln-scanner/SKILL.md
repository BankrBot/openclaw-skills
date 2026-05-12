---
name: aeon-vuln-scanner
description: |
  Audit trending repos for real exploitable vulnerabilities and disclose responsibly — Private
  Vulnerability Reporting for code flaws and verified secrets, public PRs only for already-disclosed
  dependency CVEs. Semgrep + TruffleHog + osv-scanner + Slither with reachability triage. Skips
  targets that have no safe disclosure channel.
  Triggers: "vuln scan owner/repo", "audit this repo", "responsible-disclosure scan",
  "check for secret leaks", "scan dependencies for CVEs".
---

# aeon-vuln-scanner

A scanner that dumps zero-days into public PRs isn't a helper — it's a publisher. This skill triages every finding by reading the code and routes to the right disclosure channel.

## Inputs

| Param | Description |
|---|---|
| `var` | Optional `owner/repo`. If empty, auto-picks from chained github-trending output or fresh trending API. |

## Target selection

- Language: JS/TS, Python, Go, Rust, or Solidity.
- ≥ 50 stars, not a fork, active in last 6 months.
- Handles untrusted input (auth, crypto, network, file I/O, templating).
- Skip: intentionally vulnerable teaching repos (juice-shop, webgoat, *-ctf).
- Skip if no PVR enabled AND no `SECURITY.md` — no safe channel.
- Skip if scanned in last 30 days (dedup via `vuln-scanned.json`).

## Scanners

```bash
# Static analysis
semgrep --config=p/security-audit --config=p/owasp-top-ten --config=p/secrets \
  --severity=ERROR --severity=WARNING --json --timeout=300 \
  --exclude=test --exclude=examples --exclude=node_modules .

# Verified secrets (filesystem + git history)
trufflehog filesystem . --only-verified --json
trufflehog git file://. --only-verified --json

# Dependency CVEs across npm/pip/go/cargo/etc
osv-scanner --format=json --recursive .

# Solidity (if .sol files present)
slither . --json out.json --exclude-informational --exclude-low
```

All-scanners-failed reports **error**, never **clean**.

## Triage (per candidate)

1. Open the file at the reported line. Read 30-50 lines of context.
2. Write one sentence: *what attacker controls, what they achieve*. Can't? Discard.
3. Check the call path — reachable from external input in production code?
4. Drop if in tests, fixtures, examples, behind a feature flag, or requires attacker privs ≥ what's gained.

## Disclosure routing

| Finding | Channel |
|---|---|
| Dependency CVE | **Public PR** bumping the dep — CVE already public. |
| Code vulnerability | **PVR** — publishing creates a zero-day. |
| Verified leaked secret | **PVR** + rotation request. |
| Smart-contract bug | **PVR** — on-chain exploitation often immediate. |
| No PVR + no SECURITY.md | **Skip and log.** Do no harm. |

```bash
# PVR (private advisory)
gh api -X POST "/repos/$REPO/security-advisories" \
  -f summary="..." -f severity="..." -F cwe_ids='["CWE-89"]' -f description="..."
```

Proposed patches for code flaws go to your fork only (`private/fix-<slug>` branch). Never open a public PR for an unpatched code flaw — link the SHA in the advisory body so the maintainer can cherry-pick.

## Required scopes

`GH_TOKEN` with `repo` + `repository_advisories:write` (for PVR).

## Rules

- Do no harm. No safe channel → no publication.
- Read the code. A scanner hit alone isn't a vulnerability.
- One report per repo per run; bundle related findings.
- Skip intentionally vulnerable repos and CTFs.
- Be deferential — you're offering help, not grading homework.
