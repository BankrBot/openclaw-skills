---
name: spraay
description: "Multi-chain batch crypto payments, payroll, invoices, token swaps, price feeds, and AI inference via the Spraay x402 gateway. Use when the user wants to send tokens to multiple wallets, batch transfer, run crypto payroll, create invoices, swap tokens, check prices, resolve ENS or Basenames, or interact with the Spraay Protocol. Supports Base, Ethereum, Arbitrum, Polygon, BNB Chain, Avalanche, Solana, Unichain, Plasma, BOB, Bittensor."
version: 1.0.0
homepage: https://spraay.app
metadata: {"openclaw":{"emoji":"💧","requires":{"bins":["curl","jq"]}}}
---

# Spraay Payments 💧

Multi-chain batch crypto payments, payroll, swaps, invoices, price feeds, and more — all through one API gateway.

## What is Spraay?

Spraay is a protocol for sending crypto to multiple wallets in a single transaction. The x402 gateway exposes 57 paid endpoints and 5 free endpoints. Paid endpoints use x402 HTTP micropayments — no API key needed.

**Gateway:** `https://gateway.spraay.app`

**Supported chains:** Base, Ethereum, Arbitrum, Polygon, BNB Chain, Avalanche, Solana, Unichain, Plasma, BOB, Bittensor

**Payment contract (Base):** `0x1646452F98E36A3c9Cfc3eDD8868221E207B5eEC`

## Quick Start

```bash
export SPRAAY_GATEWAY_URL="https://gateway.spraay.app"
```

No API key. Payments handled per-request via x402 (HTTP 402 → pay → retry).

## Core Operations

### Batch Payments (up to 200 recipients, ~80% gas savings)

```bash
curl -X POST "$SPRAAY_GATEWAY_URL/api/batch-payment" \
  -H "Content-Type: application/json" \
  -d '{
    "recipients": [
      {"address": "0xABC...", "amount": "1000"},
      {"address": "alice.eth", "amount": "500"},
      {"address": "bob.base", "amount": "750"}
    ],
    "token": "USDC",
    "chain": "base"
  }'
```

ENS and Basename addresses resolve automatically.

### Token Prices (Free — no payment)

```bash
curl "$SPRAAY_GATEWAY_URL/api/price?symbol=ETH"
```

### Token Swaps

```bash
curl -X POST "$SPRAAY_GATEWAY_URL/api/swap-quote" \
  -H "Content-Type: application/json" \
  -d '{"tokenIn": "ETH", "tokenOut": "USDC", "amount": "1.0", "chain": "base"}'
```

### Balances

```bash
curl "$SPRAAY_GATEWAY_URL/api/balance?address=0xWALLET&chain=base"
```

### ENS / Basename Resolution (Free)

```bash
curl "$SPRAAY_GATEWAY_URL/api/resolve?name=vitalik.eth"
```

### Invoices

```bash
curl -X POST "$SPRAAY_GATEWAY_URL/api/create-invoice" \
  -H "Content-Type: application/json" \
  -d '{"recipient": "0xABC...", "amount": "500", "token": "USDC", "chain": "base", "memo": "March invoice"}'
```

### AI Chat (via OpenRouter)

```bash
curl -X POST "$SPRAAY_GATEWAY_URL/api/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "Explain DeFi yield farming", "model": "openrouter/auto"}'
```

## Communication

| Endpoint | Description |
|----------|-------------|
| `/api/email/send` | Send email (AgentMail) |
| `/api/xmtp/send` | Send XMTP message |
| `/api/sms/send` | Send SMS |
| `/api/webhook/send` | Fire webhook |

## Infrastructure

| Endpoint | Description |
|----------|-------------|
| `/api/rpc/relay` | RPC relay (Alchemy, 7 chains) |
| `/api/ipfs/pin` | Pin to IPFS (Pinata) |
| `/api/cron/create` | Scheduled jobs |
| `/api/log/write` | Logging |

## Free Endpoints (no x402 payment)

- `GET /api/price?symbol=ETH`
- `GET /api/resolve?name=vitalik.eth`
- `GET /api/health`
- `GET /api/chains`
- `GET /api/endpoints`

## x402 Payment Flow

1. Call any paid endpoint
2. Get HTTP 402 with payment details
3. Send micropayment to facilitator
4. Retry with `X-PAYMENT` header
5. Get response

## Complementary to Bankr

Spraay handles **batch operations** — paying dozens of wallets in one tx, running payroll, distributing airdrops. Bankr handles individual trades and portfolio management. They work great together: use Bankr for trading, use Spraay for distributing proceeds.

## Links

- App: https://spraay.app
- Gateway: https://gateway.spraay.app
- GitHub: https://github.com/plagtech
- ClawHub: https://clawhub.ai/plagtech/spraay-payments
- MCP Server: https://smithery.ai/server/@plagtech/spraay-x402-mcp
- Twitter: https://twitter.com/Spraay_app
