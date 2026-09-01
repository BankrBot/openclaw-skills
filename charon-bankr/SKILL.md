---
name: charon-bankr
description: >
  Charon policy checks for Bankr actions. Use before Bankr runs coding tasks,
  shell commands, file edits, git operations, HTTP/API calls, browser actions,
  automations, wallet actions, token launches, signing, or any tool call with
  external side effects. Normalizes the requested action, evaluates editable
  PASS / PAUSE / DENY policy, and records a receipt. This is a skill-level
  policy layer, not native Bankr runtime enforcement.
metadata:
  clawdbot:
    emoji: "🛡️"
    homepage: "https://github.com/CharonAI-code/charon"
    requires:
      bins: ["node"]
---

# Charon for Bankr

Charon gives a Bankr agent a policy checkpoint before it acts.

Bankr can do more than wallet operations: coding, repo work, API calls, browser tasks, automations,
research, signing, token launches, and trading. Charon treats all of those as one thing: an action with
resources and side effects.

This skill is for action review inside Bankr. It does not claim hard runtime enforcement. Native
enforcement needs a Bankr pre-execution hook or an external Charon runtime.

## When to use

Use Charon before:

- editing, deleting, generating, or publishing code
- running shell commands or package scripts
- changing git state, pushing, opening PRs, or modifying remotes
- calling unknown APIs or webhooks
- opening browser sessions against unknown domains
- creating recurring automations
- moving funds, swapping, signing, launching tokens, or calling contracts
- handling secrets, API keys, private data, or user credentials

Do not use Charon for read-only explanations, brainstorming, plain summaries, or harmless formatting.

## Workflow

1. Convert the user request into a normalized action. Use `references/action-model.md`.
2. Pick or edit a policy. Start with `templates/charon.policy.json`.
3. Run the policy check:

```bash
node scripts/charon_policy_check.js action.json templates/charon.policy.json
```

4. Follow the verdict:

| Verdict | Meaning |
|---|---|
| `PASS` | Continue. |
| `PAUSE` | Ask the user for explicit confirmation. |
| `DENY` | Stop. Do not execute the action. |

5. Write a receipt:

```bash
node scripts/charon_receipt.js action.json verdict.json
```

## Action examples

Code delete:

```json
{
  "type": "code.delete",
  "category": "code",
  "operation": "delete",
  "path": "src/server.ts",
  "intent": "remove old server"
}
```

Git push:

```json
{
  "type": "git.push",
  "category": "git",
  "operation": "push",
  "remote": "origin",
  "branch": "main"
}
```

API call:

```json
{
  "type": "http.request",
  "category": "network",
  "operation": "post",
  "domain": "api.example.com",
  "url": "https://api.example.com/v1/job"
}
```

Wallet transfer:

```json
{
  "type": "wallet.transfer",
  "category": "wallet",
  "operation": "transfer",
  "chain": "base",
  "asset": "ETH",
  "amount_usd": 250,
  "recipient": "0x2222222222222222222222222222222222222222"
}
```

## Install

```text
install the charon-bankr skill from https://github.com/BankrBot/skills/tree/main/charon-bankr
```

## Files

- `references/action-model.md` — normalized action schema and examples.
- `references/policy-format.md` — rule format and match operators.
- `references/receipt-format.md` — receipt fields.
- `references/operating-model.md` — how an agent should use Charon inside Bankr.
- `templates/charon.policy.json` — editable default policy.
- `scripts/charon_policy_check.js` — deterministic policy evaluator.
- `scripts/charon_receipt.js` — receipt generator.
