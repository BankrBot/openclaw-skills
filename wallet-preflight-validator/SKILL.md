---
name: wallet-preflight-validator
description: |
  Deterministic preflight check for BankrBot wallet actions. Before your agent signs
  any transaction (eth_sendTransaction, eth_signTypedData, eth_sendRawTransaction),
  run it through this skill. Checks for high-value transfers, unknown contracts,
  rapid-fire actions, and unusual gas patterns. No LLM. No wallet access. No browser.
  Free. Open source.
credentials: []
metadata:
  openclaw:
    requires:
      env:
        - BANKR_API_KEY
---

# Wallet Preflight Validator

**Deterministic preflight check for BankrBot wallet actions. Free.**

## Commands

| Command | Response | Fee |
|---------|----------|-----|
| `preflight {"action":"eth_sendTransaction"}` | allowed/blocked + risk level | Free |
| `preflight {"action":"eth_signTypedData"}` | allowed/blocked + warnings | Free |
| `preflight {"action":"eth_sendRawTransaction"}` | allowed/blocked + warnings | Free |

## Install

```bash
bankr install wallet-preflight-validator
```

## Source

https://github.com/SlumPark/bankrguard/tree/main/skills/wallet-preflight-validator

## Upgrade

Need custom rules or private deployment?
→ `bankr x402 call agent-safety-enforcer` ($0.03/req)
