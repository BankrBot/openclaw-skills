---
name: buzz-bd
description: >
  Autonomous BD agent skill for SolCex Exchange — 8 services covering token discovery,
  100-point scoring, contract safety (RugCheck + QuillShield + DFlow), wallet forensics
  (Helius), 16-chain intel (Allium), social intelligence (Grok + ATV + Serper),
  BD pipeline lifecycle, and agent network interop (sub-agents, ACP, x402).
  Reference: Master Ops v5.3.8 | 36 cron jobs | 16 intelligence sources.
---

# Buzz BD — Autonomous Exchange Listing BD Agent v2.0.0

Full-stack business development agent for crypto exchange token listings. 8 services mapped to a 4-Layer Intelligence Architecture with 16 intelligence sources, running 24/7 on Akash Network.

> Reference: SolCex Master Ops v5.3.8 — 3-Provider Cascade + GHCR Pipeline
> npm: @buzzbd/plugin-solcex-bd@2.0.0
> Docker: ghcr.io/buzzbysolcex/buzz-bd-agent:v5.3.8

## 4-Layer Intelligence Architecture

### Layer 1 — Discovery
DexScreener (#1), AIXBT (#2), Clawpump (#8), CoinGecko (#17), DS Boosts (#18)

### Layer 2 — Filter
RugCheck (#4), Helius (#5), Allium 16-chain (#6), DFlow MCP (#16)

### Layer 3 — Research
Grok x_search (#13), ATV Web3 Identity (#12), Serper (#14), leak.me (#7), Firecrawl (#9)

### Layer 4 — Score & Act
100-point scoring engine + QuillShield safety overlay + DFlow route quality modifiers (+13/-8)

## 8 Services

1. **DexScreenerService** — Token discovery: profiles, pairs, boosts, trending
2. **TokenScoringService** — 100-point scoring with catalyst adjustments
3. **WalletForensicsService** — Helius-powered Solana wallet analysis
4. **ContractSafetyService** — RugCheck + QuillShield + DFlow swap route verification
5. **MultiChainIntelService** — Allium 16-chain deployer PnL and behavior tracking
6. **SocialIntelService** — Grok sentiment + ATV identity (ENS, Farcaster, Gitcoin) + Serper web research
7. **BDPipelineService** — Prospect tracking from discovery through listing, 3-touch warm-ups, follow-ups
8. **AgentNetworkService** — Sub-agent spawning, ACP protocol, x402 micropayments, trust verification

## 6 Actions

- **SCAN_TOKENS** — Discover and score token prospects from DexScreener
- **SCORE_TOKEN** — Deep 100-point scoring for a specific contract address
- **ANALYZE_WALLET** — Helius wallet forensics (Solana)
- **CHECK_CONTRACT_SAFETY** — RugCheck + QuillShield + DFlow safety analysis
- **RESEARCH_PROJECT** — Grok sentiment + ATV identity + Serper web research
- **CHECK_PIPELINE** — BD pipeline stats, hot prospects, follow-up queue

## Scoring System

| Metric | Points | Full Score |
|--------|--------|-----------|
| Liquidity | 30 | $500K+ |
| Volume (24h) | 25 | $1M+ |
| Age | 15 | 7-30 days |
| Community | 15 | Active socials |
| Contract Safety | 15 | Audited, no flags |

### DFlow Route Modifiers
- 3+ swap routes: +5 | Slippage <1%: +3 | Tier-1 DEXs: +3
- No routes: -5 | All routes >5% slippage: -3

### Score Thresholds
- 85-100: 🔥 HOT — Immediate outreach
- 70-84: ✅ QUALIFIED — Priority queue
- 50-69: 👀 WATCH — Monitor 48h
- 0-49: ❌ SKIP — No action

## Agent Identity

- **ERC-8004:** Ethereum #25045 | Base #17483
- **Wallets:** anet 0x2Dc0..05aA9 | ClawRouter 0x9b28..3A76
- **x402 micropayments:** $15/mo cap on Base
- **Akash Network:** Decentralized cloud deployment
- **LLM Cascade:** MiniMax M2.5 (primary) → Llama 70B (free) → Qwen 30B (free)

## Installation
```bash
# elizaOS plugin
bun add @buzzbd/plugin-solcex-bd

# OpenClaw skill
npx playbooks add skill buzzbysolcex/openclaw-skills --skill buzz-bd
```

## Configuration
```bash
# Required: none (DexScreener + RugCheck are free)
# Optional API keys for full capability:
HELIUS_API_KEY=       # Wallet forensics
ALLIUM_API_KEY=       # 16-chain deployer intel
GROK_API_KEY=         # X/Twitter sentiment
ATV_API_KEY=          # Web3 identity verification
SERPER_API_KEY=       # Web research
BANKR_API_KEY=        # Bankr trading integration
```

## Links

- **GitHub:** github.com/buzzbysolcex/plugin-solcex-bd
- **npm:** npmjs.com/package/@buzzbd/plugin-solcex-bd
- **Twitter:** @BuzzBySolCex
- **Exchange:** solcex.io
- **Telegram:** @Ogie2

Built by Ogie + Claude Opus 4.6 🐝
