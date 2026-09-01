---
name: buzzbd
description: Token intelligence and CEX listing BD agent for SolCex Exchange. Score tokens on a 100-point system, get listing recommendations, and initiate business development outreach.
version: 1.0.0
author: SolCex Exchange
website: https://github.com/buzzbysolcex/buzz-bd-agent
tags: [business-development, token-scoring, cex-listing, intelligence, solana, defi]
metadata:
  openclaw:
    install:
      - curl
---

# BuzzBD — Token Intelligence & CEX Listing Skill

> Score any token. Get listing intelligence. Connect to SolCex Exchange BD pipeline.

## What This Skill Does

BuzzBD gives any agent access to SolCex Exchange's business development intelligence:

1. **Token Scoring** — 100-point scoring system across 6 weighted factors
2. **Listing Qualification** — Instant assessment of CEX listing readiness
3. **Market Intelligence** — Cross-referenced data from DexScreener, AIXBT, and KOL tracking
4. **BD Pipeline Entry** — Qualified tokens get routed to SolCex listing pipeline

## Setup

No API key required for basic scoring. The skill uses public data sources.

```bash
mkdir -p ~/.clawdbot/skills/buzzbd
```

Optional: Configure for pipeline submission (requires SolCex BD contact):

```bash
cat > ~/.clawdbot/skills/buzzbd/config.json << 'EOF'
{
  "contact": "buzzbysolcex@gmail.com",
  "pipeline": true,
  "chains": ["solana", "ethereum", "bsc"]
}
EOF
```

## Quick Start

### Score a Token

Ask your agent:

```
Score this token for CEX listing potential: [CONTRACT_ADDRESS] on [CHAIN]
```

Example:
```
Score this token for CEX listing potential: 7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr on Solana
```

### Check Listing Qualification

```
Is this token qualified for SolCex listing? [CONTRACT_ADDRESS]
```

### Get Full Intelligence Report

```
Generate a BuzzBD intelligence report for [TOKEN_NAME] at [CONTRACT_ADDRESS]
```

## Scoring System (100 Points)

| Factor | Weight | Excellent | Good | Minimum |
|--------|--------|-----------|------|---------|
| Market Cap | 20% | >$10M | $1M-$10M | $500K |
| Liquidity | 25% | >$500K | $200K-$500K | $100K |
| 24h Volume | 20% | >$1M | $500K-$1M | $100K |
| Social Metrics | 15% | All platforms active | 2+ platforms | 1 platform |
| Token Age | 10% | Established | Moderate | New |
| Team Transparency | 10% | Doxxed, active | Partial | Anonymous |

### Catalyst Adjustments

**Positive bonuses (+3 to +10):**
- Hackathon win (+10)
- Mainnet launch (+10)
- Major partnership (+10)
- Audit completed (+8)
- Multi-source cross-match (+5) → `[HIGH CONVICTION]`
- KOL accumulation signal (+5)

**Negative penalties (-5 to -15):**
- Exploit history (-15)
- Rugpull association (-15)
- Team controversy (-10)
- Already on major CEXs (-5)

### Score Actions

| Score | Category | What It Means |
|-------|----------|---------------|
| 85-100 | 🔥 HOT | Strong CEX listing candidate — immediate BD outreach |
| 70-84 | ✅ Qualified | Meets SolCex listing criteria — priority queue |
| 50-69 | 👀 Watch | Monitor for improvement — check back in 48h |
| 0-49 | ❌ Skip | Does not meet minimum listing criteria |

## Supported Chains

| Chain | Listing Fee | Priority |
|-------|-------------|----------|
| Solana | $5,000 USDC | Primary |
| Ethereum | $7,500 USDC | Cross-chain premium |
| BSC | $7,500 USDC | Cross-chain premium |

## Intelligence Sources

The scoring engine cross-references multiple sources:

| Source | Data | Cost |
|--------|------|------|
| DexScreener | Prices, liquidity, pairs, holders | Free |
| AIXBT | Momentum scores, trending tokens, catalysts | Free |
| leak.me | KOL follows, smart money tracking | Free |
| Einstein AI | Whale alerts, large wallet movements | $0.10/call (x402) |
| Gloria AI | Breaking news, sentiment shifts | $0.10/call (x402) |

## Report Format

When you request a full intelligence report, BuzzBD returns:

```
🐝 BUZZBD INTELLIGENCE REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Token: [NAME] ([SYMBOL])
Chain: [CHAIN]
Contract: [ADDRESS]
Score: [XX]/100 — [CATEGORY]

📊 BASE METRICS
Market Cap: $[X]
Liquidity: $[X]
24h Volume: $[X]
Holders: [X]
Token Age: [X] days

📡 INTELLIGENCE SIGNALS
DexScreener: [status]
AIXBT Momentum: [score]
KOL Activity: [signals]

🎯 LISTING ASSESSMENT
Qualification: [QUALIFIED / NOT QUALIFIED]
Listing Fee: $[X] USDC
Key Strengths: [list]
Key Risks: [list]

📋 RECOMMENDATION
[Action recommendation]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Using the Script

```bash
# Ensure script is executable
chmod +x ~/.clawdbot/skills/buzzbd/scripts/buzzbd.sh

# Score a token
scripts/buzzbd.sh score <contract_address> <chain>

# Quick qualification check
scripts/buzzbd.sh qualify <contract_address> <chain>

# Full report
scripts/buzzbd.sh report <contract_address> <chain>

# List supported chains
scripts/buzzbd.sh chains
```

## Integration with Bankr

BuzzBD works alongside the Bankr skill. Typical workflow:

1. **Bankr** launches a token on Solana via Raydium
2. **BuzzBD** scores the launched token for CEX listing potential
3. If qualified (70+), BuzzBD routes to SolCex BD pipeline
4. Project gets professional CEX listing outreach

```
# Example combined workflow
"Launch my token on Solana using Bankr, then score it with BuzzBD for CEX listing"
```

## About Buzz BD Agent

Buzz is an autonomous AI business development agent running 24/7 on Akash Network for SolCex Exchange. It discovers, scores, and initiates outreach to token projects for centralized exchange listings.

- **Live stream:** [retake.tv/BuzzBD](https://retake.tv/BuzzBD)
- **GitHub:** [buzzbysolcex/buzz-bd-agent](https://github.com/buzzbysolcex/buzz-bd-agent)
- **Twitter:** [@BuzzBySolCex](https://x.com/BuzzBySolCex)
- **Email:** buzzbysolcex@gmail.com
- **Payments:** x402 protocol (USDC on Solana)
- **Agent Verified:** [ClawdIn](https://clawdin.com)

## Troubleshooting

**Token not found:** Verify the contract address is correct and the token exists on DexScreener. Use the full contract address, not the token name.

**Chain not supported:** BuzzBD currently supports Solana, Ethereum, and BSC. Other chains are logged for reference but excluded from scoring.

**Score seems low:** The scoring system is conservative by design. CEX listings carry reputational risk, so the bar is intentionally high. Tokens scoring 50-69 should be monitored for improvement.

---

💡 **Pro Tip:** Always provide the contract address, not just the token name. Many tokens share similar names — the contract address is the only reliable identifier.

⚠️ **Disclaimer:** BuzzBD scoring is for informational purposes. A high score indicates listing potential but does not guarantee a SolCex listing. All listings require human approval and due diligence by the SolCex team.
