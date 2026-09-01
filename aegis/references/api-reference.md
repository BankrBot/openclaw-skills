# Aegis API Reference

Complete reference for all Aegis API endpoints. Base URL: `$AEGIS_URL` (e.g. `https://clawgas.vercel.app`).

## Authentication

| Type | Usage |
|------|--------|
| **None** | Public endpoints (health, pricing, protocol list, request status, dashboard) |
| **Bearer token** | `Authorization: Bearer <AEGIS_API_KEY>` — agent, cycle, protocol agents, deposit-verify, reactive event |
| **HMAC signature** | Webhooks use `X-Aegis-Signature` / `X-Botchan-Signature` + timestamp |

---

## Agent Endpoints

### GET /.well-known/agent-card.json

A2A agent discovery. Returns agent identity, capabilities, and endpoint map.

**Auth:** None  
**Response:** JSON with `name`, `description`, `capabilities`, `endpoints`, `authentication`, `chains`

---

### GET /api/health

Basic health check with reserve state.

**Auth:** None  
**Response:**
```json
{
  "status": "healthy" | "degraded" | "emergency",
  "healthScore": 0-100,
  "ethBalance": 0.5,
  "usdcBalance": 1000,
  "runwayDays": 30,
  "forecastedRunwayDays": 25,
  "dailyBurnRateETH": 0.01,
  "sponsorshipsLast24h": 42,
  "emergencyMode": false,
  "protocolBudgets": [...],
  "lastUpdated": "2025-02-07T..."
}
```

---

### GET /api/health/deep

Full system health (Redis, metrics). Optional `?quick=true` or `?format=prometheus`.

**Auth:** None  
**Response:** Components status, metrics, uptime

---

### GET /api/health/redis

Redis connectivity check.

**Auth:** None  
**Response:** `{ "redis": "connected" | "disconnected" }`

---

### GET /api/agent/price

x402 pricing for agent actions.

**Auth:** None  
**Query:** `action` (TRANSFER|EXECUTE|SWAP|REBALANCE|WAIT|ALERT_HUMAN), `token` (default USDC), `amount` (optional)

**Response:**
```json
{
  "price": "0.015",
  "priceWei": "15000",
  "currency": "USDC",
  "validFor": 300,
  "action": "TRANSFER",
  "breakdown": { "baseFee": "0.001", "gasEstimate": "0.01", "gasMarkup": 1.1 }
}
```

---

### GET /api/agent/request-status/{requestId}

Get sponsorship request status. Use `stats` as requestId for queue stats.

**Auth:** None  
**Response (by status):**
- `pending`: message, retryCount
- `processing`: processingStartedAt
- `completed`: txHash, userOpHash, actualCostUSD, explorerUrl
- `failed`: error, retryCount, maxRetries
- `rejected`: error

---

### POST /api/agent/request-status/{requestId}

Cancel a pending request.

**Auth:** None  
**Body:** `{ "action": "cancel" }`  
**Response:** `{ "success": true, "requestId", "action": "cancelled" }`

---

### POST /api/agent/register

Register agent with ERC-8004 Identity Registry.

**Auth:** Bearer (AEGIS_API_KEY)  
**Response:** `{ "agentId", "txHash", "registryAddress" }` or `{ "agentId", "message": "already registered" }`

---

### POST /api/agent/cycle

Trigger a single agent cycle manually.

**Auth:** Bearer (AEGIS_API_KEY)  
**Body:** `AgentCycleRequestSchema` (confidenceThreshold, maxTransactionValueUsd, executionMode, etc.)  
**Response:** `{ "ok": true, "state": { ... } }`

---

### GET /api/agent/status

Agent health status.

**Auth:** Bearer (AEGIS_API_KEY)  
**Response:** `{ "status": "healthy", "timestamp", "uptime" }`

---

## Protocol Endpoints

### POST /api/protocol/register

Register a new protocol sponsor.

**Auth:** None  
**Body:**
```json
{
  "protocolId": "my-protocol",
  "name": "My Protocol",
  "tier": "bronze" | "silver" | "gold",
  "whitelistedContracts": ["0x..."],
  "initialBalanceUSD": 0
}
```
**Response:** `{ "protocolId", "name", "tier", "balanceUSD", "createdAt" }`

---

### GET /api/protocol

List all protocol sponsors.

**Auth:** None  
**Response:** `{ "protocols": [...], "count" }`

---

### GET /api/protocol/{protocolId}

Get protocol details.

**Auth:** None  
**Response:** protocolId, name, balanceUSD, totalSpent, sponsorshipCount, whitelistedContracts, tier, createdAt, updatedAt

