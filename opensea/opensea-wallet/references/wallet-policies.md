# Wallet Policies (Privy)

Privy wallet policies enforce guardrails on transaction signing. Policies are evaluated inside a trusted execution environment (TEE) before any signing occurs, so an *applied* policy cannot be bypassed by application code at sign time.

This is narrower than it sounds. The TEE protects against a compromised agent **signing through** an active policy, but it does **not** protect against the same credentials **rewriting** the policy first. Whoever holds `PRIVY_APP_ID` + `PRIVY_APP_SECRET` for a wallet without an `owner_id` can `PATCH /v1/wallets/{id}` to swap the policy for a permissive one and then sign freely. The hardening that closes this gap — registering an `owner_id` so policy mutations require a separate authorization signature — is in `references/wallet-setup.md`. Without it, the per-tx cap is a speed bump, not a ceiling.

> **For agents reading this file:** applying or modifying policies is a **user-only operation** performed on a trusted machine with the wallet's authorization key. The agent must never construct or run policy-mutation requests. If a user asks the agent to update a policy, the agent should refuse and direct them to apply the change themselves from a trusted machine. The mutation recipes (HTTP method, body shape, signing) live outside the agent's skill path in `../../docs/policy-administration.md`.

This file describes **what policies look like and what fields they support**, so the agent can help a user *author* a policy that the user then applies. It deliberately does not describe how to send the policy update request.

## Overview

Policies restrict what transactions a wallet can sign:

- **Transaction value caps**: maximum ETH/token value per transaction
- **Destination allowlists**: only sign transactions to approved contract addresses
- **Chain restrictions**: limit signing to specific chains
- **Method restrictions**: only allow specific contract method calls
- **Key export prevention**: prevent extraction of the private key

> **Note on aggregate caps:** Privy policies are **stateless per-tx evaluators**. They cannot enforce daily/weekly cumulative spend limits. For aggregate ceilings, see `references/wallet-funding.md` (hot/cold wallet float pattern) — the wallet balance is the real aggregate cap.

## Configuring Policies

Policies are authored as JSON (templates below) and applied by the user from a trusted machine. The agent can help draft and review the JSON; it must not apply it.

The full Privy reference for policy fields and operators is at [docs.privy.io/controls/policies](https://docs.privy.io/controls/policies/overview). To apply or modify a policy, see `../../docs/policy-administration.md`.

## Recommended Policies

### Agent Trading: Conservative

Suitable for automated agents executing swaps and NFT purchases with tight guardrails.

```json
{
  "rules": [
    {
      "name": "Limit transaction value",
      "conditions": [
        {
          "field_source": "ethereum_transaction",
          "field": "value",
          "operator": "lte",
          "value": "100000000000000000"
        }
      ],
      "action": "ALLOW"
    },
    {
      "name": "Allow OpenSea Seaport",
      "conditions": [
        {
          "field_source": "ethereum_transaction",
          "field": "to",
          "operator": "eq",
          "value": "0x0000000000000068F116a894984e2DB1123eB395"
        }
      ],
      "action": "ALLOW"
    },
    {
      "name": "Restrict to supported chains",
      "conditions": [
        {
          "field_source": "ethereum_transaction",
          "field": "chain_id",
          "operator": "in",
          "value": ["1", "8453", "137", "42161", "10"]
        }
      ],
      "action": "ALLOW"
    },
    {
      "name": "Deny everything else",
      "conditions": [],
      "action": "DENY"
    }
  ]
}
```

### Agent Trading: Permissive

For trusted agents with higher limits and broader destination access.

```json
{
  "rules": [
    {
      "name": "Limit transaction value",
      "conditions": [
        {
          "field_source": "ethereum_transaction",
          "field": "value",
          "operator": "lte",
          "value": "1000000000000000000"
        }
      ],
      "action": "ALLOW"
    },
    {
      "name": "Restrict to supported chains",
      "conditions": [
        {
          "field_source": "ethereum_transaction",
          "field": "chain_id",
          "operator": "in",
          "value": ["1", "8453", "137", "42161", "10"]
        }
      ],
      "action": "ALLOW"
    },
    {
      "name": "Deny everything else",
      "conditions": [],
      "action": "DENY"
    }
  ]
}
```

## Policy Fields Reference

| Field | Source | Description |
|-------|--------|-------------|
| `value` | `ethereum_transaction` | Transaction value in wei |
| `to` | `ethereum_transaction` | Destination contract address |
| `chain_id` | `ethereum_transaction` | EVM chain ID |
| `data` | `ethereum_transaction` | Transaction calldata (for method filtering) |

## Operators

| Operator | Description |
|----------|-------------|
| `eq` | Equal to |
| `neq` | Not equal to |
| `gt` | Greater than |
| `gte` | Greater than or equal |
| `lt` | Less than |
| `lte` | Less than or equal |
| `in` | In list |
| `not_in` | Not in list |

## Key Addresses

| Contract | Address | Usage |
|----------|---------|-------|
| Seaport 1.6 | `0x0000000000000068F116a894984e2DB1123eB395` | NFT marketplace orders |
| Native ETH | `0x0000000000000000000000000000000000000000` | Swap from address for native ETH |
| WETH (Base) | `0x4200000000000000000000000000000000000006` | Wrapped ETH on Base |
| USDC (Base) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | USD Coin on Base |

## Tips

1. **Start conservative**: begin with tight value caps and a narrow allowlist, then relax as needed
2. **Use chain restrictions**: limit to chains you actively trade on
3. **Monitor policy violations**: Privy logs denied transactions in the dashboard
4. **Separate wallets for separate concerns**: use different wallets (and policies) for swaps vs. NFT purchases
5. **Never disable policies in production**: keep at least a value cap active
