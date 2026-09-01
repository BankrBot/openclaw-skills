# Buzz BD Agent — 5-Layer Intelligence Pipeline

## Layer 1: Discovery

Discovery sources scan decentralized exchanges for new and trending tokens.

### DexScreener API

Primary discovery source. Free tier covers all needs.

**Endpoints used:**
- `/token-boosts/latest/v1` — Recently boosted token profiles
- `/token-boosts/top/v1` — Most boosted tokens (trending)
- `/token-profiles/latest/v1` — New token profiles with metadata
- `/latest/dex/pairs/{chainId}/{pairAddress}` — Pair details

**Chains monitored:** Solana, Base, Ethereum, BSC

### GeckoTerminal

Secondary discovery for pre-DEX and alt-chain tokens.

**Use cases:**
- Tokens not yet indexed on DexScreener
- Better pair data for newly migrated PumpFun tokens
- Cross-chain coverage beyond Solana/Base

### AIXBT Momentum

AI-powered momentum signals from aixbt.tech.

**Integration:**
- Pull trending projects and conviction scores
- High conviction picks get +10 bonus in scoring
- Signals refresh every 6 hours

## Layer 2: Filter

Safety validation before spending research resources.

### RugCheck (Solana)

Primary safety validator for Solana tokens.

**Checks performed:**
- Mint authority status (must be revoked)
- Freeze authority status (must be revoked)
- LP lock/burn verification
- Top holder concentration
- Metadata mutability

**Scoring interpretation:**
- RugCheck score < 500 → Generally safe
- RugCheck score 500-1000 → Caution needed
- RugCheck score > 1000 → High risk

### Helius RPC (Solana)

Wallet forensics for Solana deployer addresses.

**Capabilities:**
- Transaction history analysis
- Wallet age and activity patterns
- Token creation history (rug detection)
- Funding source tracking

### Allium (EVM)

Cross-chain deployer analysis.

**Provides:**
- Deployer wallet history across EVM chains
- Contract deployment patterns
- Cross-chain activity mapping

## Layer 3: Research

Deep intelligence gathering on filtered prospects.

### ATV Web3 Identity

ENS name resolution + social profile discovery.

**API:** `https://api.web3identity.com/api/ens/batch-resolve`

**Returns:**
- ENS name (e.g., `vitalik.eth`)
- Twitter handle
- GitHub username
- Discord identity

**Scoring impact:**
- ENS + social profiles → +5 points (VERIFIED-IDENTITY)
- ENS only → +3 points (ENS-HOLDER)
- No identity → -10 points (COMMUNITY flag)

**Limits:** 100 addresses/day free tier

### Firecrawl

Website scraping and validation.

**Use cases:**
- Verify project website exists and is functional
- Extract team information
- Check for whitepaper/docs presence

### Grok x_search

Real-time Twitter/X sentiment analysis.

**Provides:**
- Recent mentions and engagement metrics
- KOL (Key Opinion Leader) endorsements
- Community sentiment scoring

## Layer 4: Scoring

100-point weighted scoring system with 11 factors.

See SKILL.md for the full scoring breakdown.

**Key rules:**
- Base score: 50
- Instant kill conditions override all positive signals
- Score ≥ 85: Immediate action
- Score ≥ 70: Priority queue
- Score ≥ 50: Watch list
- Score < 50: Skip

## Layer 5: Smart Money

Premium intelligence layer. Only triggers when Layer 4 score ≥ 65.

### Nansen x402

Whale wallet tracking via x402 micropayment protocol.

**Provides:**
- Whale accumulation/distribution signals
- Smart money wallet identification
- Token flow analysis

**Cost:** ~$0.10 per query via x402 micropayment

**Scoring impact:**
- Smart money score ≥ 7 → +10 points
- Smart money score 4-6 → +5 points
