# Response Schema

Every AgentIAM response has the same three top-level fields: `result`,
`proof`, and `payment`. This file documents the shape that is stable
across all services.

## Top level

```json
{
  "result":  { },
  "proof":   { },
  "payment": { }
}
```

If any of these three is missing, treat the response as invalid and do
not act on it.

## result

Service-specific. See the per-service files:

- `references/flowcore.md`
- `references/noleak.md`
- `references/memguard.md`
- `references/riskoracle.md`
- `references/secureexec.md`
- `references/validate.md`

Common `result` conventions:

- `result.decision` — one of `"allow"`, `"deny"`, `"abstain"` (flowcore only).
- `result.pass` — boolean (noleak, memguard, secureexec, validate).
- `result.risk_score` — integer 0–100 (flowcore, riskoracle).
- `result.reasons` / `result.factors` / `result.errors` — structured
  explanations when a check fails.

## proof

```json
{
  "signer":    "0x069c6012e053dfbf50390b19fae275ad96d22ed7",
  "signature": "0x...",
  "timestamp": "2026-04-17T19:50:56Z"
}
```

- `signer` — lowercase hex address of the wallet that signed the response.
- `signature` — EIP-191 `personal_sign` signature over `canonicalize(result)`.
- `timestamp` — ISO-8601 UTC.

**Always verify `signer` is the canonical wallet before trusting `result`.**
The canonical signer is documented in `references/wallet-disclosure.md`.

## payment

```json
{
  "tx_hash":     "0x...",
  "amount_usdc": 0.02,
  "chain":       "base-mainnet",
  "payer":       "0x...",
  "facilitator": "0x8AEE..."
}
```

Keep `payment.tx_hash` in your audit log — it is the on-chain proof
you paid for this specific decision.

## Stable error codes

When a service denies, the structured reason codes are stable. Known codes:

| Code | Meaning |
| ---- | ------- |
| `LEAK_API_KEY`         | noleak detected an API-key pattern. |
| `LEAK_PRIVATE_KEY`     | noleak detected a hex private key. |
| `LEAK_PII`             | noleak detected PII. |
| `MEMORY_HASH_MISMATCH` | memguard saw a different last-known hash. |
| `REPLAY_DETECTED`      | memguard saw this exact action already executed. |
| `LARGE_AMOUNT`         | riskoracle factor — amount exceeds threshold. |
| `NEW_COUNTERPARTY`     | riskoracle factor — counterparty not seen before. |
| `TOOL_NOT_DECLARED`    | secureexec — tool not in the declared set. |
| `ARG_TYPE_MISMATCH`    | secureexec — args don't match the tool schema. |
| `REQUIRED_FIELD_MISSING` | validate — required field absent. |
| `SCHEMA_VIOLATION`     | validate — envelope didn't match schema. |

Log the code, not the full reason string — the string wording may change
across versions.
