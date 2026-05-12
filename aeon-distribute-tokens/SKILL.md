---
name: aeon-distribute-tokens
description: |
  Send tokens to a list of contributors via the Bankr Wallet API with per-recipient idempotency,
  two-phase resolve→execute, dry-run preview, and recovery from partial runs. Use when an agent
  needs to pay multiple recipients (weekly contributor rewards, tip pools, leaderboard payouts) and
  must guarantee no double-sends across re-runs.
  Triggers: "distribute tokens", "pay contributors", "weekly payout", "send USDC to this list",
  "tip these handles", any batch payment driven by a config file.
---

# aeon-distribute-tokens

Production-grade batch payouts for agents that move real money. Built around `POST /wallet/transfer` with the guardrails any payment loop needs: no double-sends, no black-hole transfers, no surprise overdrafts.

## Why this exists

Naive batch transfers fail in three ways: re-running after a partial crash sends a second payment; retrying after a 5xx duplicates; sending to unresolved handles silently drops the line. This skill persists per-recipient state keyed on `(list, recipient, utc_date)` so any re-run within the same UTC day is a no-op for completed rows.

## The two-phase flow

1. **RESOLVE** — load config, check `BANKR_API_KEY` scope (read-write required), preflight portfolio balance, resolve every `@handle` to an EVM address via Bankr Agent, build the plan. Aborts before any transfer if balance < `total × 1.05`.
2. **EXECUTE** — for each `READY` row, call `POST /wallet/transfer`. Persist state to disk **after every line**, not at the end. Survives mid-run crashes.

Dry-run runs RESOLVE only and prints the plan with no transfers.

## Config

A YAML file (e.g. `distributions.yml`):

```yaml
defaults:
  token: USDC
  amount: "5"
  chain: base

lists:
  contributors:
    description: "Weekly contributor rewards"
    token: USDC
    amount: "10"
    recipients:
      - handle: "@alice"
        amount: "15"
      - handle: "@bob"
      - address: "0x742d...5678"
        label: "Charlie"
        amount: "20"
```

Token addresses on Base:
- USDC: `0x833589fcd6edb6e08f4c7c32d4f71b54bda02913`
- Native ETH: `tokenAddress: 0x0000...0000`, `isNativeToken: true`

## API surface

| Endpoint | Purpose |
|---|---|
| `GET /wallet/me` | Preflight: identity + scope check. 403 → key is read-only, abort. |
| `GET /wallet/portfolio?chain=base` | Balance check; sum vs total payout × 1.05. |
| `POST /agent/prompt` + `GET /agent/job/{id}` | `@handle` → address resolution (Agent API). Never used for transfers. |
| `POST /wallet/transfer` | The only sanctioned transfer endpoint. |

```bash
# Preflight
curl -fsS "https://api.bankr.bot/wallet/me" -H "X-API-Key: ${BANKR_API_KEY}"

# Transfer (the only call that moves funds)
curl -fsS -X POST "https://api.bankr.bot/wallet/transfer" \
  -H "X-API-Key: ${BANKR_API_KEY}" -H "Content-Type: application/json" \
  -d '{"recipientAddress":"0x...","tokenAddress":"0x8335...","amount":"15","isNativeToken":false}'
```

## Idempotency state

```json
{
  "contributors|@alice|2026-05-12": {
    "list": "contributors",
    "recipient": "@alice",
    "address": "0x...",
    "amount": "15",
    "token": "USDC",
    "status": "completed",
    "txHash": "0x...",
    "timestamp": "2026-05-12T12:34:56Z"
  }
}
```

Persist after every successful transfer. Read this file before sending; skip any matching key.

## Outcome handling

| Response | Action |
|---|---|
| `200` + `success: true` | Mark completed, store txHash, persist immediately. |
| `200` + `success: false` | Mark failed with error reason. |
| `403` | Key lost write scope mid-run — abort remaining rows. |
| `429` | Sleep 60s, retry once; if still 429 abort remaining (rolling-window quota). |
| `5xx` / network | Retry once after 10s; mark failed if still bad. |

## Output verdicts

One line first: `COMPLETE` / `PARTIAL` / `FAILED` / `DRY_RUN` / `NOTHING_TO_SEND`. Then the per-row breakdown with basescan tx links for successes and reason codes for failures.

## Guardrails

- **Idempotency is non-negotiable.** Read state before sending; persist after every line. Never batch state writes.
- **Preflight balance** with 5% headroom — never start a partial run.
- **Wallet API only for transfers.** Agent API resolves handles; it does not move tokens.
- **Rate limit** (100/day standard) is a hard ceiling — split lists of >50.
- **Unresolved handles do not abort the plan** — they're skipped with `RESOLVE_FAILED: NO_LINKED_WALLET` and the rest of the plan runs.

## Required scope

`BANKR_API_KEY` with **Wallet API** enabled and **read-write** access. Read-only keys 403 at preflight.
