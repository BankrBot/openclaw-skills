# noleak — Leakage and prompt-injection check

Scans the action payload for content that should not be leaving the agent:
private keys, API credentials, PII, and prompt-injection patterns that
could redirect the agent downstream.

## Price

$0.01 per call.

## Endpoint

```
POST https://x402.bankr.bot/0x24908846a4397d3549d07661e0fc02220ab14dad/noleak
```

## Request

```json
{
  "payload": "{...the exact string you are about to send downstream...}"
}
```

Send the literal string. noleak does not inspect parsed JSON — it inspects
the bytes you are about to emit.

## Response

```json
{
  "result": {
    "pass": true,
    "findings": []
  },
  "proof": { "signer": "0x069c...", "signature": "0x...", "timestamp": "..." },
  "payment": { "tx_hash": "0x...", "amount_usdc": 0.01 }
}
```

On fail, `findings` is a list of `{ "type": "api_key", "excerpt": "..." }`
entries. `excerpt` is truncated to avoid re-leaking the secret in the
response itself.

## When to use

- Before posting to an external API (email, webhook, social).
- Before sending a message to another agent.
- Before persisting user-authored content to a shared memory store.

## When not to use

This is a pre-execution gate, not a DLP-grade scanner. If you need
regulated-data classification (HIPAA/PCI), pair noleak with a dedicated
DLP and let the stricter tool win.
