# Alien Plugg x402 API Skill

## Description

Alien Plugg's cosmic x402 API toolkit — 32 paid endpoints for crypto, Zora, and on-chain analysis. MCP-compatible with 10 curated tools for AI agents. All payments are automatic via the x402 protocol (USDC on Base).

## Installation

```
> install the alien-plugg-x402 skill from https://github.com/BankrBot/skills/tree/main/alien-plugg-x402
```

## Available Tools

### MCP Server (Recommended for AI Agents)

Connect to the MCP server at:

```
https://x402.bankr.bot/0xabf922abb2a9e782f0b187d5d1ab24deb4870c3d/mcp-server
```

Implements MCP protocol 2024-11-05: initialize, tools/list, tools/call, resources/list, resources/read.

### Quick Reference — All 32 Endpoints

Base URL: `https://x402.bankr.bot/0xabf922abb2a9e782f0b187d5d1ab24deb4870c3d/`

#### Crypto & Trading
| Endpoint | Price | Description |
|----------|-------|-------------|
| zora-scanner | $0.01 | Trending coins + BUY/SELL/STRONG_BUY signals |
| robinhood-scanner | $0.01 | Robinhood Chain trending tokens |
| zora-rug-check | $0.02 | Rug risk score 0-100 with verdict |
| zora-portfolio | $0.005 | Wallet holdings, PnL, allocation |
| zora-sentiment | $0.05 | Social sentiment scoring |
| honeypot-check | $0.04 | Honeypot detector |
| holder-analysis | $0.03 | Holder concentration + Gini coefficient |
| token-price | $0.015 | CoinGecko price lookup |
| token-compare | $0.005 | Side-by-side token comparison |
| chart-roast | $0.008 | Brutal chart analysis + technical signals |
| alien-plugg-alpha | $0.05 | Daily curated alpha report |
| alien-plugg-pro-alpha | $0.25 | PRO TIER: Full analysis with entry/exit targets, risk scores, DCA advice, technical levels |

#### On-Chain Analysis
| Endpoint | Price | Description |
|----------|-------|-------------|
| whale-tracker | $0.08 | Whale transfer detection |
| wallet-profile | $0.003 | Wallet behavioral profiler |
| dex-flow | $0.12 | DEX liquidity flow analysis |
| smart-money | $0.08 | Smart money wallet tracking |
| new-launches | $0.01 | Fresh token launches |
| creator-lookup | $0.01 | Creator profile + all coins |
| gas-tracker | $0.002 | Real-time gas prices |
| tx-status | $0.002 | Transaction status checker |
| builder-score | $0.008 | Builder reputation score |

#### Alert Subscriptions
| Endpoint | Price | Description |
|----------|-------|-------------|
| whale-alert | $0.015 | Real-time whale movement alerts |
| rug-alert | $0.012 | Real-time rug detection alerts |
| launch-alert | $0.01 | Real-time new launch notifications |
| price-alerts | $0.008 | Price alert management |

#### Utilities
| Endpoint | Price | Description |
|----------|-------|-------------|
| translate | $0.005 | 100+ language translation |
| ip-info | $0.0015 | IP geolocation + VPN detection |
| expand-url | $0.015 | URL redirect chain tracer |
| tech-stack-detect | $0.008 | Website tech stack fingerprinting |
| webpage-diff | $0.03 | Webpage change monitor |

#### Infrastructure
| Endpoint | Price | Description |
|----------|-------|-------------|
| discovery | $0.001 | Free catalog endpoint (returns all endpoints) |
| mcp-server | $0.005 | MCP protocol server (10 tools) |

## Payment

All endpoints accept USDC on Base via the x402 protocol. First 1,000 requests/month are free (Bankr free tier). 5% platform fee applies after that. Earnings go directly to the wallet.

## Tokens

- **PLUGG on Base (v2):** `0xDe76415CeBe959CF0738e8A636d9153fF295bba3` — [View Launch](https://bankr.bot/launches/0xDe76415CeBe959CF0738e8A636d9153fF295bba3)
- **PLUGG on Robinhood:** `0x09d56eaCb69E85Dca856B6dc15fA6aE9eeaBFBa3` — [View Launch](https://bankr.bot/launches/0x09d56eaCb69E85Dca856B6dc15fA6aE9eeaBFBa3)

## Links

- **Chat:** https://app.base44.com/superagent/6a5fdd57651262e86b24133e
- **Zora:** https://zora.co/@alienplugg
- **Landing Page:** https://base44.app/api/apps/6a5fdd57651262e86b24133e/files/mp/public/6a5fdd57651262e86b24133e/1a205d56c_landing-page.html
- **llms.txt:** https://base44.app/api/apps/6a5fdd57651262e86b24133e/files/mp/public/6a5fdd57651262e86b24133e/defdb7edc_llms.txt
