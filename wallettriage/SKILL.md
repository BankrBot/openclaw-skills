---
name: wallettriage
description: |
  Real-time wallet risk check for AI agents BEFORE they act on an address.
  WalletTriage cross-references a wallet's active ERC20 approvals with a live
  exploit threat feed (contracts under attack right now) and returns a
  risk_score (0-100), risk_level and actionable findings — including which
  approvals to revoke first. Use before sending funds to an address, before
  interacting with a counterparty wallet, when auditing your own agent
  wallet, or on any "is this address safe / risky right now?" question.
  Triggers: "check this address", "is 0x... safe", "wallet risk", "am I
  exposed to the exploit", "audit my approvals", "should I revoke".
  Paid per query via x402 — $0.01 USDC on Base. Stateless: no signup,
  no API key, nothing stored.
---

# WalletTriage

Real-time wallet risk engine. One paid GET answers: **"how risky is this
address right now?"** — dangerous ERC20 approvals cross-referenced with a
live exploit threat feed, ranked worst-first with recommended actions.

**Base URL:** `https://api.wallettriage.com`
**Docs (OpenAPI):** `https://api.wallettriage.com/openapi.yaml` · Site: `https://wallettriage.com`
**Payment:** x402 — USDC on Base mainnet (`eip155:8453`), pay-per-call, no account needed.

## Endpoints

| Endpoint | Price | What it returns |
|---|---|---|
| `GET /scan?address=0x...&chain=eth` | $0.01 | Full risk assessment: score, level, findings, summary |
| `GET /health` | free | Service status, current price, threat-feed freshness |
| `GET /openapi.yaml` | free | Machine-readable API spec |

`chain` is optional (default `eth`). Supported: `eth`, `base`, `polygon`,
`arbitrum`, `optimism`, `bsc`, `avalanche`.

## How to Call (x402)

No API key, no signup. A wallet with USDC on Base is all you need — the
x402 client intercepts the 402, pays, and retries automatically.

**TypeScript:**
```typescript
import { withPaymentInterceptor } from "x402-axios";
import axios from "axios";

const client = withPaymentInterceptor(axios.create(), walletClient);

const { data } = await client.get(
  "https://api.wallettriage.com/scan?address=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045&chain=eth"
);
```

**Python:**
```python
from x402.client import x402_client

client = x402_client(wallet=YOUR_WALLET)
risk = client.get(
    "https://api.wallettriage.com/scan",
    params={"address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", "chain": "eth"},
).json()
```

**MCP (for MCP-capable agents):** the same query is exposed as an MCP tool —
`npx wallettriage-mcp` (npm), or via the official MCP Registry
(`io.github.wallettriage/wallettriage-mcp`).

## Response

```json
{
  "address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  "chain": "eth",
  "risk_score": 12,
  "risk_level": "low",
  "checked_at": "2026-07-11T01:37:01.464Z",
  "findings": [],
  "summary": {
    "total_approvals": 100,
    "spam_suppressed": 5,
    "low_noise_approvals": 95,
    "low_value_at_risk_usd": 5549.92
  },
  "stateless": true
}
```

**Key fields:**

- `risk_score` — 0-100, higher is riskier.
- `risk_level` — `low` / `medium` / `high` / `critical`. Treat `high`+ as
  "do not proceed without human review"; `critical` means an active
  approval touches a contract currently flagged by the live threat feed.
- `findings[]` — actionable items (medium+), worst-first. Each carries
  `type` (e.g. `exploit_exposure`), `severity`, `detail`, the `token` and
  `spender` involved, `usd_at_risk`, and a `recommended_action`
  (e.g. `revoke_approval`).
- `summary` — approval counts with spam/noise suppressed so agents don't
  over-react to dust.
- `stateless: true` — nothing about the query is persisted server-side.

## Agent Decision Pattern

```
risk = GET /scan?address=<counterparty>
if risk.risk_level in ("high", "critical"):
    abort or escalate to human; surface risk.findings[0].detail
elif risk.risk_level == "medium":
    proceed with reduced limits; consider findings' recommended_action
else:
    proceed
```

## Why this complements Bankr Agent Safety

Bankr's built-in safety (honeypots, allowances) protects the **transaction
you're about to sign**. WalletTriage answers a different question: whether
the **address itself** is exposed to an exploit that is live right now —
its standing approvals cross-checked against a continuously updated threat
feed. Use both: Bankr guards the action, WalletTriage triages the
counterparty (or your own wallet) before the action is even composed.

## Requirements

- USDC on Base mainnet (~$0.01 per query)
- TypeScript: `npm install x402-axios` · Python: `pip install x402`
- No API key, no signup, no data stored
