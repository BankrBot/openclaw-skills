---
name: aeon-vuln-scanner
description: |
  Audit trending repos for real exploitable vulnerabilities and disclose responsibly — Private
  Vulnerability Reporting for code flaws, public PRs only for already-disclosed dependency CVEs.
  Uses Semgrep + TruffleHog + osv-scanner + Slither with reachability triage. Use when running
  autonomous security research across a watchlist, pre-launch auditing a contract or library, or
  hardening a dependency tree.
  Triggers: "vuln scan this repo", "audit owner/repo for vulnerabilities", "responsible-disclosure
  scan", "check for secret leaks", "scan dependencies for CVEs".
---

# aeon-vuln-scanner

Autonomous vulnerability research with a real disclosure pipeline. Picks a target from trending repos (or accepts one explicitly), runs purpose-built scanners with dataflow reachability, triages every candidate by reading the code, and routes each verified finding to the correct channel — **never a public PR for an unpatched code flaw**.

A scanner that dumps zero-days into public PRs isn't a helper. It's a publisher.

## Inputs

| Param | Description |
|---|---|
| `var` | Optional. `owner/repo` target. If empty, auto-selects from chained `github-trending` output or a fresh trending API call. |

## Target selection

- Language: JS/TS, Python, Go, Rust, or Solidity.
- ≥ 50 stars, not a fork, active in last 6 months.
- Handles untrusted input (auth, crypto, network, file I/O, templating).
- **Skip** intentionally vulnerable teaching repos (juice-shop, webgoat, vulnerable-*, *-ctf, hackme-*).
- **Skip** if no PVR enabled AND no `SECURITY.md` — no safe channel for code flaws.
- **Skip** if scanned in the last 30 days (dedup via a local `vuln-scanned.json` state file).

## Scanners

| Tool | Purpose |
|---|---|
| **Semgrep OSS** (`p/security-audit`, `p/owasp-top-ten`, `p/secrets`) | Static analysis with dataflow reachability. |
| **TruffleHog** (`--only-verified`) | Verified secret detection across filesystem AND full git history. |
| **osv-scanner** | Unified CVE database across npm/pip/go/cargo/etc. |
| **Slither** | Solidity static analysis (only if `.sol` present). |

Tool failures are recorded per-source. An all-scanners-failed run reports **error**, never **clean**.

```bash
# Semgrep
semgrep --config=p/security-audit --config=p/owasp-top-ten --config=p/secrets \
  --severity=ERROR --severity=WARNING --json --timeout=300 \
  --exclude=test --exclude=tests --exclude=examples --exclude=vendor --exclude=node_modules \
  -o /tmp/vuln-scan/semgrep.json .

# TruffleHog (filesystem + git history)
trufflehog filesystem . --only-verified --json > /tmp/vuln-scan/trufflehog.json
trufflehog git file://. --only-verified --json > /tmp/vuln-scan/trufflehog-git.json

# osv-scanner
osv-scanner --format=json --recursive . > /tmp/vuln-scan/osv.json

# Slither (if Solidity)
slither . --json /tmp/vuln-scan/slither.json --exclude-informational --exclude-low
```

## Triage

A scanner hit is a candidate, not a vulnerability. For each:

1. Open the file at the reported line, read surrounding 30–50 lines.
2. Write one sentence: *what attacker controls, what they achieve*. If you can't, discard.
3. Check the call path — reachable from external input in production code?
4. Assign severity: critical (RCE, auth bypass, secret exposure), high (SQLi, stored XSS, SSRF, path traversal), medium (reflected XSS, weak crypto, missing rate limit).

**Discard** if:
- Lives in tests, fixtures, examples, docs, or benchmarks.
- Behind a feature flag not enabled by default.
- Requires attacker privileges ≥ the attack yields.
- You'd be embarrassed to defend it to the maintainer.

## Disclosure routing

| Finding type | Channel | Why |
|---|---|---|
| Dependency CVE | **Public PR** bumping the dep | CVE is already public; the patch is net-positive. |
| Code vulnerability | **PVR** (private advisory) | Publishing creates a zero-day. |
| Verified leaked secret | **PVR** + rotate request | Public file/line points attackers at the bag. |
| Smart-contract bug | **PVR** | On-chain exploitation is often immediate and irreversible. |
| No PVR + no SECURITY.md | **Skip, log** | Do no harm. |

### Public PR (dep CVEs only)

```bash
git checkout -b security/bump-<pkg>-<cve>
# update lockfile / manifest
git commit -m "fix(deps): bump <pkg> to patch <CVE-YYYY-NNNN>"
git push -u origin HEAD
gh pr create --repo "$REPO" --title "fix(deps): bump <pkg> to patch <CVE-YYYY-NNNN>" --body "..."
```

### PVR (code flaws, secrets, contract bugs)

```bash
gh api -X POST "/repos/$REPO/security-advisories" \
  -f summary="<short title>" \
  -f severity="<critical|high|medium|low>" \
  -F cwe_ids='["CWE-89"]' \
  -f description="..."
```

If the advisories endpoint returns 404/403, PVR is disabled. **Do not fall back to a public issue or PR.** Check `SECURITY.md` for a private contact; if none, log "no safe channel — skipped".

### Proposed patch (paired with PVR)

If you have a minimal fix, push to your fork only on `private/fix-<slug>`. Do **not** open a PR upstream — link the SHA in the advisory body so the maintainer can cherry-pick.

## Output

`articles/vuln-scan-${date}.md`:

- Repo metadata, scanner source status (per-tool ok/fail).
- Candidate count + confirmed count.
- Findings list with severity + channel (PVR'd findings have file/line redacted; advisory ID linked).
- Dedup note.

## Dedup state

`vuln-scanned.json` (local state file) — `{"repo": "owner/name", "scanned_at": "...", "findings": N, "channel": "..."}`. 30-day window.

## Required scopes

`GH_TOKEN` with `repo` + `repository_advisories:write` for the PVR endpoint.

## Guidelines

- **Do no harm.** No safe channel → no publication.
- One report per repo per run; bundle related findings.
- Read the code. A scanner hit alone is not a vulnerability.
- Be deferential — you're offering help, not grading homework.
- Never post exploit chains publicly. PoCs go in the private advisory.
- **All-scanners-failed ≠ clean.** Report it as an error and publish nothing.
