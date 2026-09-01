# Morv + Bankr Safety

Morv and Bankr each enforce spending limits. A payment must satisfy **both** when using Bankr wallet.

## Bankr Wallet Limits (configure at bankr.bot → Security)

- Pause all transactions
- Daily spending limit ($/24h)
- Per-transaction limit
- Permitted recipients allowlist
- Disable arbitrary contract calls

See the **bankr** skill `references/safety.md` for Bankr-specific controls.

## Morv AgentGuard (per-agent, programmatic)

Configured via `policy` on agent create or SDK:

| Field | Purpose |
|-------|---------|
| `dailyLimitUsd` | Max spend per UTC day |
| `weeklyLimitUsd` / `monthlyLimitUsd` | Longer windows |
| `perTxLimitUsd` | Max single payment |
| `categoryLimits` | Cap by `api`, `mcp`, `trading`, etc. |
| `whitelist` / `blacklist` | Address restrictions |
| `maxTxPerMinute` / `maxTxPerHour` | Rate limits |
| `anomalyMultiplier` | Spike detection vs rolling average |
| `autoPause` | Pause agent on policy violation |
| `alertWebhook` | Notify on threshold / pause |

CLI: `morv guard status`, `morv guard pause`, `morv guard history`

## Recommended Practices

1. **Dedicated agent wallet** — separate Bankr account from personal funds
2. **Low limits first** — `--daily 50 --per-tx 10` until tested
3. **Read-only Bankr key** — for monitoring agents that never pay
4. **Never commit secrets** — `.env`, `.morv/`, `BANKR_API_KEY`, `MORV_API_KEY`
5. **Layer both guardrails** — Bankr wallet limits + Morv AgentGuard per agent
6. **Audit ledger** — `morv guard history <id>` before raising limits

## Incident Response

1. `morv guard pause <agentId>` — stop Morv agent immediately
2. Pause Bankr wallet at bankr.bot → Security
3. Revoke compromised API keys at bankr.bot/api
4. Review `morv guard history` and Bankr transaction log
5. Rotate keys and lower limits before resuming
