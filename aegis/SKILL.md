---
name: aegis
description: Autonomous gas sponsorship agent on Base. Use when the user wants gas sponsorship, protocol budget management, agent reputation, or treasury management on Base.
metadata:
  clawdbot:
    emoji: "🛡️"
    homepage: "https://clawgas.vercel.app"
    requires: { bins: ["curl", "jq"] }
---

# Aegis

Autonomous Gas Sponsorship Agent on Base. Aegis sponsors gas for AI agents and protocols using ERC-4337 paymasters, manages protocol budgets, issues ERC-8004 reputation attestations, and publishes transparency proofs to Farcaster and Moltbook.

## What Aegis Does

- **Gas Sponsorship** — Sponsors gas for approved agents and protocols on Base (and Base Sepolia)
- **Protocol Budget Management** — Protocols register, top up via USDC, and manage approved agents
- **x402 Payments** — Pay-per-use sponsorship via the x402 payment protocol
- **ERC-8004 Identity** — On-chain agent identity and reputation attestations
- **Transparency Proofs** — Posts health updates and sponsorship summaries to Farcaster and Moltbook

## Quick Start

### Setup

1. **Set the Aegis API base URL** (use your deployed instance or the public demo):

   ```bash
   export AEGIS_URL="https://clawgas.vercel.app"
   ```

2. **Verify connectivity**:

   ```bash
   curl -s "$AEGIS_URL/api/health" | jq .
   ```

3. **Optional — API key for protected endpoints** (register, cycle, protocol agents):

   ```bash
   export AEGIS_API_KEY="your-api-key"
   ```

### Verify

```bash
# Health check
curl -s "$AEGIS_URL/api/health" | jq '.status, .ethBalance, .runwayDays'

# Pricing
curl -s "$AEGIS_URL/api/agent/price?action=TRANSFER" | jq .

# Agent card (A2A discovery)
curl -s "$AEGIS_URL/.well-known/agent-card.json" | jq .
```

## Usage

Common prompts for Moltbot/Clawdbot:

- "Check Aegis health" — Fetch reserve status, runway, and protocol budgets
- "Register a protocol with Aegis" — Create a new protocol sponsor via `POST /api/protocol/register`
- "Get sponsorship pricing" — Get x402 pricing for transfers via `GET /api/agent/price`
- "Check sponsorship request status" — Query `GET /api/agent/request-status/{requestId}` or `GET /api/agent/request-status/stats`
- "List protocols" — Fetch all protocols via `GET /api/protocol`
- "Dashboard stats" — Get sponsorships today, active protocols, reserve health via `GET /api/dashboard/stats`

## API Overview

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/health` | GET | None | Reserve state, runway, protocol budgets |
| `/api/health/deep` | GET | None | Full system health (Redis, metrics) |
| `/api/agent/price` | GET | None | x402 pricing for actions |
| `/api/agent/request-status/{id}` | GET | None | Sponsorship request status |
| `/api/agent/request-status/stats` | GET | None | Queue stats |
| `/api/protocol` | GET | None | List protocols |
| `/api/protocol/register` | POST | None | Register new protocol |
| `/api/protocol/{id}` | GET | None | Protocol details |
| `/api/protocol/{id}/topup` | POST | None | Credit USDC deposit (txHash) |
| `/api/dashboard/stats` | GET | None | Dashboard statistics |
| `/.well-known/agent-card.json` | GET | None | A2A agent discovery |

For full API reference, see `references/api-reference.md`. For integration steps, see `references/integration-guide.md`.

### Example: Health Check

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

### Example: Register Protocol

```bash
curl -s -X POST "$AEGIS_URL/api/protocol/register" \
  -H "Content-Type: application/json" \
  -d '{"protocolId":"my-protocol","name":"My Protocol","tier":"standard"}' | jq .
```

### Example: Get Pricing

```bash
curl -s "$AEGIS_URL/api/agent/price?action=TRANSFER&token=USDC" | jq .
```

## Resources

- **Dashboard**: https://clawgas.vercel.app
- **Agent Card**: `$AEGIS_URL/.well-known/agent-card.json`
- **ERC-8004**: Registered on Base Sepolia (identity + reputation)
- **Farcaster**: Transparency casts on sponsorship and health
- **Moltbook**: Agent profile and engagement
- **Repository**: https://github.com/BankrBot/aegis-agent (or your fork)
