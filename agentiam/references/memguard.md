# memguard — Memory-tampering and replay check

Validates that an agent's proposed action is consistent with its declared
memory/policy state. Catches two common classes of bug:

1. **Memory tampering** — an earlier step wrote something the agent never
   actually observed (hallucinated tool result, injected context).
2. **Replay** — the agent is re-executing an action that already ran.

## Price

$0.01 per call.

## Endpoint

```
POST https://x402.bankr.bot/0x24908846a4397d3549d07661e0fc02220ab14dad/memguard
```

## Request

```json
{
  "agent_id": "did:key:z6Mk...",
  "action": { "...": "..." },
  "memory_hash": "sha256:..."
}
```

`memory_hash` is the rolling hash of the agent's observed state at the
moment the action was proposed. memguard compares against the last
known-good hash from the canonical signer.

## Response

```json
{
  "result": {
    "pass": true,
    "reason": null,
    "last_known_hash": "sha256:..."
  },
  "proof": { "signer": "0x069c...", "signature": "0x...", "timestamp": "..." },
  "payment": { "tx_hash": "0x...", "amount_usdc": 0.01 }
}
```

## When to use

- At the start of a multi-step plan, when the plan depends on prior
  tool outputs.
- When the same action could be accidentally re-submitted (e.g. idempotent
  transfer with a nonce drift).

## Limitations

memguard does not persist memory for you. It only validates the hash you
claim against the last hash the canonical signer saw. If you never call
memguard, there is no history.
