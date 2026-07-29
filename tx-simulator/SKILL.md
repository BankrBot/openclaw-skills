---
name: tx-simulator
description: |
  Simulate any Ethereum transaction before signing. See exactly what
  will happen — which tokens move, how much gas it costs, and whether
  it succeeds or fails. Free tier shows basic result. Paid x402 tier
  ($0.02) shows full state diff, event logs, and gas breakdown.
  No wallet required. No signature required.
  Triggers: "simulate this tx", "what happens if I sign this",
  "tx preview", "preflight transaction".
credentials: []
metadata:
  openclaw:
    requires:
      env:
        - BANKR_API_KEY
---

# tx-simulator

**Simulate any transaction before signing. Free tier. Paid x402 ($0.02).**

## Quick Start

```bash
curl -X POST <endpoint> \
  -H "Content-Type: application/json" \
  -d '{"to": "0x...", "value": "0", "data": "0x..."}'
```

## Free Tier

- Success/fail result
- Gas estimate
- Basic error message

## Paid Tier ($0.02 via x402)

- Full state diff (before/after balances)
- Event logs emitted
- Gas breakdown (base + priority + blob)
- Token transfer details
- Contract call trace

## Install

```bash
# Once BankrBot/skills PR merges:
bankr install tx-simulator

# Direct usage:
curl -X POST <endpoint> -d '{"to": "0x...", "data": "0x..."}'
```

## Source

https://github.com/SlumPark/bankrguard/tree/main/skills/tx-simulator
