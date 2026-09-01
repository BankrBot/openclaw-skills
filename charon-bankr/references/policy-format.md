# Policy Format

Policy is ordered rules plus a default verdict.

```json
{
  "version": 1,
  "default": "PASS",
  "allowlists": {
    "domains": ["api.bankr.bot", "github.com"],
    "chains": ["base", "ethereum", "solana"],
    "recipients": []
  },
  "blocklists": {
    "domains": ["webhook.site", "pipedream.net", "interact.sh"],
    "commands": ["rm", "chmod", "chown", "kill", "pkill"]
  },
  "thresholds": {
    "pause_amount_usd": 100,
    "deny_amount_usd": 1000
  },
  "rules": [
    {
      "id": "deny-source-delete",
      "action": ["code.delete", "shell.run"],
      "verdict": "DENY",
      "when": {
        "operation_in": ["delete"],
        "path_glob": ["src/**", "package.json", ".env", ".git/**"]
      }
    }
  ]
}
```

Rules run in order. First match wins.

## Verdicts

`PASS`: continue.

`PAUSE`: ask the user before execution.

`DENY`: stop.

## Match operators

| Operator | Meaning |
|---|---|
| `category_in` | `category` is in list. |
| `operation_in` | `operation` is in list. |
| `type_in` | `type` is in list. |
| `risk_in` | `risk` is in list. |
| `command_in` | `command` is in list. |
| `command_not_in` | `command` is not in list. |
| `path_glob` | `path` or `paths` matches one or more globs. |
| `domain_in` | `domain` is in list. |
| `domain_not_in` | `domain` is not in list. |
| `chain_in` | `chain` is in list. |
| `chain_not_in` | `chain` is not in list. |
| `recipient_in` | `recipient` is in list. |
| `recipient_not_in` | `recipient` is not in list. |
| `amount_usd_gt` | numeric greater-than check. |
| `amount_usd_gte` | numeric greater-than-or-equal check. |
| `field_exists` | action field exists. |
| `field_missing` | action field is missing. |
| `contains_secret` | action has `contains_secret: true`. |

Policy values can reference top-level policy data:

```json
{
  "domain_not_in": "$allowlists.domains",
  "command_in": "$blocklists.commands",
  "amount_usd_gt": "$thresholds.deny_amount_usd"
}
```
