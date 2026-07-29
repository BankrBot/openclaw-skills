# Error Handling

| Status | Meaning | Action |
|---|---|---|
| `402` | Payment required (first leg of every paid call). | Read `PAYMENT-REQUIRED`, sign, retry with `PAYMENT-SIGNATURE`. Not an error. |
| `200` | Success. | Read the body and the `PAYMENT-RESPONSE` settle receipt. |
| `400` | Bad params / body. | Fix the request. You were NOT charged (settlement only on status < 400) — do not retry blindly. |
| `402` after paying | Stale/duplicate payment, or a re-challenge. | Fetch a FRESH challenge and rebuild the payment payload (one nonce settles once). |
| `429` | Rate limited (mainly the FREE preview tiers, per-IP daily quota). | Back off; switch to the paid endpoint, or retry later. Paid calls are not quota-limited. |
| `5xx` | Transient upstream/server error. | Bounded retry with exponential backoff (e.g. 3 tries). You were NOT charged. |

## Rules
- Settlement is server-response-based: it occurs only when the handler returns status < 400, so a `4xx` never costs USDC.
- Do not mutate path/query/body between the challenge and the paid retry — it invalidates the signature.
- Treat the runtime `402` challenge (price/network/payTo) as authoritative over any cached pricing.
- Never log or echo the raw `PAYMENT-SIGNATURE` or the signer key.
