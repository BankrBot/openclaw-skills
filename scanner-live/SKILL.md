---
name: scanner-live
description: |
  Deterministic security scanner for Bankr skill source code.
  Detects hardcoded secrets, eval() RCE, OS injection, SQL injection,
  open redirects, internal IP leaks, debug mode, unsafe URLs,
  missing safety invariants, and more. 16 patterns across 5 severity levels.
  Free. No x402. No wallet.
  Triggers: "scan this skill", "is this code safe", "check for secrets",
  "audit my skill", "security check before deploy".
credentials: []
metadata:
  openclaw:
    requires:
      env: []
---

# scanner-live

**Deterministic security scanner for Bankr skills. Free. No x402.**

Scan your skill code before deployment. 16 patterns across CRITICAL, HIGH,
MEDIUM, and LOW severity levels.

## Quick Start

```bash
curl -X POST https://x402.bankr.bot/0x9cde325fe64295bb41e4f2eb3bcadc6b9767ec6c/scanner-live \\
  -H "Content-Type: application/json" \\
  -d '{"code": "const API_KEY=\"sk-...\""}'
```

## Patterns

| ID | Severity | What it detects |
|----|----------|-----------------|
| CRIT-001 | 🔴 CRITICAL | Hardcoded private key / secret / mnemonic |
| CRIT-002 | 🔴 CRITICAL | Hardcoded API key / token (20+ chars) |
| CRIT-003 | 🔴 CRITICAL | eval() / Function() — potential RCE |
| HIGH-001 | 🟠 HIGH | OS command injection |
| HIGH-002 | 🟠 HIGH | SQL injection |
| HIGH-003 | 🟠 HIGH | Open redirect |
| HIGH-004 | 🟠 HIGH | Internal IP address leak |
| HIGH-005 | 🟠 HIGH | setTimeout/setInterval with string — eval-like RCE |
| MED-001 | 🟡 MEDIUM | Debug mode in production |
| MED-002 | 🟡 MEDIUM | Non-HTTPS URL |
| MED-003 | 🟡 MEDIUM | Hardcoded endpoint URL (35+ chars) |
| MED-004 | 🟡 MEDIUM | Comment with TODO + sensitive keyword |
| SAF-001 | 🟡 MEDIUM | Handler missing not_a_verdict invariant |
| SAF-002 | 🟡 MEDIUM | Handler missing not_a_recommendation invariant |
| LOW-001 | ⚪ LOW | console.log in production code |
| LOW-002 | ⚪ LOW | Async handler missing try/catch |

## Install

```bash
# Once BankrBot/skills PR merges:
bankr install scanner-live

# Direct usage (no install needed):
curl -X POST <endpoint> -d '{"code": "..."}'
```

## Free. No x402. No wallet. Deterministic.

## Source

https://github.com/SlumPark/bankrguard/tree/main/skills/scanner-live

## Upgrade

Need execution-time agent safety monitoring?
→ agent-safety-enforcer ($0.03/req)

Need policy-level code vs description mismatch detection?
→ policy-reverse-engineering (free)
