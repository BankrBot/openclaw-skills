# API Reference

All AgentIAM services share a common HTTP interface and response shape.

## Base URL

```
https://x402.bankr.bot/0x24908846a4397d3549d07661e0fc02220ab14dad
```

## Services

| Path          | Purpose                        | Price     |
| ------------- | ------------------------------ | --------- |
| `/flowcore`   | Full pre-execution pipeline    | $0.02     |
| `/noleak`     | Leakage / prompt-injection     | $0.01     |
| `/memguard`   | Memory-tampering / replay      | $0.01     |
| `/riskoracle` | Action risk scoring            | $0.01     |
| `/secureexec` | Tool-call validation           | $0.01     |
| `/validate`   | Envelope structural validation | $0.01     |

## Request

All services accept `POST` with `Content-Type: application/json`.

Request bodies are documented per service in the other files in this
directory.

## Response

Every successful response has this shape:

```json
{
  "result":  { ...service-specific... },
  "proof":   { "signer": "0x...", "signature": "0x...", "timestamp": "..." },
  "payment": { "tx_hash": "0x...", "amount_usdc": 0.02 }
}
```

`result` is the service-specific answer.
`proof` is a signed attestation — see `references/signature-verification.md`.
`payment` is the on-chain settlement receipt.

## x402 handshake

If you call a service without attaching payment, the server replies
`402 Payment Required` with a quote in the response headers. The BANKR
CLI handles this handshake automatically; raw HTTP clients need to
replay the request with the payment header attached.

## Error responses

| Status | Meaning |
| ------ | ------- |
| 200    | Success. Verify the signer before trusting `result`. |
| 402    | Payment required. Expected on initial handshake. |
| 400    | Malformed request body. Check the per-service request schema. |
| 503    | Upstream check temporarily unavailable. Treat as deny. |

## Rate limits

No published rate limit at launch. Aggressive traffic is subject to
throttling at the facilitator layer.
