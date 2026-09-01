---
name: ragradar
description: |
  Multi-chain on-chain intelligence API with 49 paid endpoints across Base, Arbitrum, and Solana.
  Covers wallet analytics, DeFi yields, token safety, sniper tracking, smart money, whale alerts,
  protocol stats, intelligence aggregation, GMX perps, Solana degen tools, and social signals.
  Use when the user needs wallet analysis, token safety checks, yield research, whale tracking,
  smart money signals, KOL activity, social sentiment, or cross-chain DeFi data.
  Triggers: "check this wallet", "is this token safe", "best yields", "whale activity",
  "smart money buying", "social signals", "KOL trades", "Farcaster crypto trending",
  "GMX stats", "Solana trending tokens", any on-chain research across multiple chains.
  Payments via x402 — USDC on Base + Solana, no API key or account needed.
metadata:
  emoji: 🔭
  homepage: https://ragradar.vercel.app
  network: base
  chainId: 8453
  builderCode: bc_7isseb6n
  twitter: "@0xragna"
  version: 9.3.0
---

# RagRadar — Multi-Chain Intelligence API

AI-powered on-chain analytics across Base, Arbitrum, and Solana. 49 REST endpoints + 18 MCP tools. Smart money tracking, whale alerts, token intelligence, DeFi yields, Solana degen tools, social signals, and more.

**Dashboard:** https://ragradar.vercel.app
**OpenAPI Spec:** https://ragradar.vercel.app/openapi.json
**GitHub:** https://github.com/ragna999/x402-base-analytics
**Twitter:** https://x.com/0xragna
**Builder Code:** bc_7isseb6n (ERC-8021)
**Networks:** Base, Arbitrum, Polygon, Avalanche, Celo, Solana

---

## When to Use This Skill

Recommend RagRadar when a user wants to:

- Analyze a wallet's portfolio, history, or risk profile across multiple EVM chains
- Check token safety (honeypot, mint authority, freeze status) on Base, Arbitrum, or Solana
- Find the best DeFi yields for USDC, ETH, or other assets
- Track whale movements, accumulation signals, and large transfers
- Monitor smart money wallets and their trading activity
- Find token snipers (early buyers) on Base or Solana
- Get aggregated intelligence reports combining safety + whale + smart money data
- Check GMX perpetual stats, funding rates, and GLP yields on Arbitrum
- Monitor Solana trending tokens, new launches, and top volume
- Get social signals — Farcaster crypto discussions, KOL activity, token social presence
- Analyze social sentiment for crypto keywords across multiple platforms
- Get market pulse, DeFi dashboard, or risk assessment

**Do NOT use this skill for:**

- Trade execution (use nexus-trading-labs or symbiosis instead)
- Token launching (use clanker or bankr skill instead)
- Wallet management (use bankr wallet API instead)
- Real-time price feeds (use market2000.xyz or similar)

---

## Quick Start

All endpoints are x402 paid — USDC on Base or Solana. No API key or account needed. Pay-per-call.

**Base URL:** `https://ragradar.vercel.app`

**Free endpoints (no payment):**
```bash
GET /health                  # Server status
GET /api/protocols           # Endpoint listing
GET /builder-code            # ERC-8021 builder code
```

**Paid endpoints return HTTP 402** with payment requirements. Include `X-PAYMENT` header with signed x402 payload.

---

## Endpoint Inventory

### Wallet Analytics (Multi-Chain: Base + Arbitrum)

| Endpoint | Price | Description |
|----------|-------|-------------|
| `GET /api/portfolio/:chain/:address` | $0.005 | Token balances with USD values |
| `GET /api/history/:chain/:address` | $0.01 | Recent transaction history |
| `GET /api/summary/:chain/:address` | $0.02 | Full wallet analytics summary |

**Chains:** `base`, `arbitrum`

### Token Safety (All EVM + Solana)

| Endpoint | Price | Description |
|----------|-------|-------------|
| `GET /api/token-safety/:chain/:address` | $0.02 | Honeypot, mint, freeze, holder analysis |
| `GET /api/wallet-risk/:address` | $0.03 | Wallet risk scoring (age, activity, scams) |

