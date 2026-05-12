---
name: aeon-skill-security-scan
description: |
  Audit installed Bankr skills before you run them — scan SKILL.md and companion scripts for
  shell injection, secret exfiltration, path traversal, prompt-override payloads, destructive
  commands, and 2026-era obfuscation (zero-width Unicode, bidi override, base64-decode pipes,
  webhook SSRF hosts). Designed to integrate with Bankr Safety Scores. Silent on no-op runs;
  surfaces only NEW or RESOLVED findings vs prior scans.
  Triggers: "audit this skill", "is this skill safe to install", "security scan my skills",
  "check skill X for injection".
---

# aeon-skill-security-scan

Skills tell agents what to do. A malicious or sloppy skill can shell-inject, exfiltrate secrets, override instructions, or run destructive commands. This skill scans every installed SKILL.md and companion script and surfaces the risks before they execute.

## Scope

- `<skills-dir>/*/SKILL.md` — primary.
- `<skills-dir>/*/scripts/*.sh` and `*.py` — companion scripts.
- `<skills-dir>/*/references/*` — documents loaded at runtime.

Default `<skills-dir>` is the current working directory.

## Threat patterns

| Category | What it looks like |
|---|---|
| Shell injection | Unquoted variable expansion, `eval`, backticks, `$(...)` with user data. |
| Secret exfiltration | Env vars or file contents piped to outbound HTTP. |
| Path traversal | `../..` chains, absolute paths reaching outside the skill dir. |
| Prompt override | "Ignore previous instructions", persona swaps, instructions inside fetched content. |
| Destructive commands | Recursive deletes rooted at `/` or `~`, device writes. |
| Obfuscation | U+200B / U+FEFF / U+202E (Trojan Source), base64-decode-into-shell, SSRF hosts (ngrok, interact.sh, webhook.site, pipedream). |

## Processing

1. Pattern scanner produces matches `{file, line, pattern, severity}`.
2. Code-fence downgrade — matches inside fenced code blocks drop one tier. Real `run:` blocks are never downgraded.
3. Baseline suppression — drop (file, pattern, line) tuples in `scan-baseline.yml`.
4. Trusted-publisher filter — entries in `trusted-publishers.txt` get format-only validation. Opt-in only.
5. Delta vs `scan-state.json` — fingerprint by `sha256(file + line_content + pattern)`. Classify NEW / RESOLVED / PERSISTENT.

## Per-finding remediation

| Pattern | Fix |
|---|---|
| `eval` / backticks / `$(...)` with variable | Quote the variable; replace `eval` with a function. |
| `curl` with secret in URL | Move secret into prefetch script; never interpolate into shell. |
| Path traversal | Allow-list validation; reject absolute paths. |
| Prompt override phrasing | Documentation → baseline suppression; payload → delete the skill. |
| Recursive delete rooted at `/` or `~` | Scope to the skill's own working directory. |
| Obfuscation | Delete unless documented and reviewed. |

## Output

Verdict `CLEAN` / `ATTENTION` / `DEGRADED`. Needs-attention section per NEW HIGH with one-line remediation. Resolved-since-last-scan section. Per-skill PASS / WARN / FAIL.

Written only when NEW, RESOLVED, or any current HIGH findings.

## Rules

- Never auto-deletes a baseline suppression.
- Never edits the pattern library from inside the skill.
- Never notifies on a pure no-op week.
- Read-only scanning.
