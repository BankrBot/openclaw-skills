---
name: buzz-bd-agent
description: >
  Autonomous token business development agent for CEX listing acquisition. 
  Use when building an AI agent that discovers promising tokens, scores them 
  with a multi-factor pipeline, verifies deployer identity, and generates 
  outreach for centralized exchange listings. Integrates DexScreener, 
  RugCheck, ENS identity verification, and smart money tracking across 
  Solana and EVM chains. Designed for agents running on OpenClaw/Akash 
  with Bankr wallet infrastructure.
metadata:
  clawdbot:
    emoji: "🐝"
    homepage: "https://solcex.cc"
    requires:
      bins: ["node", "curl"]
---

# Buzz BD Agent

Autonomous token business development pipeline for CEX listing acquisition. Discover → Filter → Research → Score → Outreach.

Built by [SolCex Exchange](https://solcex.cc) | ERC-8004: ETH #25045, Base #17483

## Overview

Buzz BD Agent is a 5-layer intelligence pipeline that runs 24/7, scanning decentralized exchanges for listing-ready tokens. It automates the entire BD workflow that traditionally requires a human team: token discovery, safety verification, deployer identity checks, scoring, and outreach generation.

Designed for autonomous agents on OpenClaw with Bankr wallet integration for on-chain operations.

## Architecture

```
Layer 1: DISCOVERY
  DexScreener API → new tokens, boosted profiles, trending pairs
  GeckoTerminal  → pre-DEX tokens, alt-chain coverage
  AIXBT          → AI momentum signals, high-conviction picks

Layer 2: FILTER
  RugCheck       → mint authority, freeze authority, LP status
  Helius RPC     → Solana deployer wallet forensics
  Allium         → cross-chain deployer history

Layer 3: RESEARCH
  ATV (Web3 Identity) → ENS names, social profiles, deployer reputation
  Firecrawl      → project website scraping + validation
  Grok x_search  → real-time Twitter/X sentiment

Layer 4: SCORING (100-point system)
  11 weighted factors including:
  - Market cap, liquidity, volume thresholds
  - Safety checks (mint revoked, LP burned/locked)
  - Identity verification (ENS + socials)
  - Community signals (Twitter, Telegram, KOL mentions)

Layer 5: SMART MONEY (triggers at score ≥ 65)
  Nansen x402    → whale wallet tracking + accumulation signals
```

## Quick Start

### Prerequisites

- OpenClaw runtime (v2026.2.x+)
- Node.js 22+
- Bankr API key (`bk_...`) for wallet operations
- DexScreener API access (free tier)
- RugCheck API access (free tier)

### Install

```bash
# Add the skill to your OpenClaw agent
> install the buzz-bd-agent skill from https://github.com/BankrBot/skills/tree/main/buzz-bd-agent
```

### Configuration

Set these environment variables or add to your OpenClaw config:

```bash
# Required
export DEXSCREENER_API=https://api.dexscreener.com
export RUGCHECK_API=https://api.rugcheck.xyz

# Optional (enhances pipeline depth)
export ATV_API=https://api.web3identity.com        # ENS identity
export HELIUS_API_KEY=your_helius_key               # Solana wallet forensics
export FIRECRAWL_API_KEY=your_firecrawl_key         # Website scraping
export BANKR_API_KEY=bk_your_key                    # Bankr wallet ops
```

## Scoring Engine

### 100-Point Breakdown

Base score: 50 points. Signals add or subtract from there.

**Positive Signals:**

| Signal | Points |
|--------|--------|
| Market cap > $1M | +15 |
| Market cap $500K-$1M | +10 |
| Liquidity > $50K | +10 |
| 24h Volume > $10K | +15 |
| Website exists | +5 |
| Twitter active | +5 |
| Telegram group | +3 |
| Mint authority revoked | +5 |
| LP burned | +5 |
| Identity verified (ENS + socials) | +5 |
| Smart Money score ≥ 7 | +10 |
| AIXBT high conviction | +10 |

**Negative Signals:**

| Flag | Points |
|------|--------|
| No identity (COMMUNITY token) | -10 |
| Freeze authority active | -15 |
| Top 10 holders > 50% | -15 |
| LP unverified | -15 |
| Token age < 24h | -10 |

### Score Thresholds

| Score | Action |
|-------|--------|
| 85-100 🔥 HOT | Immediate report + outreach draft |
| 70-84 ✅ QUALIFIED | Priority queue + deep research |
| 50-69 👀 WATCH | Monitor 48h, rescan |
| 0-49 ❌ SKIP | No action |

### Instant Kill Rules (Score → 0)

- Mint authority NOT revoked
- LP not locked AND not burned
- Deployer funded from known mixer
- Deployer has 3+ previous rugs
- Already listed on Tier 1/2 CEX

## Pipeline Workflow

### 1. Discovery Scan

```bash
# Trigger a scan cycle (runs automatically on cron)
curl -s "https://api.dexscreener.com/token-boosts/latest/v1" | \
  node -e "
    const data = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    const fresh = data.filter(t => t.chainId === 'solana' || t.chainId === 'base');
    console.log(JSON.stringify(fresh.slice(0, 20), null, 2));
  "
```

### 2. Safety Filter

```bash
# RugCheck verification (Solana)
curl -s "https://api.rugcheck.xyz/v1/tokens/{mint}/report/summary" | \
  node -e "
    const r = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    const safe = r.score < 500 && !r.risks.some(x => x.name === 'Mutable Metadata');
    console.log(safe ? 'PASS' : 'FAIL', '— Score:', r.score);
  "
```

### 3. Identity Verification (ATV)

```bash
# Batch resolve deployer ENS + socials
curl -s "https://api.web3identity.com/api/ens/batch-resolve?\
addresses=0x1234...&include=name,twitter,github,discord"
```

Returns identity data used for scoring:
- ENS + social profiles → +5 points
- ENS only → +3 points
- No identity → -10 points (COMMUNITY flag)

### 4. Outreach Generation

For tokens scoring ≥ 70, Buzz generates listing outreach:

```
Subject: CEX Listing Opportunity — {TOKEN} on {CHAIN}

Hi {DEPLOYER/TEAM},

We've been tracking {TOKEN} and its metrics look strong:
- Market Cap: ${MC}
- 24h Volume: ${VOL}
- Liquidity: ${LIQ}
- Safety: All checks passed ✅

SolCex Exchange offers professional market making with 
$450K+ depth and 0.15% tight spreads.

Would you be open to discussing a listing?
```

## Cron Schedule

Recommended autonomous schedule (WIB timezone):

| Time | Job | Description |
|------|-----|-------------|
| 05:00 | Deep Scan | Morning discovery + full pipeline |
| 09:00 | ATV Batch | Verify deployers from morning scan |
| 12:00 | Midday Scan | Refresh pipeline + trending tokens |
| 15:00 | ATV Batch | Verify deployers from midday scan |
| 18:30 | Evening Scan | Pre-close discovery cycle |
| 21:00 | Night Scan | Asian market coverage |
| 22:00 | ATV Batch | Verify deployers from evening+night |
| 23:00 | Daily Digest | Pipeline summary + metrics |

## Bankr Integration

Buzz uses Bankr for on-chain wallet operations:

```bash
# Check agent wallet balance
bankr prompt "What is my Base wallet balance?"

# Monitor token holdings
bankr prompt "Show positions for wallet 0x2Dc0...05aA9 on Base"
```

The Bankr LLM Gateway also provides fallback inference:
- Primary: MiniMax M2.5 (via anthropic-messages API)
- Fallback: Bankr LLM Gateway (8 models, self-sustaining credits)

## Deployment

### Akash Network (Recommended)

Buzz runs on decentralized cloud via Akash Network at ~$5-8/month:

```yaml
# Akash SDL snippet
services:
  buzz:
    image: ghcr.io/buzzbysolcex/buzz-bd-agent:latest
    expose:
      - port: 18789
        as: 18789
        to:
          - global: true
profiles:
  compute:
    buzz:
      resources:
        cpu:
          units: 2
        memory:
          size: 4Gi
        storage:
          - size: 10Gi
            attributes:
              persistent: true
              class: beta3
```

### Docker (Local)

```bash
docker pull ghcr.io/buzzbysolcex/buzz-bd-agent:latest
docker run -d \
  -e BANKR_API_KEY=bk_your_key \
  -e DEXSCREENER_API=https://api.dexscreener.com \
  -v buzz-data:/data \
  -p 18789:18789 \
  ghcr.io/buzzbysolcex/buzz-bd-agent:latest
```

## ERC-8004 Registration

Buzz is registered as a verifiable on-chain agent:

| Chain | Token ID | Registry |
|-------|----------|----------|
| Ethereum | #25045 | ERC-8004 |
| Base | #17483 | ERC-8004 |
| Base (anet) | #18709 | anet |

Verify: `https://8004.org/agent/25045`

## Resources

- **SolCex Exchange**: https://solcex.cc
- **Buzz on Twitter**: @BuzzBySolCex
- **Telegram**: @Ogie2
- **ERC-8004 Registry**: https://8004.org
- **Akash Network**: https://akash.network
- **DexScreener API**: https://docs.dexscreener.com
- **RugCheck API**: https://docs.rugcheck.xyz

## Troubleshooting

### No tokens found in scan
Verify DexScreener API is reachable: `curl -I https://api.dexscreener.com`

### ATV batch returns 0 results
Most Solana tokens don't have ETH deployer addresses. ATV only resolves EVM addresses. Solana deployers use Helius (Source #6).

### Score seems too low
Check if RugCheck flagged freeze authority or unverified LP. These carry -15 point penalties. Review the full scoring breakdown in the pipeline output.

### Bankr wallet not responding
Verify API key: `bankr whoami`. Check credit balance: `bankr prompt "What is my balance?"`
