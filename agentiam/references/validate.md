# validate — Final structural validation

Structural validator for the complete envelope you are about to emit.
Catches malformed JSON, missing required fields, and envelope-level
inconsistencies before anything ships downstream.

## Price

$0.01 per call.

## Endpoint

```
POST https://x402.bankr.bot/0x24908846a4397d3549d07661e0fc02220ab14dad/validate
```

## Request

```json
{
  "envelope": {
    "agent_id": "did:key:z6Mk...",
    "action": { "...": "..." },
    "proof": { "...": "..." }
  }
}
```

## Response

```json
{
  "result": {
    "pass": true,
    "errors": []
  },
  "proof": { "signer": "0x069c...", "signature": "0x...", "timestamp": "..." },
  "payment": { "tx_hash": "0x...", "amount_usdc": 0.01 }
}
```

`errors` is an array of structured validation errors in the shape
`{ "path": "action.amount", "code": "REQUIRED_FIELD_MISSING" }`.

## When to use

- As the last step before sending an envelope to an on-chain contract or
  another agent.
- When your envelope format is evolving and you want a server-side check
  that your producer matches the accepted schema.

## When not to use

validate is structural, not semantic. It does not tell you whether an
action is a good idea — that is riskoracle's job.
