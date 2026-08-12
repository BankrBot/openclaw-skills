---
name: spraay
description: >
  Batch crypto payments, payroll, invoices, and agent-to-agent settlement via x402 micropayments.
  Use when the user wants to pay multiple wallets at once, distribute tokens, run on-chain payroll,
  airdrop to contributors, process invoices, or set up agent payment workflows. Supports 13 chains
  including Base, Ethereum, Solana, Bitcoin, Stacks, Arbitrum, and Polygon. Complements Bankr's
  trading skills by handling the payout side — after profits are made, Spraay distributes them.
---

# 💧 Spraay — Batch Payments & Agent Payment Infrastructure

Spraay handles the **payout side** of crypto operations. While Bankr executes trades and manages portfolios, Spraay distributes the results — paying teams, contributors, DAOs, and other agents in batch.

## How Spraay Complements Bankr

| Bankr Does | Spraay Does |
|------------|------------|
| Execute swaps & trades | Distribute profits to wallets |
| Manage portfolios | Run recurring payroll |
| Track P&L | Settle invoices & escrow |
| Monitor markets | Batch airdrop to contributors |
| Price feeds & analysis | Agent-to-agent x402 payments |

**Example workflow:**
```
User: "Take profits from my ETH position and split equally between these 5 wallets"
→ Bankr: sells ETH position, receives USDC
→ Spraay: batch sends USDC to 5 wallets in one transaction (0.3% fee)
```

## Supported Chains (13)

Base, Ethereum, Arbitrum, Polygon, BNB Chain, Avalanche, Unichain, Plasma, BOB, Solana, Bittensor, Stacks, Bitcoin.

## Core Capabilities

### 1. Batch Payments (EVM + Solana)
Send tokens to up to 200+ recipients in a single transaction.

```bash
# EVM batch payment (Base example)
curl -X POST "https://gateway.spraay.app/api/payments/batch" \
  -H "Content-Type: application/json" \
  -d '{
    "chain": "base",
    "token": "USDC",
    "recipients": [
      {"address": "0xABC...", "amount": "100"},
      {"address": "0xDEF...", "amount": "50"},
      {"address": "0x123...", "amount": "75"}
    ]
  }'
```

Contract address (Base): `0xAd62f03C7514bb8c51f1eA70C2b75C37404695c8`

### 2. Bitcoin Batch Payments (PSBT)
Non-custodial batch Bitcoin transfers. Spraay prepares the PSBT — the user signs locally with UniSat or Xverse.

```bash
# Get current fee rates
curl "https://gateway.spraay.app/api/bitcoin/fee-estimate"

# Prepare batch PSBT
curl -X POST "https://gateway.spraay.app/api/bitcoin/batch-prepare" \
  -H "Content-Type: application/json" \
  -d '{
    "recipients": [
      {"address": "bc1q...", "amount": 50000},
      {"address": "bc1q...", "amount": 25000}
    ],
    "feeRate": 10,
    "changeAddress": "bc1q..."
  }'

# After local signing, broadcast
curl -X POST "https://gateway.spraay.app/api/bitcoin/batch-broadcast" \
  -H "Content-Type: application/json" \
  -d '{"signedPsbt": "cHNidP8B..."}'
```

### 3. x402 Gateway (76+ Endpoints)
The gateway at `gateway.spraay.app` provides 76+ paid API endpoints across 16 categories. Payment is per-request via x402 USDC micropayments on Base.

**Key categories for Bankr users:**

| Category | Endpoint Example | Price |
|----------|-----------------|-------|
| Batch Payments | `POST /api/payments/batch` | 0.3% fee |
| AI Inference | `POST /api/ai/chat` | $0.01–$0.05 |
| Price Oracle | `GET /api/oracle/price/:pair` | $0.001 |
| Gas Oracle | `GET /api/oracle/gas/:chain` | $0.001 |
| RPC Calls | `POST /api/rpc/:chain` | $0.001 |
| Escrow | `POST /api/escrow/create` | $0.05 |
| Payroll | `POST /api/payroll/create` | $0.10 |
| Web Search | `POST /api/search/web` | $0.005 |
| IPFS Storage | `POST /api/ipfs/pin` | $0.01 |
| Email | `POST /api/email/send` | $0.005 |
| Bridge | `POST /api/bridge/quote` | $0.05 |

Full catalog: `GET https://gateway.spraay.app/api/bazaar/catalog`

### 4. Robot Task Protocol (RTP)
Open standard for AI agents to hire physical robots via x402 USDC micropayments.

```bash
# Discover robots near a location
curl "https://gateway.spraay.app/api/rtp/discover?capability=delivery&location=33.77,-117.87"

# Commission a task
curl -X POST "https://gateway.spraay.app/api/rtp/commission" \
  -H "Content-Type: application/json" \
  -d '{
    "robotId": "robot_abc123",
    "task": "delivery",
    "params": {"pickup": "123 Main St", "dropoff": "456 Oak Ave"}
  }'

# Check status
curl "https://gateway.spraay.app/api/rtp/status/task_xyz789"
```

### 5. Escrow & Payroll
```bash
# Create escrow
curl -X POST "https://gateway.spraay.app/api/escrow/create" \
  -H "Content-Type: application/json" \
  -d '{
    "chain": "base",
    "token": "USDC",
    "amount": "1000",
    "conditions": {"type": "approval", "approver": "0xABC..."}
  }'

# Create recurring payroll
curl -X POST "https://gateway.spraay.app/api/payroll/create" \
  -H "Content-Type: application/json" \
  -d '{
    "chain": "base",
    "token": "USDC",
    "schedule": "biweekly",
    "recipients": [
      {"address": "0xABC...", "amount": "2500", "label": "Dev 1"},
      {"address": "0xDEF...", "amount": "3000", "label": "Dev 2"}
    ]
  }'
```

## Integration Pattern

When Bankr needs to distribute funds after a trade:

```javascript
// After Bankr executes a trade...
const spraayBatch = {
  chain: "base",
  token: "USDC",
  recipients: tradeRecipients.map(r => ({
    address: r.wallet,
    amount: r.share
  }))
};

// POST to Spraay gateway
const response = await fetch("https://gateway.spraay.app/api/payments/batch", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(spraayBatch)
});
```

## Reference Documentation

See `references/` for detailed docs:
- `batch-payments.md` — Full batch payment API, CSV import, error handling
- `x402-gateway.md` — Complete endpoint catalog, authentication, pricing
- `bitcoin-psbt.md` — Bitcoin PSBT flow, fee estimation, wallet support
- `rtp-protocol.md` — Robot Task Protocol specification and endpoints

## Shell Script

See `scripts/spraay.sh` for a ready-to-use CLI with 15+ commands covering batch payments, Bitcoin PSBT, gateway calls, and RTP.

## Links

- Gateway: https://gateway.spraay.app
- Docs: https://docs.spraay.app
- GitHub: https://github.com/plagtech
- MCP Server: `@plagtech/spraay-x402-mcp` (Smithery)
- Payment Address: `0xAd62f03C7514bb8c51f1eA70C2b75C37404695c8`
