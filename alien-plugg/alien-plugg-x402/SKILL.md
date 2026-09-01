---
name: alien-plugg-x402
description: "38 paid x402 API endpoints for AI agents — Zora crypto analysis, Robinhood Chain tokenized stocks, on-chain intelligence, whale tracking, and utilities. MCP-compatible. Flat $0.003/call via USDC micropayments on Base."
tags: [x402, crypto, zora, robinhood, stocks, defi, trading, base, mcp, api, whale, sentiment, rug-check]
version: 2
visibility: public
metadata:
  clawdbot:
    emoji: "👽"
    homepage: "https://github.com/michaelhutchings626-hub/alien-plugg-x402"
    requires:
      bins: [curl]
---

# Alien Plugg x402 API

> What I have is outta this world 👽🌌

38 paid x402 API endpoints for AI agents. Covers Zora crypto analysis, Robinhood Chain tokenized stocks, on-chain intelligence, and utilities. MCP-compatible with 10 curated tools. Flat $0.003/call via automatic USDC micropayments on Base.

## Installation

Point your agent at the discovery endpoint or MCP server:

### MCP Server (For Claude, Cursor, and MCP-compatible agents)

```
https://x402.bankr.bot/0xabf922abb2a9e782f0b187d5d1ab24deb4870c3d/mcp-server
```

Implements MCP protocol 2024-11-05: initialize, tools/list, tools/call, resources/list, resources/read.
10 curated tools: zora-scanner, rh-stock-prices, token-price, zora-rug-check, zora-portfolio, whale-tracker, wallet-profile, gas-tracker, builder-score, alien-plugg-alpha.

### Discovery Endpoint (For any HTTP client)

```
https://x402.bankr.bot/0xabf922abb2a9e782f0b187d5d1ab24deb4870c3d/discovery
```

Returns full catalog as JSON. Add `?format=llms` for llms.txt format.

## Quick Reference — All 38 Endpoints

Base URL: `https://x402.bankr.bot/0xabf922abb2a9e782f0b187d5d1ab24deb4870c3d/`

### Robinhood Chain Stock Tokens (Unique — not available elsewhere)
| Endpoint | Price | Params | Description |
|----------|-------|--------|-------------|
| rh-stock-prices | $0.003 | `symbol` (e.g. NVDA) | Live bid/ask for 90+ tokenized stocks |
| rh-stock-list | $0.003 | none | Full catalog with contract addresses, multipliers |
| rh-corporate-actions | $0.003 | none | Splits, dividends, mergers for stock token holders |
| rh-stock-screener | $0.003 | `sort`, `limit` (optional) | Screen/rank by volume, tradability, extended hours |
| rh-dex-scanner | $0.003 | none | Block activity, gas prices, tx counts on chain ID 4663 |
| robinhood-scanner | $0.003 | none | Trending Robinhood Chain tokens + BUY/SELL signals |

### Zora Crypto Analysis
| Endpoint | Price | Params | Description |
|----------|-------|--------|-------------|
| zora-scanner | $0.003 | none | Trending coins + BUY/SELL/STRONG_BUY signals |
| new-launches | $0.003 | none | Freshest token launches with age labels |
| zora-rug-check | $0.003 | `address` (0x...) | 0-100 rug risk score with verdict |
| zora-portfolio | $0.003 | `address` (0x...) | Wallet holdings, PnL, allocation breakdown |
| zora-sentiment | $0.003 | `token` (0x...) | Social sentiment across Twitter/Farcaster/TikTok |
| honeypot-check | $0.003 | `token` (0x...) | Honeypot/sell-trap detector |
| holder-analysis | $0.003 | `token` (0x...) | Top holders, Gini coefficient, concentration |
| creator-lookup | $0.003 | `handle` (e.g. alienplugg) | Creator profiles, coins, social accounts |
| chart-roast | $0.003 | `token` (0x...) | Technical analysis + brutal chart roasting |
| token-compare | $0.003 | `a` (0x...), `b` (0x...) | Side-by-side token comparison |

### On-Chain Intelligence
| Endpoint | Price | Params | Description |
|----------|-------|--------|-------------|
| token-price | $0.003 | `symbol` (BTC) or `id` (bitcoin) | CoinGecko prices for any token |
| whale-tracker | $0.003 | `token` (0x...) | Large whale transfer detection on Base |
| smart-money | $0.003 | `token` (0x...) | Smart money wallet tracking |
| wallet-profile | $0.003 | `address` (0x...) | ETH/USDC balance, tx count, behavioral label |
| gas-tracker | $0.003 | `chain` (base, ethereum, etc.) | Gas prices on Base, Ethereum, Arbitrum, Optimism, Polygon |
| tx-status | $0.003 | `tx` (0x...), `chain` (base) | Transaction confirmation status + gas cost |
| builder-score | $0.003 | `handle` (e.g. Hutchingsnyamom) | AI-powered builder reputation score |

