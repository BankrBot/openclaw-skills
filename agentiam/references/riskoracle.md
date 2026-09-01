# riskoracle — Risk scoring for proposed actions

Scores a proposed action on a 0–100 scale where 0 is safest and 100 is
catastrophic. Returns both the score and a structured list of risk
factors.

## Price

$0.01 per call.

## Endpoint

```
POST https://x402.bankr.bot/0x24908846a4397d3549d07661e0fc02220ab14dad/riskoracle
```

## Request

```json
{
  "action": {
    "type": "transfer",
    "token": "USDC",
    "amount": 5000,
    "to": "0xBeef...",
    "chain": "base-mainnet"
  }
}
```

## Response

```json
{
  "result": {
    "risk_score": 37,
    "factors": [
      { "code": "LARGE_AMOUNT", "weight": 20 },
      { "code": "NEW_COUNTERPARTY", "weight": 17 }
    ]
  },
  "proof": { "signer": "0x069c...", "signature": "0x...", "timestamp": "..." },
  "payment": { "tx_hash": "0x...", "amount_usdc": 0.01 }
}
```

## Decision guidance

riskoracle does not produce an `allow`/`deny` — only a score. Integrators
pick their own threshold. A common starting point:

| Score   | Suggested policy |
| ------- | ---------------- |
| 0–20    | auto-allow |
| 21–60   | allow with extra logging |
| 61–80   | require a second check (flowcore or human) |
| 81–100  | deny |

If you want a thresholded allow/deny out of the box, use **flowcore**
instead — it applies AgentIAM's default threshold.

## Factor codes

The `factors[].code` values are stable identifiers documented in
`references/response-schema.md`. Log them so you can track which
risk classes show up most in production.
