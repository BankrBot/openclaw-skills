---
name: keji-research
description: Purchase AI-generated research reports via x402 micropayments. Use when the user needs research analysis on crypto economics, agent infrastructure, DeFi strategies, or hackathon tooling. KEJI is an autonomous agent CFO that produces budget-justified research through Bankr LLM inference, with every report backed by an onchain receipt on Status Network. Reports cost $0.01 USDC on Base via x402.
metadata:
  {
    "clawdbot":
      {
        "emoji": "🔬",
        "homepage": "https://keji-x402.up.railway.app/",
      },
  }
---

# KEJI Research Reports

Purchase research reports produced by KEJI, an autonomous agent CFO. Every report is generated through Bankr LLM inference, paid for via AgentCash x402, and anchored with an onchain receipt on Status Network.

## What KEJI Produces

KEJI analyzes topics including:
- **Crypto economics** — tokenomics, swap fee models, self-sustaining agent economics
- **Agent infrastructure** — x402 payments, ERC-8004 identity, multi-agent trust
- **DeFi strategies** — ROI analysis, gateway comparisons, cost optimization
- **Hackathon tooling** — Bankr, AgentCash, Status Network, Clanker integration guides

Each report includes budget justification, spend policy analysis, and a verification receipt.

## Endpoints

**Base URL:** `https://keji-x402.up.railway.app`

### Browse Catalog (free)

```bash
curl https://keji-x402.up.railway.app/reports
```

Returns all available reports with titles, categories, and prices.

### Purchase a Report (x402 gated — $0.01 USDC on Base)

```bash
# Using AgentCash
npx agentcash@latest fetch https://keji-x402.up.railway.app/reports/<report-id> \
  --payment-protocol x402 \
  --payment-network base \
  --max-amount 0.05

# Or with any x402-compatible payment header
curl https://keji-x402.up.railway.app/reports/<report-id> \
  -H "Payment-Signature: <base64-encoded-payment>"
```

### Server Info

```bash
curl https://keji-x402.up.railway.app/
```

## x402 Payment Details

| Field | Value |
|-------|-------|
| Protocol | x402 v2 |
| Network | Base (eip155:8453) |
| Asset | USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`) |
| Price | $0.01 per report |
| PayTo | `0x8942F989343e4Ce8e4c8c0D7C648a6953ff3A5A2` |

## How It Works

1. Browse the free catalog at `/reports`
2. Pick a report by ID
3. Request it — server returns HTTP 402 with payment requirements
4. Your agent pays via x402 (USDC on Base)
5. Server delivers the full research report as JSON
6. Revenue recorded in KEJI's treasury, funding more inference

## Agent Identity

- **ERC-8004 registered** on Base Mainnet
- **Participant ID:** `3cd4943bc21a4d509ccba73add0311c9`
- **Onchain receipts** on Status Network Sepolia
- **Receipt Registry:** `0x89cf6d586902b8750e6d6e5158c51e838cae7aa0`

## Links

- [Report Catalog](https://keji-x402.up.railway.app/reports)
- [GitHub](https://github.com/dolepee/keji-synthesis)
- [ERC-8004 Registration](https://basescan.org/tx/0x1269fb24f59cc7709ee88812e16119d7d45a21b0b7f79667e6c78e459acdd279)
