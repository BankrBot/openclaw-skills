# Aegis Integration Guide

Step-by-step guide for integrating with Aegis: registering as a protocol, submitting sponsorship requests, and verifying status.

## Prerequisites

- `curl` and `jq` for API calls
- Aegis API base URL (e.g. `https://clawgas.vercel.app`)
- Optional: API key for protected endpoints (protocol agent management)
- Optional: Botchan feed for agent-to-agent sponsorship requests

---

## 1. Register as a Protocol Sponsor

Protocols create a budget and approve agents that can receive gas sponsorship.

### Step 1.1: Register the protocol

```bash
curl -s -X POST "$AEGIS_URL/api/protocol/register" \
  -H "Content-Type: application/json" \
  -d '{
    "protocolId": "my-protocol",
    "name": "My Protocol",
    "tier": "bronze",
    "whitelistedContracts": ["0xYourContractAddress"],
    "initialBalanceUSD": 0
  }' | jq .
```

**Response:**
```json
{
  "protocolId": "my-protocol",
  "name": "My Protocol",
  "tier": "bronze",
  "balanceUSD": 0,
  "createdAt": "2025-02-07T..."
}
```

### Step 1.2: Top up budget via on-chain USDC deposit

1. Send USDC to the Aegis treasury address (see Aegis docs for the current address).
2. Obtain the transaction hash of the deposit.
3. Submit the txHash to credit your protocol:

```bash
curl -s -X POST "$AEGIS_URL/api/protocol/my-protocol/topup" \
  -H "Content-Type: application/json" \
  -d '{"txHash": "0x...", "chainId": 8453}' | jq .
```

**Response:**
```json
{
  "success": true,
  "protocolId": "my-protocol",
  "txHash": "0x...",
  "chainId": 8453,
  "amount": 100,
  "newBalance": 100,
  "verifiedAt": "2025-02-07T..."
}
```

### Step 1.3: Approve agents (requires API key)

Agents must be approved before they can receive sponsorship from your protocol.

```bash
curl -s -X POST "$AEGIS_URL/api/protocol/my-protocol/agents" \
  -H "Authorization: Bearer $AEGIS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agentAddress": "0xAgentWalletAddress",
    "agentName": "My Agent",
    "approvedBy": "admin",
    "maxDailyBudget": 10
  }' | jq .
```

---

## 2. Submitting Sponsorship Requests

There are two main ways to request sponsorship: via Botchan (agent-to-agent) or via the sponsorship queue (API / internal).

### Option A: Botchan (Agent-to-Agent)

Configure your agent to post to a Botchan feed that Aegis monitors. Aegis parses messages for:

- Wallet address (agent or user to sponsor)
- Protocol ID
- Optional signature

Aegis enqueues valid requests and posts responses to the `aegis-responses` feed (or `BOTCHAN_FEED_OUTBOUND`).

### Option B: API / Queue

Sponsorship requests can be enqueued programmatically via:

- Internal queue (from the Aegis agent itself)
- Protocol webhook callbacks
- Reactive Network events

The status of a request can be queried via `/api/agent/request-status/{requestId}`.

---

## 3. Verifying Request Status

### Check a specific request

```bash
curl -s "$AEGIS_URL/api/agent/request-status/req_abc123" | jq .
```

**Example response (completed):**
```json
{
  "requestId": "req_abc123",
  "status": "completed",
  "protocolId": "my-protocol",
  "agentAddress": "0x...",
  "source": "botchan",
  "requestedAt": "2025-02-07T...",
  "message": "Request completed successfully",
  "completedAt": "2025-02-07T...",
  "txHash": "0x...",
  "userOpHash": "0x...",
  "actualCostUSD": 0.012,
  "explorerUrl": "https://basescan.org/tx/0x..."
}
```

### Queue stats

```bash
curl -s "$AEGIS_URL/api/agent/request-status/stats" | jq .
```

### Cancel a pending request

```bash
curl -s -X POST "$AEGIS_URL/api/agent/request-status/req_abc123" \
  -H "Content-Type: application/json" \
  -d '{"action": "cancel"}' | jq .
```

---

## 4. Setting Up Webhooks (x402 / Payment Notifications)

If you integrate with x402 or a payment facilitator, you can receive balance updates via the protocol webhook.

### Webhook configuration

- **URL:** `$AEGIS_URL/api/protocol/webhook`
- **Method:** POST
- **Headers:** `X-Aegis-Signature`, `X-Aegis-Timestamp`
- **Secret:** `PROTOCOL_WEBHOOK_SECRET` (configured on your Aegis instance)

### HMAC signature

Compute `HMAC-SHA256(secret, timestamp + "." + JSON.stringify(body))`. Send:

- `X-Aegis-Timestamp`: Unix timestamp in seconds
- `X-Aegis-Signature`: Hex-encoded HMAC

### Rate limits

10 requests per minute per protocol.

---

## 5. Monitoring and Health

### Reserve health

```bash
curl -s "$AEGIS_URL/api/health" | jq '{
  status,
  ethBalance,
  usdcBalance,
  runwayDays,
  sponsorshipsLast24h,
  emergencyMode
}'
```

### Dashboard stats

```bash
curl -s "$AEGIS_URL/api/dashboard/stats" | jq .
```

### Agent discovery (A2A)

```bash
curl -s "$AEGIS_URL/.well-known/agent-card.json" | jq .
```

---

## 6. Pricing (x402)

Before initiating a paid action, fetch the current price:

```bash
curl -s "$AEGIS_URL/api/agent/price?action=TRANSFER&token=USDC" | jq .
```

Use the returned `price` and `priceWei` for x402 payment headers.
