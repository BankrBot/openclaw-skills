---
name: bridge-guard
description: |
  Check if a cross-chain bridge is safe to use. Instantly see past
  incidents, current TVL, age, and auditor reports for any bridge
  across Base, Ethereum, BSC, Arbitrum, Solana, and more.
  Free: safety score + known incidents.
  Paid ($0.02 x402): detailed audit history + TVL alerts.
  Triggers: "is this bridge safe", "bridge audit", "check bridge",
  "bridge security score", "before bridging".
credentials: []
metadata:
  openclaw:
    requires:
      env: []
---

# bridge-guard

**Check any bridge before you use it. Free. x402 paid ($0.02).**

## Quick Start

```bash
curl -X POST <endpoint> \
  -H "Content-Type: application/json" \
  -d '{"bridge": "0x..."}'
```

## Free Tier

- Safety score (A/B/C/D/F)
- Known incidents (date, amount lost)
- Age (days since launch)
- Chains connected

## Paid Tier ($0.02 via x402)

- Full audit history
- Current TVL
- Daily volume estimate
- Security recommendations

## Install

```bash
bankr install bridge-guard
```

## Source

https://github.com/SlumPark/bankrguard/tree/main/skills/bridge-guard
