# Agent Factory Pipeline

Automated workflow for discovering niches and building x402 paid agents.

## Pipeline Overview

```
1. DISCOVER  → Search X/social for trending topics
2. EVALUATE  → Score for B2A monetization potential
3. RESEARCH  → Find real, live data APIs
4. BUILD     → Create Lucid Agent (5 paid + 1 free endpoint)
5. TEST      → Self-test ALL endpoints with real data
6. DEPLOY    → Ship to Railway with proper env vars
7. REGISTER  → Register on ERC-8004 (Ethereum mainnet)
8. ANNOUNCE  → Tweet with agent URL + Etherscan NFT link
```

## Step 1: Discover Data Niches

Search for data that other AI agents need:

```bash
# API pain points
bird search "API rate limit" --limit 50
bird search "need real-time data" --limit 50

# Agent/developer needs
bird search "building AI agent" --limit 50
bird search "LLM needs data" --limit 50
```

**Look for:**
- Developers complaining about rate limits
- Agents/bots needing real-time data
- Data scattered across multiple sources
- Expensive APIs with no cheap alternative

## Step 2: Evaluate for B2A Monetization

**Scoring criteria (1-10):**

| Criteria | Weight | Questions |
|----------|--------|-----------|
| Agent Demand | 4x | Would other AI agents pay for this data? |
| Data Uniqueness | 3x | Is this aggregated or hard to get? |
| Recurring Need | 2x | Will agents call repeatedly? |
| API Availability | 2x | Are there free/public sources? |
| Build Simplicity | 1x | Can we build in < 2 hours? |

**Minimum score to proceed: 7**

## Step 3: Research Data Sources

**Good sources:**
- Public APIs with free tiers
- Government/open data portals
- Aggregation of multiple sources

**Common free APIs:**

| Domain | API | Example |
|--------|-----|---------|
| Crypto | CoinGecko | `api.coingecko.com` |
| Weather | Open-Meteo | `api.open-meteo.com` |
| News | RSS Feeds | Various |
| IP/Geo | ip-api | `ip-api.com` |
| Sports | ESPN | `site.api.espn.com` |
| Space | NASA | `api.nasa.gov` |
| Books | Open Library | `openlibrary.org/api` |

## Step 4: Build Agent

Standard structure:

```
my-agent/
├── src/
│   └── index.ts
├── package.json
├── .gitignore
└── Dockerfile (optional)
```

**Endpoint pattern:**
- 1 FREE endpoint: Overview/preview
- 5 PAID endpoints: Lookup, Search, Top, Compare, Report

**Pricing guidance:**
- Basic lookup: $0.001 (1000 microunits)
- Filtered search: $0.002
- Rankings/lists: $0.002
- Comparison: $0.003
- Full report: $0.005

## Step 5: Self-Test (MANDATORY)

```bash
# Start server
PAYMENTS_RECEIVABLE_ADDRESS=0x... \
FACILITATOR_URL=https://facilitator.daydreams.systems \
NETWORK=base \
bun run src/index.ts &

# Test all endpoints
curl -X POST http://localhost:3000/entrypoints/overview/invoke \
  -H "Content-Type: application/json" -d '{}'

curl -X POST http://localhost:3000/entrypoints/lookup/invoke \
  -H "Content-Type: application/json" -d '{"query":"test"}'

# ... test all 6 endpoints
```

**All must pass:**
- ✅ `status: "succeeded"`
- ✅ Real data in output (not empty)
- ✅ Response < 10 seconds

## Step 6: Deploy

```bash
# GitHub
git init && git add . && git commit -m "Initial commit"
gh repo create username/my-agent --public --source=. --push

# Railway
railway init
railway variables set \
  PAYMENTS_RECEIVABLE_ADDRESS=0xYourWallet \
  FACILITATOR_URL=https://facilitator.daydreams.systems \
  NETWORK=base \
  CHAIN_ID=1 \
  AGENT_DOMAIN=my-agent-production.up.railway.app
railway up
railway domain  # Note the domain for registration
```

## Step 7: Register on ERC-8004

Register on Ethereum mainnet to get verifiable on-chain identity:

```bash
# In agent directory
PRIVATE_KEY=0x... \
AGENT_DOMAIN=my-agent-production.up.railway.app \
RPC_URL=https://eth.llamarpc.com \
bun run src/register-identity.ts
```

**Registry:** `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
**Cost:** ~$0.50-2.00 in ETH gas

Save the transaction hash - this is your agent's NFT!

## Step 8: Announce

**Tweet template with NFT link:**

```bash
bird tweet "🚀 Just deployed: <Agent Name>!

<One-line value prop>

🔗 Try it: https://<domain>/entrypoints/overview/invoke
🪪 On-chain: https://etherscan.io/tx/<txHash>

Built with @lucid_agents x402 🦞

#AI #Agents #x402"
```

**Always include:**
- The agent URL for trying the free endpoint
- The Etherscan NFT link (builds trust, proves identity)
- Mention @lucid_agents

## B2A Agent Ideas

| Category | Agent | Data Sources |
|----------|-------|--------------|
| Price Aggregation | Multi-exchange crypto | CoinGecko, DeFiLlama |
| Entity Lookup | Company/domain info | WHOIS, Clearbit-style |
| Social Signals | Trending topics | X API, Reddit, HN |
| News Feed | Breaking news | RSS aggregation |
| Geocoding | Address/IP lookup | ip-api, Nominatim |
| Sports Data | Live scores | ESPN, official APIs |
| Space Weather | Solar activity | NOAA, NASA |
