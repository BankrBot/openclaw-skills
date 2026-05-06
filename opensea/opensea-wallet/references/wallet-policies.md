# Wallet Policies (Privy)

Privy wallet policies enforce guardrails on transaction signing. Policies are evaluated inside a trusted execution environment (TEE) before any signing occurs, so they cannot be bypassed by application code.

## Overview

Policies restrict what transactions a wallet can sign:

- **Transaction value caps**: maximum ETH/token value per transaction
- **Destination allowlists**: only sign transactions to approved contract addresses
- **Chain restrictions**: limit signing to specific chains
- **Method restrictions**: only allow specific contract method calls
- **Key export prevention**: prevent extraction of the private key

## Configuring Policies

Policies are configured via the Privy dashboard or API. See [Privy policy documentation](https://docs.privy.io/controls/policies/overview) for the full reference.

### Via API

```bash
curl -X PUT "https://api.privy.io/v1/wallets/$PRIVY_WALLET_ID/policy" \
  -H "Authorization: Basic $(echo -n "$PRIVY_APP_ID:$PRIVY_APP_SECRET" | base64)" \
  -H "privy-app-id: $PRIVY_APP_ID" \
  -H "Content-Type: application/json" \
  -d @policy.json
```

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
