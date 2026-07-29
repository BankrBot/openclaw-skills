---
name: policy-reverse-engineering
description: |
  Compare what a BankrBot skill claims to do vs what it actually does.
  Reads the skill's SKILL.md description, scans the code for actual
  capabilities, and reports mismatches. Detects skills that say
  "read-only" but can sign transactions.
  Triggers: "audit this skill's claims", "does this skill match its description",
  "check for false claims".
credentials: []
metadata:
  openclaw:
    requires:
      env: []
---

# Policy Reverse Engineering

**Compare what a skill says vs what it does. Free.**

## Commands

| Command | Response | Fee |
|---------|----------|-----|
| `audit <skill-name>` | claims vs capabilities mismatch report | Free |

## Install

```bash
bankr install policy-reverse-engineering
```

## Source

https://github.com/SlumPark/bankrguard/tree/main/skills/policy-reverse-engineering

## Upgrade

Need full code-level security scanning? → scanner-live ($0.03/req)