### Alert System
| Endpoint | Price | Params | Description |
|----------|-------|--------|-------------|
| price-alerts | $0.003 | `action` (list/create/check) | Set/check price alerts for Zora tokens |
| whale-alert | $0.003 | `action` (list/create/check) | Whale movement alerts |
| rug-alert | $0.003 | `action` (list/create/check) | Rug risk alerts |
| launch-alert | $0.003 | `action` (list/create/check) | New launch alerts |

### Utilities
| Endpoint | Price | Params | Description |
|----------|-------|--------|-------------|
| translate | $0.003 | `text`, `target` (es, fr, ja...) | 100+ languages via Google Translate |
| ip-info | $0.003 | `ip` (optional, defaults to caller) | IP geolocation + proxy/VPN detection |
| expand-url | $0.003 | `url` (short URL) | Follow redirects, resolve final URL |
| tech-stack-detect | $0.003 | `url` (website URL) | Website technology fingerprinting |
| webpage-diff | $0.003 | `url`, `hash` (optional) | Monitor webpage changes |

### Premium Alpha
| Endpoint | Price | Params | Description |
|----------|-------|--------|-------------|
| alien-plugg-alpha | $0.003 | none | Daily curated picks, signals, rug warnings |
| alien-plugg-pro-alpha | $0.003 | none | Pro report with RSI, MACD, support/resistance |

### DEX Analysis
| Endpoint | Price | Params | Description |
|----------|-------|--------|-------------|
| dex-flow | $0.003 | `token` (0x...) | Uniswap V3 liquidity flow analysis |

### Discovery (FREE)
| Endpoint | Price | Description |
|----------|-------|-------------|
| discovery | FREE | Full catalog as JSON or llms.txt format |
| mcp-handshake | FREE | MCP protocol handshake + tool discovery |
| mcp-server | $0.003 | MCP tools/call (POST with MCP body) |

## Usage Examples

```bash
# Get live NVDA stock token price
curl "https://x402.bankr.bot/0xabf922abb2a9e782f0b187d5d1ab24deb4870c3d/rh-stock-prices?symbol=NVDA"

# Scan Zora for trending coins
curl "https://x402.bankr.bot/0xabf922abb2a9e782f0b187d5d1ab24deb4870c3d/zora-scanner"

# Check rug risk for a token
curl "https://x402.bankr.bot/0xabf922abb2a9e782f0b187d5d1ab24deb4870c3d/zora-rug-check?address=0x..."

# Get wallet profile
curl "https://x402.bankr.bot/0xabf922abb2a9e782f0b187d5d1ab24deb4870c3d/wallet-profile?address=0x..."

# Daily alpha report
curl "https://x402.bankr.bot/0xabf922abb2a9e782f0b187d5d1ab24deb4870c3d/alien-plugg-alpha"
```

## MCP Integration (Claude Desktop / Cursor)

Add to your MCP config:

```json
{
  "mcpServers": {
    "alien-plugg": {
      "url": "https://x402.bankr.bot/0xabf922abb2a9e782f0b187d5d1ab24deb4870c3d/mcp-server"
    }
  }
}
```

The MCP server handles initialize, tools/list, and resources/list for free. Only tools/call requires USDC payment (automatic via x402 protocol).

## Tokens
- **PLUGG on Base (v2):** 0xDe76415CeBe959CF0738e8A636d9153fF295bba3
- **PLUGG on Base (v1):** 0x2475438eA40592D0c865Cd4DB16a2caa1367bBa3
- **PLUGG on Robinhood:** 0x09d56eaCb69E85Dca856B6dc15fA6aE9eeaBFBa3

## Links
- **GitHub:** https://github.com/michaelhutchings626-hub/alien-plugg-x402
- **Discovery:** https://x402.bankr.bot/0xabf922abb2a9e782f0b187d5d1ab24deb4870c3d/discovery
- **MCP Server:** https://x402.bankr.bot/0xabf922abb2a9e782f0b187d5d1ab24deb4870c3d/mcp-server
- **Chat:** https://app.base44.com/superagent/6a5fdd57651262e86b24133e
- **llms.txt:** https://x402.bankr.bot/0xabf922abb2a9e782f0b187d5d1ab24deb4870c3d/discovery?format=llms
