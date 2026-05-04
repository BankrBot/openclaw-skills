---
name: blueagent-x402
description: >
  Security OS for autonomous agents and builders on Base.
  31 pay-per-use tools across Quantum Security, Agent Safety, Research, Data, and Earn.
  Built for AI agents, Zero-Human Companies (ZHC), and Base ecosystem builders.
  Pay USDC per call via x402 protocol — no subscription, no API key needed.
metadata:
  {
    "clawdbot":
      {
        "emoji": "🟦",
        "homepage": "https://github.com/madebyshun/blueagent-x402-services",
        "requires": { "bins": ["bankr"] },
      },
  }
---

# BlueAgent x402 — Security OS for Autonomous Agents

**31 pay-per-use AI tools on Base** — Quantum Security · Agent Safety · Research · Data · Earn

**Base URL:** `https://x402.bankr.bot/0xf31f59e7b8b58555f7871f71973a394c8f1bffe5/`

---

## QUANTUM SECURITY

| Service | Price | Description |
|---------|-------|-------------|
| `quantum-premium` | $1.50 | Wallet quantum vulnerability score — public key exposure, threat timeline, migration steps |
| `quantum-batch` | up to $2.50 | Scan 1–10 wallets at $0.25 each — pay only for what you scan |
| `quantum-migrate` | $2.00 | Step-by-step quantum-safe migration plan with tools and timeline |
| `quantum-timeline` | $0.40 | Evidence-based quantum threat timeline — when CRQC arrives and what it means |
| `key-exposure` | $0.50 | Check if wallet's public key is exposed on-chain — the #1 quantum risk factor |

---

## AGENT SAFETY

| Service | Price | Description |
|---------|-------|-------------|
| `risk-gate` | $0.05 | Pre-transaction safety check — APPROVE / WARN / BLOCK with risk score |
| `honeypot-check` | $0.05 | Detect honeypot or rug pull contracts before buying |
| `allowance-audit` | $0.20 | Audit dangerous token approvals — find unlimited allowances to revoke |
| `phishing-scan` | $0.10 | Scan URL, address, or @handle for phishing and scam indicators |
| `mev-shield` | $0.30 | MEV sandwich attack risk before large swaps — protection strategies |
| `contract-trust` | $0.25 | Trust score for any contract — verified, audited, safe for agent interaction? |
| `aml-screen` | $0.25 | AML compliance screening — transaction patterns, risk flags |
| `circuit-breaker` | $0.50 | CONTINUE / PAUSE / HALT decision for autonomous agents and ZHC |

---

## RESEARCH

| Service | Price | Description |
|---------|-------|-------------|
| `deep-analysis` | $0.35 | Deep due diligence for any Base token or project — risk score, rug probability |
| `tokenomics-score` | $0.50 | Supply, inflation, unlock cliff analysis — sustainability score, sell pressure |
| `whitepaper-tldr` | $0.20 | Summarize any whitepaper into 5 key bullets — thesis, moat, risks |
| `narrative-pulse` | $0.40 | Trending crypto narratives — momentum scores, Base ecosystem themes |
| `vc-tracker` | $1.00 | VC investment activity — hot sectors, thesis, signals for builders and traders |
| `launch-advisor` | $3.00 | Full token launch playbook — tokenomics, 8-week timeline, marketing, KPIs |
| `grant-evaluator` | $5.00 | Base ecosystem grant scoring — innovation, feasibility, impact, team quality |
| `x402-readiness` | $1.00 | Audit any API for x402 payment protocol readiness — gaps, steps, pricing |
| `base-deploy-check` | $0.50 | Pre-deployment security check — vulnerabilities, centralization risks, go/no-go |

---

## DATA & ALERTS

| Service | Price | Description |
|---------|-------|-------------|
| `wallet-pnl` | $1.00 | Wallet PnL report — win rate, trading style, smart money score |
| `whale-tracker` | $0.10 | Smart money flow analysis — accumulation vs distribution signal |
| `dex-flow` | $0.15 | DEX buy/sell pressure and volume flow — live DexScreener data |
| `airdrop-check` | $0.10 | Base airdrop eligibility — which protocols, activity score, estimated value |
| `alert-check` | $0.10 | Check active alert triggers for any address |

---

## EARN

| Service | Price | Description |
|---------|-------|-------------|
| `yield-optimizer` | $0.15 | Best APY on Base DeFi — live DeFiLlama data, risk-adjusted recommendations |
| `lp-analyzer` | $0.25 | LP position analysis — impermanent loss, fee income, rebalance recommendation |
| `tax-report` | $2.00 | On-chain tax summary — realized gains, taxable events, P&L |
| `alert-subscribe` | $0.50 | Subscribe to real-time alerts via webhook — whale, circuit breaker, quantum |

---

## Quick Start

### CLI
```bash
npm install -g @blueagent/cli
blueagent setup
blueagent honeypot-check 0xTOKEN
blueagent risk-gate "approve USDC to Uniswap"
blueagent analyze "$BRETT"
```

### SDK
```typescript
import { BlueAgent } from '@blueagent/sdk'

const ba = new BlueAgent({ privateKey: process.env.WALLET_PRIVATE_KEY })
await ba.security.riskcheck({ action: 'swap 100 USDC' })
await ba.research.analyze({ projectName: '$BRETT' })
await ba.earn.yieldOptimizer({ token: 'USDC' })
```

### MCP (Claude Code / AgentKit)
```bash
npx @blueagent/skill install --claude
```

### ZHC Circuit Breaker
```typescript
const status = await ba.security.circuitBreaker({
  agentId: 'my-zhc',
  context: 'consecutive losses detected',
  recentLosses: '$340'
})
// { decision: "PAUSE", cooldownPeriod: "30 minutes", requiresHumanReview: false }
```

---

## Resources

- **GitHub:** https://github.com/madebyshun/blueagent-x402-services
- **Token:** $BLUEAGENT on Base
- **Community:** https://t.me/blueagent_hub
- **Skills:** https://skills.bankr.bot
