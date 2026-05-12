---
name: aeon-distribute-tokens
description: |
  Batch token payouts via the Bankr Wallet API with per-recipient idempotency, two-phase
  resolve→execute, dry-run preview, and recovery from partial runs. Re-runs within the same UTC
  day are a no-op for completed rows. Use for weekly contributor rewards, tip pools, leaderboard
  payouts — any "pay N wallets X amount" flow where double-sending must be impossible.
  Triggers: "distribute tokens", "pay contributors", "weekly payout", "send USDC to this list",
  "tip these handles".
---

# aeon-distribute-tokens

Production-grade batch payouts. State is keyed on `(list, recipient, utc_date)` so any re-run within the same day skips already-completed rows.

## Phases

1. **RESOLVE** — load config, check `BANKR_API_KEY` scope (read-write required), preflight portfolio balance, resolve every `@handle` to an EVM address via Bankr Agent, build the plan. Aborts before any transfer if balance < `total × 1.05`.
2. **EXECUTE** — for each `READY` row, call `POST /wallet/transfer`. Persist state to disk **after every line**, not at the end.

Dry-run runs RESOLVE only and prints the plan with no transfers.

## Config

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
- Native ETH: `tokenAddress: 0x000...000`, `isNativeToken: true`

## API surface

| Endpoint | Purpose |
|---|---|
| `GET /wallet/me` | Preflight: identity + scope check. 403 → key is read-only, abort. |
| `GET /wallet/portfolio?chain=base` | Balance check vs total × 1.05. |
| `POST /agent/prompt` + `GET /agent/job/{id}` | `@handle` → address resolution. Never used for transfers. |
| `POST /wallet/transfer` | The only sanctioned transfer endpoint. |

```bash
curl -fsS -X POST "https://api.bankr.bot/wallet/transfer" \
  -H "X-API-Key: ${BANKR_API_KEY}" -H "Content-Type: application/json" \
  -d '{"recipientAddress":"0x...","tokenAddress":"0x8335...","amount":"15","isNativeToken":false}'
```

## State file

```json
{
  "contributors|@alice|2026-05-12": {
    "list": "contributors", "recipient": "@alice", "address": "0x...",
    "amount": "15", "token": "USDC",
    "status": "completed", "txHash": "0x...",
    "timestamp": "2026-05-12T12:34:56Z"
  }
}
```

Read before sending; persist after every line.

## Outcome handling

| Response | Action |
|---|---|
| `200` + `success: true` | Mark completed, store txHash, persist immediately. |
| `200` + `success: false` | Mark failed with error reason. |
| `403` | Key lost write scope — abort remaining rows. |
| `429` | Sleep 60s, retry once; if still 429 abort remaining. |
| `5xx` / network | Retry once after 10s; mark failed if still bad. |

## Output

Verdict line first: `COMPLETE` / `PARTIAL` / `FAILED` / `DRY_RUN` / `NOTHING_TO_SEND`. Then per-row breakdown with basescan tx links for successes and reason codes for failures.

## Rules

- Idempotency is non-negotiable. Read state before sending, persist after every line.
- Preflight balance with 5% headroom — never start a partial run.
- Wallet API only for transfers. Agent API resolves handles; it does not move tokens.
- Bankr rate limit (100/day standard) is a hard ceiling — split lists of > 50.
- Unresolvable handles are skipped with `RESOLVE_FAILED`, not loudly failed — the rest of the plan runs.

## Required scope

`BANKR_API_KEY` with **Wallet API** enabled and **read-write** access. Read-only keys 403 at preflight.
