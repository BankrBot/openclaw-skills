---
name: swapapi
metadata:
  {
    "bankr":
      {
        "emoji": "🔄",
        "homepage": "https://api.swapapi.dev",
        "requires": { "bins": ["curl"] },
      },
  }
---

# SwapAPI

Get executable token swap calldata for any EVM chain via HTTP API. Free, no API keys required.

## Quick Start

Swap 0.001 ETH for USDC on Base:

```bash
curl "https://api.swapapi.dev/v1/swap/8453?\
tokenIn=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&\
tokenOut=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&\
amount=1000000000000000&\
sender=0xYourAddress"
```

Returns transaction data ready to sign and broadcast:

```json
{
  "success": true,
  "data": {
    "status": "Successful",
    "tx": {
      "to": "0x...",
      "data": "0x...",
      "value": "1000000000000000",
      "gas": "150000"
    },
    "expectedAmountOut": "2435120",
    "minAmountOut": "2422947"
  }
}
```

## Supported Chains

| Chain ID | Chain | Native Token |
|----------|-------|--------------|
| 1 | Ethereum | ETH |
| 8453 | Base | ETH |
| 42161 | Arbitrum | ETH |
| 137 | Polygon | MATIC |
| 10 | Optimism | ETH |
| 56 | BSC | BNB |
| 43114 | Avalanche | AVAX |

...and 40+ more. See [references/chains.md](references/chains.md) for full list.

## API Reference

**Endpoint:** `GET /v1/swap/{chainId}`

**Parameters:**

| Param | Required | Description |
|-------|----------|-------------|
| `chainId` | path | Chain ID (e.g., 8453 for Base) |
| `tokenIn` | query | Input token address. Use `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE` for native ETH |
| `tokenOut` | query | Output token address |
| `amount` | query | Input amount in smallest unit (wei for ETH) |
| `sender` | query | Your wallet address |
| `maxSlippage` | query | Optional. 0-1 (default: 0.005 = 0.5%) |

**Response codes:**
- `200` — Quote ready
- `400` — Invalid params or unsupported chain
- `429` — Rate limit (60/min per IP)

## Native Token Address

Use `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE` for:
- ETH (Ethereum, Base, Arbitrum, Optimism)
- MATIC (Polygon)
- BNB (BSC)
- AVAX (Avalanche)

Always 18 decimals.

## Common Token Addresses

| Token | Address (Base) |
|-------|----------------|
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| USDbC | `0xd9aAEc86B65D86f6A7B5B1d0c0c41515Da3f5F0` |
| cbETH | `0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22` |
| WETH | `0x4200000000000000000000000000000000000006` |

## Example: ETH → USDC on Base

```bash
# 1. Get swap quote
RESPONSE=$(curl -s "https://api.swapapi.dev/v1/swap/8453?\
tokenIn=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&\
tokenOut=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&\
amount=1000000000000000&\
sender=$SENDER")

# 2. Parse transaction fields
TX_TO=$(echo "$RESPONSE" | jq -r '.data.tx.to')
TX_DATA=$(echo "$RESPONSE" | jq -r '.data.tx.data')
TX_VALUE=$(echo "$RESPONSE" | jq -r '.data.tx.value')
TX_GAS=$(echo "$RESPONSE" | jq -r '.data.tx.gas')
EXPECTED_OUT=$(echo "$RESPONSE" | jq -r '.data.expectedAmountOut')

# 3. Sign and send (using cast)
cast send \
  --rpc-url "https://mainnet.base.org" \
  --private-key "$PRIVATE_KEY" \
  "$TX_TO" \
  --value "$TX_VALUE" \
  --gas-limit "$TX_GAS" \
  --data "$TX_DATA"
```

## Pre-flight Checklist

Before executing any swap:

1. **ERC-20 Approval** — If `tokenIn` is not native, ensure approval: `token.approve(router, amount)`
2. **Balance Check** — Native: `balance >= tx.value`, ERC-20: `balanceOf(sender) >= amountIn`
3. **Gas Estimation** — Call `eth_estimateGas`, add 20% buffer
4. **Simulation** — Run `eth_call` to verify no revert
5. **Timing** — Submit within 30s (calldata expires)

## Scripts

See [scripts/](scripts/) for helper utilities:

- `swap.sh` — Interactive swap CLI
- `quote.sh` — Get quote only

## Resources

- **API Docs**: https://api.swapapi.dev
- **GitHub**: https://github.com/swap-api/swap-api
- **OpenAPI**: https://github.com/swap-api/swap-api/blob/main/openapi.json