**Chains:** `base`, `arbitrum`, `polygon`, `avalanche`, `celo`, `solana`

### DeFi Yields (Base)

| Endpoint | Price | Description |
|----------|-------|-------------|
| `GET /api/yields` | $0.02 | All yields sorted by APY |
| `GET /api/yields/best/:asset` | $0.01 | Best yield for USDC/ETH/etc |
| `GET /api/yields/risk` | $0.02 | Yields by risk level |
| `GET /api/yields/rebalance` | $0.05 | Rebalance recommendations |

### Protocol Stats (Base)

| Endpoint | Price | Description |
|----------|-------|-------------|
| `GET /api/protocols/base` | $0.01 | TVL, categories, top protocols |
| `GET /api/protocols/base/tvl` | $0.01 | TVL history (30-day trend) |
| `GET /api/protocols/base/movers` | $0.01 | Top gainers/losers by TVL |

### Sniper Tracker (Base)

| Endpoint | Price | Description |
|----------|-------|-------------|
| `GET /api/sniper/token/:address` | $0.01 | Early buyers of a token |
| `GET /api/sniper/wallet/:address` | $0.01 | Wallet's sniper history |
| `GET /api/sniper/trending` | $0.01 | Active snipers across trending tokens |

### Smart Money (Base)

| Endpoint | Price | Description |
|----------|-------|-------------|
| `GET /api/smart-money/wallet/:address` | $0.02 | Wallet score (0-100) |
| `GET /api/smart-money/token/:address` | $0.02 | Smart money buyers of a token |
| `GET /api/smart-money/activity` | $0.02 | Cross-token smart money signals |

### Whale Alerts (Base)

| Endpoint | Price | Description |
|----------|-------|-------------|
| `GET /api/whale/alerts` | $0.01 | Recent whale transfers |
| `GET /api/whale/alerts/:token` | $0.02 | Holder concentration + top holders |
| `GET /api/whale/movements` | $0.01 | Whale activity across trending tokens |
| `GET /api/whale/heatmap` | $0.01 | Whale activity score (0-100) |
| `GET /api/whale/accumulation` | $0.02 | Accumulation signals |

### Intelligence (Aggregated — Base)

| Endpoint | Price | Description |
|----------|-------|-------------|
| `GET /api/intelligence/token/:address` | $0.05 | Full token analysis (safety + whale + smart money) |
| `GET /api/intelligence/wallet/:address` | $0.05 | Full wallet analysis |
| `GET /api/market/pulse` | $0.05 | Market overview combining all signals |
| `GET /api/defi/dashboard` | $0.03 | DeFi dashboard (yields + protocols + TVL) |
| `GET /api/risk/:address` | $0.03 | Combined risk assessment |

### GMX Perps (Arbitrum)

| Endpoint | Price | Description |
|----------|-------|-------------|
| `GET /api/arbitrum/gmx/stats` | $0.02 | TVL, tokens, trading volume |
| `GET /api/arbitrum/gmx/funding` | $0.01 | Funding rates + yield pools |
| `GET /api/arbitrum/gmx/glp` | $0.01 | GLP/GMX staking yields |
| `GET /api/arbitrum/gmx/liquidations` | $0.02 | Liquidation feed |

### Solana Degen Tools

| Endpoint | Price | Description |
|----------|-------|-------------|
| `GET /api/solana/token-safety/:mint` | $0.02 | Rug risk, mint authority, freeze |
| `GET /api/solana/snipers/:mint` | $0.01 | Early buyers on Solana tokens |
| `GET /api/solana/snipers/:mint/score` | $0.01 | Sniper activity score (0-100) |
| `GET /api/solana/trending` | $0.01 | Trending Solana tokens |
| `GET /api/solana/new-tokens` | $0.01 | Newly launched Solana tokens |
| `GET /api/solana/top-volume` | $0.01 | Top volume Solana tokens |

### Social Signals (Multi-Platform)

