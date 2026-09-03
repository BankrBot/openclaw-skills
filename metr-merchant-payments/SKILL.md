---
name: metr-merchant-payments
description: Claim and withdraw payments from Metr (metrpay.com) merchant account.
tags: [payments, merchant, metr, withdraw, claim]
---

# Metr Merchant Payments

Manage your Metr merchant account — start payment sessions, end (settle) them, and withdraw funds to your wallet.

## What is Metr?

Metr is a multi-chain payment protocol that lets merchants accept crypto (USDC, SOL, POL, ETH, and custom SPL/ERC-20 tokens) via session-based checkout. Funds are held in escrow during a session and released when the session ends.

- Website: https://metrpay.com
- API Base: `https://api.metr.app/v1`

## Prerequisites

1. A Metr merchant account (sign up at https://metrpay.com)
2. Your **Merchant API Key** — found in your Metr dashboard under Settings → API Keys
3. (Optional) An **Agent Key** if you want to run agentic checkout sessions

## Authentication

All API calls require headers:

| Header | Value | When |
|--------|-------|------|
| `x-api-key` | Your merchant API key | All merchant endpoints |
| `x-agent-key` | Your agent key | Agent session endpoints |

Store your key securely in Bankr:
- Open the Bankr terminal sidebar → click **Advanced** → click **Env Vars**
- Add `METR_MERCHANT_API_KEY` = your merchant key
- Add `METR_AGENT_KEY` = your agent key (if using agent sessions)

## Core Operations

### 1. Start a Payment Session

Initiate a checkout session for a customer.

**Endpoint:** `POST /v1/integrate/sessions/start`

**Headers:**
- `Content-Type: application/json`
- `x-api-key: <your-merchant-key>`

**Body:**
```json
{
  "amount": "10.00",
  "currency": "USDC",
  "chain": "base",
  "metadata": {
    "orderId": "order_12345",
    "customerEmail": "customer@example.com"
  }
}
```

**Response:**
```json
{
  "sessionId": "sess_abc123",
  "paymentUrl": "https://pay.metr.app/sess_abc123",
  "status": "pending",
  "expiresAt": "2026-07-01T12:00:00Z"
}
```

**Bankr CLI equivalent:**
```bash
curl -X POST https://api.metr.app/v1/integrate/sessions/start \
  -H "Content-Type: application/json" \
  -H "x-api-key: $METR_MERCHANT_API_KEY" \
  -d '{
    "amount": "10.00",
    "currency": "USDC",
    "chain": "base",
    "metadata": {"orderId": "order_12345"}
  }'
```

### 2. End (Settle) a Session

Release escrowed funds to the merchant wallet once the order is fulfilled.

**Endpoint:** `POST /v1/integrate/sessions/{sessionId}/end`

**Headers:**
- `Content-Type: application/json`
- `x-api-key: <your-merchant-key>`

**Body:**
```json
{
  "reason": "fulfillment_complete",
  "metadata": {
    "deliveredAt": "2026-07-01T10:30:00Z"
  }
}
```

**Response:**
```json
{
  "sessionId": "sess_abc123",
  "status": "settled",
  "settledAt": "2026-07-01T10:30:05Z",
  "txHash": "0x..."
}
```

**Bankr CLI equivalent:**
```bash
curl -X POST "https://api.metr.app/v1/integrate/sessions/$SESSION_ID/end" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $METR_MERCHANT_API_KEY" \
  -d '{"reason": "fulfillment_complete"}'
```

### 3. Start an Agent Session

For AI-agent-initiated payments (e.g., an agent buying a service on behalf of a user).

**Endpoint:** `POST /v1/agents/sessions/start`

**Headers:**
- `Content-Type: application/json`
- `x-api-key: <your-merchant-key>`
- `x-agent-key: <your-agent-key>`

**Body:**
```json
{
  "amount": "5.00",
  "currency": "USDC",
  "chain": "solana",
  "agentId": "agent_001",
  "metadata": {
    "service": "api_call",
    "tier": "premium"
  }
}
```

### 4. End an Agent Session

**Endpoint:** `POST /v1/agents/sessions/{sessionId}/end`

**Headers:**
- `Content-Type: application/json`
- `x-api-key: <your-merchant-key>`
- `x-agent-key: <your-agent-key>`

**Body:**
```json
{
  "reason": "service_delivered",
  "metadata": {}
}
```

## Claim & Withdraw Funds

Metr does not expose a direct "claim" API endpoint. Instead:

1. **Settlement = Claim:** Ending a session automatically releases the escrowed funds to your configured merchant wallet. The `txHash` in the end-session response is your on-chain proof.

2. **Withdraw from Dashboard:** For bulk withdrawals or moving funds to a different wallet:
   - Log in to https://metrpay.com/dashboard
   - Go to **Balances**
   - Select the chain/token you want to withdraw
   - Enter your destination wallet address
   - Confirm the withdrawal (on-chain tx will be sent)

3. **Webhook Notifications:** Set up a webhook in your Metr dashboard to receive real-time events:
   - `session.settled` — funds released to merchant wallet
   - `withdrawal.completed` — manual withdrawal finished

## Supported Chains & Tokens

| Chain | Native Token | Stablecoins | Custom Tokens |
|-------|-------------|-------------|---------------|
| Solana | SOL | USDC | SPL tokens |
| Polygon | POL | USDC | ERC-20 tokens |
| Base | ETH | USDC | ERC-20 tokens |

## Error Handling

Common HTTP status codes from Metr API:

| Code | Meaning | Action |
|------|---------|--------|
| 400 | Bad Request | Check request body schema |
| 401 | Unauthorized | Verify `x-api-key` is correct |
| 403 | Forbidden | Key lacks permission for this action |
| 404 | Session Not Found | Double-check `sessionId` |
| 409 | Session Already Ended | Idempotency — session is already settled |
| 422 | Validation Error | Amount too small, unsupported chain, etc. |
| 500 | Internal Error | Retry or contact Metr support |

## Full Workflow Example

```
1. Customer places order on your site
2. You call POST /v1/integrate/sessions/start
3. You redirect customer to paymentUrl
4. Customer pays via Metr checkout
5. You fulfill the order (ship product, run service, etc.)
6. You call POST /v1/integrate/sessions/{id}/end
7. Funds are released to your merchant wallet
8. (Optional) You withdraw from dashboard to cold storage
```

## References

- Metr Website: https://metrpay.com
- API Base: https://api.metr.app/v1
- Dashboard: https://metrpay.com/dashboard
