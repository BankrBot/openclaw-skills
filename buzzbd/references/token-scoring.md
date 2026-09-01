# Token Scoring Methodology

## Overview

BuzzBD's 100-point scoring system evaluates tokens across 6 weighted factors with catalyst adjustments. The system is designed to identify tokens with genuine CEX listing potential while filtering out high-risk or low-quality projects.

## Base Scoring (100 points)

### Market Cap (20 points)

| Range | Points | Rationale |
|-------|--------|-----------|
| >$10M | 20 | Established project with proven market interest |
| $5M-$10M | 16 | Strong mid-cap with growth potential |
| $1M-$10M | 12 | Meets minimum CEX threshold |
| $500K-$1M | 8 | Borderline — monitor for growth |
| <$500K | 4 | Too early for CEX listing |

### Liquidity (25 points)

Liquidity is weighted highest because it directly impacts listing viability. CEXs need sufficient DEX liquidity for price discovery and arbitrage.

| Range | Points | Rationale |
|-------|--------|-----------|
| >$500K | 25 | Excellent — supports CEX trading pairs |
| $200K-$500K | 20 | Good — adequate for initial listing |
| $100K-$200K | 15 | Minimum viable for small CEX |
| $50K-$100K | 8 | Below threshold — high risk |
| <$50K | 3 | Insufficient for CEX listing |

**Hard minimum:** $100K liquidity required for pipeline inclusion.

### 24h Volume (20 points)

| Range | Points | Rationale |
|-------|--------|-----------|
| >$1M | 20 | High demand — active trading |
| $500K-$1M | 16 | Strong volume for listing size |
| $100K-$500K | 12 | Adequate activity |
| $50K-$100K | 6 | Low but present |
| <$50K | 2 | Insufficient market interest |

### Social Metrics (15 points)

| Presence | Points | Criteria |
|----------|--------|----------|
| All platforms | 15 | Twitter + Telegram + Discord + Website active |
| 2+ platforms | 10 | At least two active community channels |
| 1 platform | 5 | Single channel presence |
| None | 0 | No community = no listing |

### Token Age (10 points)

| Age | Points | Rationale |
|-----|--------|-----------|
| >90 days | 10 | Survived initial volatility |
| 30-90 days | 7 | Building track record |
| 7-30 days | 4 | New but established |
| <7 days | 2 | Too new — wait and monitor |

### Team Transparency (10 points)

| Level | Points | Criteria |
|-------|--------|---------|
| Doxxed + active | 10 | Team publicly known, regular updates |
| Partially doxxed | 7 | Some team members known |
| Anonymous + active | 4 | Anonymous but responsive |
| Anonymous + silent | 1 | High risk |

## Catalyst Adjustments

Catalysts modify the base score based on real-world events and signals.

### Positive Catalysts

| Catalyst | Bonus | Detection Source |
|----------|-------|-----------------|
| Hackathon win | +10 | Manual / news |
| Mainnet launch | +10 | DexScreener / Twitter |
| Major partnership | +10 | News / social |
| CEX listing elsewhere | +8 | CoinGecko / CMC |
| Audit completed | +8 | Audit reports |
| AIXBT + DexScreener cross-match | +5 | Multi-source |
| x402 whale alert confirmed | +5 | Einstein AI |
| KOL accumulation signal | +5 | leak.me |
| Bullish KOL sentiment | +3 | leak.me |

### Negative Catalysts

| Catalyst | Penalty | Detection Source |
|----------|---------|-----------------|
| Delisting risk | -15 | News / social |
| Exploit history | -15 | Security reports |
| Rugpull association | -15 | Community reports |
| Team controversy | -10 | Social / news |
| Smart contract vulnerability | -10 | Audit / reports |
| KOL risk flag | -10 | leak.me |
| Already on major CEXs | -5 | CoinGecko |

## Score Interpretation

| Range | Tag | Recommended Action |
|-------|-----|-------------------|
| 85-100 | 🔥 HOT | Immediate outreach — top priority |
| 70-84 | ✅ Qualified | Add to pipeline — standard outreach |
| 50-69 | 👀 Watch | Monitor for 48h — may improve |
| 0-49 | ❌ Skip | Do not pursue |

## Cross-Reference Rules

1. **Multi-source confirmation required** — No token qualifies on a single data source
2. **Contract address verification** — Always verify by address, never by name alone
3. **Liquidity floor** — Hard minimum of $100K regardless of other factors
4. **CEX check** — Already on Binance/Coinbase/OKX/Bybit = lower priority
5. **Chain filter** — Only Solana, Ethereum, BSC qualify for SolCex listing

## Special Flags

| Flag | Meaning |
|------|---------|
| `[HIGH CONVICTION]` | Appears on both AIXBT AND DexScreener trending |
| `[WHALE ALERT]` | Einstein AI confirmed whale activity |
| `[BREAKING]` | Gloria AI breaking news catalyst |
| `[KOL SIGNAL]` | leak.me smart money tracking detected |
| `[VERIFIED]` | Full data verification complete |
| `[REVENUE SIGNAL]` | ETH/BSC token with score 80+ (cross-chain premium fee) |