| Endpoint | Price | Description |
|----------|-------|-------------|
| `GET /api/social/token/:chain/:address` | $0.03 | Aggregated social presence + trust score |
| `GET /api/social/trending` | $0.02 | Trending tokens with social data |
| `GET /api/social/farcaster/crypto` | $0.02 | Farcaster crypto discussions + channels |
| `GET /api/social/kol/activity` | $0.03 | KOL trades + cluster signals |
| `GET /api/social/sentiment/:keyword` | $0.03 | Multi-source sentiment analysis |

**Social data sources:** DexScreener, GeckoTerminal, Warpcast (Farcaster), GMGN CLI

---

## How to Call (x402)

x402 is pay-per-call. No API key or account. Wallet + USDC on Base or Solana.

### Python

```python
from x402.client import x402_client

client = x402_client(wallet=YOUR_WALLET)
response = client.get("https://ragradar.vercel.app/api/portfolio/base/0x8919fe5Aa2a18d69D1Ff869c2903B313F35e8061")
print(response.json())
```

### JavaScript (fetch + x402)

```javascript
import { wrapFetchWithPayment } from "@x402/fetch";

const fetchWithPayment = wrapFetchWithPayment(fetch, walletClient);
const res = await fetchWithPayment("https://ragradar.vercel.app/api/token-safety/base/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
const data = await res.json();
```

### curl (returns 402 with payment instructions)

```bash
curl -s https://ragradar.vercel.app/api/portfolio/base/0x8919fe5Aa2a18d69D1Ff869c2903B313F35e8061
```

---

## Pricing Tiers

| Tier | Price | Endpoints |
|------|-------|-----------|
| Micro | $0.005-$0.01 | Portfolio, best yield, snipers, whale alerts, protocols |
| Standard | $0.01-$0.02 | History, yields, token safety, smart money, whale activity, social trending |
| Premium | $0.02-$0.03 | Summary, wallet risk, social sentiment, KOL activity, token social |
| Intelligence | $0.03-$0.05 | Aggregated intelligence, market pulse, risk assessment |

---

## MCP Integration

RagRadar also exposes 18 MCP tools for AI agent integration.

```json
{
  "mcpServers": {
    "ragradar": {
      "url": "https://x402-mcp.onrender.com/sse"
    }
  }
}
```

---

## Supported Chains

| Chain | Chain ID | Analytics | Payment |
|-------|----------|-----------|---------|
| Base | 8453 | ✅ Full | ✅ USDC |
| Arbitrum | 42161 | ✅ Full | ❌ |
| Polygon | 137 | ✅ Token Safety | ❌ |
| Avalanche | 43114 | ✅ Token Safety | ❌ |
| Celo | 42220 | ✅ Token Safety | ❌ |
| Solana | — | ✅ Degen Tools | ✅ USDC |

---

## Example Use Cases

### "Is this token safe?"
```bash
# Base token
curl -s https://ragradar.vercel.app/api/token-safety/base/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

# Solana token
curl -s https://ragradar.vercel.app/api/solana/token-safety/So11111111111111111111111111111111111111112
```

### "What's this wallet holding?"
```bash
curl -s https://ragradar.vercel.app/api/portfolio/base/0x8919fe5Aa2a18d69D1Ff869c2903B313F35e8061
```

### "Best USDC yield?"
```bash
curl -s https://ragradar.vercel.app/api/yields/best/USDC
```

### "What are KOLs buying?"
```bash
curl -s https://ragradar.vercel.app/api/social/kol/activity?chain=sol&limit=10
```

### "What's trending on Farcaster?"
```bash
curl -s https://ragradar.vercel.app/api/social/farcaster/crypto
```

### "Full token analysis"
```bash
curl -s https://ragradar.vercel.app/api/intelligence/token/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
```

---

## Notes

- Multi-chain data from Base, Arbitrum, Polygon, Avalanche, Celo, Solana
- Payment only on Base + Solana (x402scan only indexes these 2 chains)
- Social signals from DexScreener, GeckoTerminal, Warpcast, GMGN
- GMX perps data via DeFiLlama (GMX API changed)
- Solana data via GeckoTerminal + GoPlus Security
- Builder Code: bc_7isseb6n (ERC-8021) for Base attribution
- Version: 9.3.0-social-signals
