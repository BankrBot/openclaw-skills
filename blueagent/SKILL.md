---
name: blueagent
description: >
  AI founder console and agent infrastructure for Base builders.
  50 MCP tools across 6 categories: console commands (idea/build/audit/ship/raise),
  security, research, builder intelligence, premium analytics, multi-agent, and community.
  Available as remote MCP server (no install), @blueagent/skill npm package (local stdio),
  and native Claude Code plugin. x402 pay-per-call, A2A signal protocol, SOUL.md personality config.
  Triggers: "blue idea", "blue build", "blue audit", "blue ship", "blue raise",
  "token pick", "honeypot check", "market fit", "investor memo", "base grant",
  "builder score", "wallet pnl", "risk gate", "narrative pulse", "whale signal".
metadata:
  {
    "clawdbot":
      {
        "emoji": "🟦",
        "homepage": "https://blueagent.dev",
        "requires": { "bins": ["bankr"] },
      },
  }
---

# Blue Agent — AI Founder Console for Base

**50 MCP tools · Remote + local · x402 payments · A2A protocol · Claude Plugin**

Built by [Blocky Studio](https://blocky.studio) · [@blueagent_](https://x.com/blueagent_) · Base (chain ID 8453)

---

## Install

### Option 1 — Claude Code Plugin (recommended)

```bash
claude plugin marketplace add madebyshun/blue-agent
claude plugin install blue-agent
```

Includes persistent memory (`.blue-agent/memory.md`), sandbox isolation, and `/blue` command.

### Option 2 — Remote MCP (no install)

```json
{
  "mcpServers": {
    "blue-agent": {
      "url": "https://blueagent.dev/api/mcp"
    }
  }
}
```

```bash
# Claude Code CLI
claude mcp add blue-agent --transport http https://blueagent.dev/api/mcp
```

### Option 3 — Local stdio

```bash
npx -y @blueagent/skill
```

---

## MCP Tools (50 total)

### Console Commands — grounded in 34 Base skill files

| Tool | Description | Price |
|------|-------------|-------|
| `blue_idea` | Concept → fundable brief — problem, why now, why Base, MVP, risks | $0.05 |
| `blue_build` | Architecture, stack, folder structure, integrations, test plan | $0.50 |
| `blue_audit` | Security review — 500+ checks, 13 categories, go/no-go | $1.00 |
| `blue_ship` | Deployment checklist, verification steps, monitoring plan | $0.10 |
| `blue_raise` | Pitch narrative — market framing, why this wins, ask, investors | $0.20 |

### Security

| Tool | Description | Price |
|------|-------------|-------|
| `hub_honeypot` | Honeypot token detection | $0.01 |
| `hub_risk_gate` | Pre-transaction screen — rug check, AML, malicious patterns | $0.05 |
| `hub_contract_trust` | Smart contract trust score — code quality, upgrade risk, audit history | $0.05 |
| `hub_aml_screen` | AML screening — sanctions, mixer exposure, illicit flow patterns | $0.05 |
| `hub_allowance_audit` | Audit dangerous token approvals — find unlimited allowances | $0.20 |
| `hub_phishing_scan` | Scan URL or domain for phishing patterns | $0.05 |
| `hub_key_exposure` | Check if public key is exposed on-chain (quantum vulnerability) | $0.50 |

### Research & Market Intelligence

| Tool | Description | Price |
|------|-------------|-------|
| `hub_token_pick` | AI token pick — falsifiable thesis, entry, kill criterion | $0.20 |
| `hub_narrative` | Narrative map — mindshare, velocity, FRONT-RUN/RIDE/FADE/WATCH | $0.15 |
| `hub_narrative_pulse` | Real-time narrative pulse — Base CT velocity and sentiment | $0.15 |
| `hub_deep_analysis` | Token fundamentals — on-chain activity, holders, risk signals | $0.001 |
| `hub_whale_signal` | Whale copy-trade signals for a token | $0.005 |
| `hub_whale_tracker` | Smart money flow analysis across Base in real time | $0.10 |
| `hub_token_momentum` | Token momentum scanner — price velocity, volume spikes | $0.10 |
| `hub_community_sentiment` | Community sentiment — CT mindshare, Farcaster buzz, Telegram | $0.10 |
| `hub_ecosystem` | Daily Base ecosystem digest — launches, protocols, builders | $0.20 |

### Builder Intelligence

| Tool | Description | Price |
|------|-------------|-------|
| `hub_builder_score` | Builder Score for X handle — on-chain activity, shipping (0-100) | $0.001 |
| `hub_agent_score` | Agent Score for AI agents on Base — XP, interactions, uptime | $0.01 |
| `hub_builder_dd` | Deep due diligence on a builder — onchain history, shipped projects | $0.20 |
| `hub_brand_score` | Brand score for a Base project — visibility, narrative alignment | $0.10 |
| `hub_repo_health` | GitHub repo health — velocity, coverage, dependency risk | $0.005 |
| `hub_market_fit` | Market fit analysis — problem clarity, timing, competition | $0.25 |
| `hub_competitor_scan` | Competitor analysis + defensible edge | $0.20 |
| `hub_roadmap` | Validate product roadmap — feasibility, sequencing, timing | $0.20 |
| `hub_gtm` | Go-to-market brief — channels, launch sequence, community strategy | $0.20 |
| `hub_launch_simulator` | Simulate token/product launch — price action, liquidity scenarios | $0.25 |
| `hub_token_launch` | Token launch readiness score (0-100) + GO/WAIT verdict | $0.50 |
| `hub_base_grant` | Active grants and funding for Base projects | $0.01 |

### Fundraising

| Tool | Description | Price |
|------|-------------|-------|
| `hub_investor_memo` | Full investor memo — thesis, market, moat, risks, ask | $0.35 |
| `hub_pitch_intel` | Pitch intelligence — investor-lens feedback on your narrative | $0.25 |
| `hub_fundraise_timing` | Is now the right time to raise? Market + stage readiness | $0.20 |

### Premium Analytics

| Tool | Description | Price |
|------|-------------|-------|
| `hub_wallet_pnl` | Wallet PnL report — realized/unrealized gains, win rate | $1.00 |
| `hub_wallet_strategy` | Analyze wallet trading strategy — pattern recognition, alpha sources | $0.50 |
| `hub_portfolio` | Portfolio rebalancer — optimal Base DeFi allocation by risk | $0.15 |
| `hub_defi_opportunity` | Best DeFi yield on Base — APY rankings, risk-adjusted returns | $0.15 |
| `hub_protocol_risk` | Real-time risk monitor — TVL changes, exploit signals, governance | $0.20 |

### Multi-Agent

| Tool | Description | Price |
|------|-------------|-------|
| `hub_multi_agent` | Orchestrate tasks across Blue Agent + Aeon + MiroShark | $0.30 |
| `hub_agent_match` | Find best collaborator agent for a task | $0.10 |
| `hub_agent_perf` | Agent performance analytics — quality, success rate, satisfaction | $0.10 |
| `hub_agent_revenue` | Revenue optimizer — pricing strategy, x402 fee recommendations | $0.20 |
| `hub_agent_token` | Token strategy for an AI agent — should you launch, how, when | $0.20 |

### Community

| Tool | Description | Price |
|------|-------------|-------|
| `hub_community_growth` | Community growth playbook — channels, content, retention loops | $0.20 |
| `hub_thread_intel` | Thread intelligence — signal vs noise, key takes, actionable insights | $0.15 |

### Utility

| Tool | Description |
|------|-------------|
| `blue_score` | Builder Score for GitHub/Farcaster handle or wallet (0-100) |
| `blue_new` | Scaffold Base project: `base-agent` \| `base-x402` \| `base-token` |

---

## REST API (43 endpoints)

**Base URL:** `https://blueagent.dev/api/v1/`
**Auth:** x402 — USDC on Base per call, no subscription

```bash
# Example
curl -X POST https://blueagent.dev/api/v1/builder-score \
  -H "Content-Type: application/json" \
  -H "X-Payment: <x402-token>" \
  -d '{"handle":"madebyshun"}'

# Tool catalog
GET https://blueagent.dev/api/v1/_catalog
```

Full docs: https://blueagent.dev/api-docs

---

## A2A Signal Protocol

Other agents can send signals to Blue Agent:

```bash
POST https://blueagent.dev/api/signal
{
  "id": "sig_001",
  "source": "aeon",
  "type": "opportunity",
  "data": { "subject": "...", "context": "..." },
  "confidence": 0.85,
  "timestamp": "2026-05-23T00:00:00Z"
}
```

Blue Agent scores the signal (confidence + source trust + priority + chain boost), decides action, stores in KV.

Discovery: `GET https://blueagent.dev/api/health`
Agent identity: `https://blueagent.dev/.well-known/agent.json`

---

## SOUL.md — Forkable Agent Personality

Blue Agent's identity, values, tone, decision rules, and hard limits are version-controlled in `SOUL.md`.

```
Fork → edit → load into any Bankr-compatible agent session.
```

View + fork: https://blueagent.dev/skills
Raw: https://raw.githubusercontent.com/madebyshun/blue-agent/main/SOUL.md

---

## npm Packages

```bash
npm install -g @blueagent/skill    # MCP server — 50 tools (local stdio) v0.3.0
npm install -g @blueagent/cli      # TUI + blue CLI
npm install @blueagent/sdk         # Unified SDK
npm install @blueagent/core        # Runtime + skill registry
npm install @blueagent/agentkit    # Coinbase AgentKit plugin
npm install @blueagent/x402-guard  # x402 security middleware
```

---

## Resources

- **Web:** https://blueagent.dev
- **API Docs:** https://blueagent.dev/api-docs
- **Skills:** https://blueagent.dev/skills
- **GitHub:** https://github.com/madebyshun/blue-agent
- **Token:** $BLUEAGENT on Base (Uniswap v4)
- **Community:** https://t.me/blueagent_hub
- **X:** https://x.com/blueagent_
