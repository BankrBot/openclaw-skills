---
name: aeon-skill-security-scan
description: |
  Audit installed Bankr skills before you run them — scan their SKILL.md and any companion scripts
  for shell injection, secret exfiltration, path traversal, prompt-override payloads, destructive
  commands, and 2026-era obfuscation (zero-width Unicode, bidi override, base64-decode pipes,
  webhook SSRF hosts). Designed to integrate with Bankr's Safety Score concept. Use when adding a
  new skill from a third party, before installing a skill from an unfamiliar publisher, or as a
  periodic audit of your installed catalog.
  Triggers: "audit this skill", "is this skill safe to install", "security scan my skills",
  "check skill X for injection", "scan downloaded skills".
---

# aeon-skill-security-scan

Skills tell agents what to do. A malicious or sloppy skill file can shell-inject, exfiltrate secrets, traverse the filesystem, override prior instructions, or run destructive commands. This skill scans every SKILL.md and companion script you've installed and surfaces the risks before they execute.

Built around delta tracking — silent on no-op runs, surfaces only what's *changed* since the last scan.

## When to use

- Right after installing a new skill from a third-party publisher.
- Periodic audit (weekly) of the installed catalog.
- Pre-publish gate on a skill you're about to ship to others.
- Incident response — scan after an upstream skill source is reported compromised.

## What it scans

| Target | Why |
|---|---|
| `<skills-dir>/*/SKILL.md` | Skill instructions tell the agent what to do. |
| `<skills-dir>/*/scripts/*.sh` and `*.py` | Companion scripts the skill invokes. |
| `<skills-dir>/*/references/*` | Documents the skill loads at runtime. |

Default `<skills-dir>` is the current working directory. Configurable.

## Inputs

| Param | Description |
|---|---|
| `target` | Optional. A specific skill name, SKILL.md path, or directory. Empty → scan everything in `<skills-dir>`. |
| `mode` | `scan` (default) or `bootstrap` (creates a baseline file on first run). |

## Threat patterns

| Category | What it looks like |
|---|---|
| Shell injection | Unquoted variable expansion, `eval`, backticks, `$(...)` with user data. |
| Secret exfiltration | Env vars or file contents piped to outbound HTTP. |
| Path traversal | `../..` chains, absolute paths reaching outside the skill's directory. |
| Prompt override | "Ignore previous instructions", persona swaps, instructions hidden inside fetched content. |
| Destructive commands | Recursive deletes rooted at `/` or `~`, device writes. |
| Obfuscation | U+200B / U+FEFF / U+202E (Trojan Source), base64-decode-into-shell pipes, webhook SSRF hosts (ngrok, interact.sh, webhook.site, burpcollaborator, pipedream). |

## How findings are processed

1. **Pattern scanner** runs over the resolved scope, producing structured matches: `{file, line, pattern, severity}`.
2. **Code-fence downgrade** — matches inside fenced code blocks (markdown ```` ``` ```` or YAML `run: |` example blocks) drop one severity tier. Real executable contexts are never downgraded.
3. **Baseline suppression** — drop any finding whose (file, pattern, line) tuple is in a local `scan-baseline.yml` (operator-reviewed false positives).
4. **Trusted-publisher filter** — load a `trusted-publishers.txt` allow-list. If the skill's `origin:` matches, downgrade to format-only validation (frontmatter has `name`, `description`, `tags`). Opt-in only, never inferred.
5. **Delta computation** — fingerprint each surviving finding by `sha256(file + line_content + pattern)` and compare to a local `scan-state.json` from the last run:
   - **NEW** — present now, absent last run.
   - **RESOLVED** — present last run, absent now.
   - **PERSISTENT** — present in both. Counted but not re-notified.

## Per-finding remediation hints

| Pattern | Fix |
|---|---|
| `eval` / backticks / `$(...)` with a variable | Quote the variable; replace `eval` with a function. |
| `curl` / `wget` with an env var in URL or body | Move the secret into a pre-fetch script. Never interpolate secrets into shell strings. |
| Path traversal | Validate input against an allow-list. Reject absolute paths. |
| Prompt-override phrasing | If documentation, add a baseline suppression. If payload, delete the skill. |
| Recursive delete rooted at `/` or `~` | Scope to the skill's own working directory. |
| Obfuscation | Delete unless there's a documented, reviewed reason. |

## Output

A scan report with:

- Verdict line: `CLEAN` / `ATTENTION` / `DEGRADED`.
- "Needs attention" section per NEW HIGH finding with the one-line remediation.
- "Resolved since last scan" section.
- Per-skill summary table (PASS / WARN / FAIL).
- Appendix with the full structured dump.

Written only when there are NEW, RESOLVED, or any current HIGH findings.

## Sample output

```
*Skill Security Scan — 2026-05-12*

Verdict: ATTENTION
Scope: 27 skill files scanned
Counts: 2 HIGH (new) · 4 MEDIUM · 12 LOW · 1 RESOLVED since last scan

Needs attention
  skills/some-imported-skill/SKILL.md:42 — HIGH
    Pattern: curl piped with $API_KEY in URL
    Remediation: move the secret into a pre-fetch script; never interpolate into shell

  skills/another-skill/scripts/run.sh:7 — HIGH
    Pattern: eval over user-supplied input
    Remediation: replace eval with a parameterized function

Resolved since last scan
  skills/old-skill/SKILL.md:18 (recursive-delete-rooted-at-home) — gone

Per-skill (top 5 by severity)
  some-imported-skill     FAIL  (2 HIGH)
  another-skill           FAIL  (1 HIGH, 2 MEDIUM)
  utility-skill           WARN  (3 MEDIUM)
  ...

Skipped
  3 trusted-publisher skills (format-only validation: PASS)
```

## Bankr Safety Score integration

When this skill produces a `CLEAN` verdict for a target skill across N consecutive runs, the operator can use that as input to the Bankr Safety Score for the publisher. The skill emits a structured fingerprint set per scan that downstream tools can consume.

## Guardrails

- Never auto-deletes a baseline suppression — that's a human decision.
- Never edits the pattern library itself from inside the skill.
- Never notifies on a pure no-op week. Silence is correct.
- Trusted-publisher downgrades require explicit list membership; never inferred from origin field alone.
- All scanning is read-only. Never modifies the target skill files.

## Required keys

None — local file scanning only.

## Pairs with

- `aeon-skill-evals` (output-quality net; this is the input-safety net).
- `aeon-vuln-scanner` (for code-level vulns; this is for skill-level risks).