---

### PATCH /api/protocol/{protocolId}

Update protocol (name, tier, whitelistedContracts).

**Auth:** None  
**Body:** `{ "name"?, "tier"?, "whitelistedContracts"? }`

---

### GET /api/protocol/{protocolId}/agents

List approved agents for protocol.

**Auth:** Bearer (AEGIS_API_KEY)  
**Query:** `includeInactive?`, `agentAddress?`  
**Response:** `{ "protocolId", "protocolName", "tier", "agents": [...], "count", "activeCount" }`

---

### POST /api/protocol/{protocolId}/agents

Approve an agent for the protocol.

**Auth:** Bearer (AEGIS_API_KEY)  
**Body:** `{ "agentAddress", "agentName"?, "approvedBy", "maxDailyBudget"? }`  
**Response:** `{ "success": true, "action": "approved"|"reactivated", "agent": {...}, "protocolId" }`

---

### DELETE /api/protocol/{protocolId}/agents

Revoke agent approval. Query: `agentAddress`.

**Auth:** Bearer (AEGIS_API_KEY)

---

### PATCH /api/protocol/{protocolId}/agents

Update agent (maxDailyBudget, isActive). Body: `{ "agentAddress", "agentName"?, "maxDailyBudget"?, "isActive"? }`

**Auth:** Bearer (AEGIS_API_KEY)

---

### POST /api/protocol/{protocolId}/topup

Credit protocol balance via on-chain USDC deposit.

**Auth:** None  
**Body (production):** `{ "txHash": "0x...", "chainId"?: 8453 }`  
**Response:** `{ "success": true, "protocolId", "txHash", "chainId", "amount", "newBalance", "verifiedAt" }`

---

### GET /api/protocol/{protocolId}/topup

Get top-up status or recent deposits.

**Auth:** None

---

### POST /api/protocol/{protocolId}/deposit-verify

Verify and credit USDC deposit (admin).

**Auth:** Bearer (AEGIS_API_KEY)  
**Body:** `{ "txHash" }`  
**Response:** `{ "success": true, "protocolId", "txHash", "amount", "newBalance", "message" }`

---

### POST /api/protocol/webhook

x402 payment webhook. Credits protocol balance when facilitator confirms payment.

**Auth:** HMAC (`X-Aegis-Signature`, `X-Aegis-Timestamp`). Secret: PROTOCOL_WEBHOOK_SECRET  
**Body:** `{ "protocolId", "amountUSD", "paymentId"?, "txHash"?, "metadata"? }`  
**Response:** `{ "ok": true, "protocolId", "balanceUSD", "creditedAmount", "paymentId", "txHash", "latencyMs" }`  
**Rate limit:** 10 req/min per protocol

---

## Dashboard Endpoints

### GET /api/dashboard/status

Agent signing capability and mode.

**Auth:** None  
**Response:** `{ "mode", "canSign", "signingMethod", "hasWallet" }`

---

### GET /api/dashboard/stats

Dashboard statistics.

**Auth:** None  
**Response:** `{ "sponsorshipsToday", "activeProtocols", "reserveHealth": { "ETH", "USDC", "healthy", "balances" }, "timestamp" }`

---

### GET /api/dashboard/activity

Recent sponsorship activity.

**Auth:** None  
**Query:** `limit` (default 50, max 100)  
**Response:** `{ "activity": [...], "count" }`

---

### GET /api/dashboard/social

Moltbook and Farcaster social activity status.

**Auth:** None  
**Response:** moltbook profile, karma, followers, recent posts; farcaster lastPost, postIntervalMinutes

---

### POST /api/dashboard/verify

Verify a decision hash (on-chain + signature).

**Auth:** None  
**Body:** `{ "decisionHash" }`

---

## Webhook Endpoints

### POST /api/botchan/webhook

Botchan webhook for agent requests.

**Auth:** HMAC-SHA256 (`X-Botchan-Signature`). Secret: BOTCHAN_WEBHOOK_SECRET  
**Body:** `{ "type", "feed", "sender", "message", "timestamp"?, "metadata"? }`  
**Response:** `{ "ok": true, "processed", "approved"?, "reason"? }`

---

### POST /api/reactive/event

Reactive Network event callback.

**Auth:** Bearer (AEGIS_API_KEY) + HMAC (`X-Reactive-Signature`). Secret: REACTIVE_CALLBACK_SECRET  
**Body:** ReactiveEventSchema (chainId, event, data)  
**Response:** `{ "ok": true, "triggered": true }`
