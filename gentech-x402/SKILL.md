---
name: gentech-x402
description: Pay-per-call x402 API gateway from GenTech Labs. Access on-chain agent intelligence — token security scoring, wallet portfolio analysis, agent discovery (ERC-8004), DeFi LP analytics, real-time market prices, airdrop/dust-token defense, NFT search, deal tracking, and AI agent research — across Base, Solana, Avalanche, BNB, X Layer, Injective, and Algorand. Pay USDC per call via HTTP 402 challenge, no subscription or API key needed. Use when an agent needs to research a token, analyze a wallet, find on-chain agents, score a token's security, check LP health, or get market/deal intel.
---

# GenTech Labs — x402 Gateway

Pay-per-call access to on-chain agent intelligence via the [x402](https://x402.org) protocol. Live gateway at `https://api.gentechlabs.net`. No API key, no subscription — call any endpoint, get an HTTP 402 payment challenge, pay USDC, get the response.

## Available Services (live)

| Service | Endpoint (GET) | Price | Description |
|---------|----------------|-------|-------------|
| Token Security | `/v1/security/score/{address}` | $0.01 | Risk scoring + rugcheck analysis for any token (honeypot, mint, ownership) |
| Wallet Analyzer | `/v1/wallet/portfolio/{address}` | $0.02 | Wallet portfolio analysis with token balances + USD valuation |
| DeFi LP Analytics | `/v1/defi/lp/{address}` | $0.02 | DeFi LP pool analysis with efficiency scoring (DexScreener) |
| Agent Discovery | `/v1/agents/search` | $0.01 | Search the ERC-8004 registry for on-chain AI agents |
| Market Intel | `/v1/market/price/{symbol}` | $0.005 | Real-time crypto market price data |
| Airdrop Defense | `/v1/defender/classify/{chainId}/{token}` | $0.01 | Classify any token KNOWN/SUSPICIOUS — quarantine scam airdrops/dust |
| NFT Search | `/v1/nft/search` | $0.01 | NFT collection search across Solana (Magic Eden) |
| Deal Tracker | `/v1/deals/deals` | $0.005 | Game deal tracking, price-watch, release radar (CheapShark engine) |
| Agent Research | `/v1/agent/research?task={task}&topic={topic}` | $0.05 | On-demand AI agent research / analysis / summarization (local LLM) |
| Lineage Guard | `/v1/lineage/guard?urn={datasetUrn}` | $0.02 | Data lineage blast-radius guard for drop/change decisions |
| Health | `/health` | Free | Service status |

## Payment Flow (x402 V2)

1. `GET` any paid endpoint → receive **HTTP 402** with a `Payment-Required` header + V2 JSON payload: `{ scheme, network, amount, asset, payTo }`
2. Sign a USDC transfer (EIP-3009 gasless) or wallet signature for the requested `amount`
3. Retry the original request with the signed proof (`Payment-Signature` header)
4. Receive the paid response

No wallet top-ups, no API keys, no subscriptions — one USDC micropayment per call, fully self-serve.

## Supported Chains

| Chain | Network ID | Asset |
|-------|-----------|-------|
| Base | `eip155:8453` | USDC |
| Solana | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` | USDC |
| Avalanche | `eip155:43114` | USDC |
| BNB | `eip155:56` | USDC |
| X Layer | `eip155:196` | USDC |
| Injective | `injective:1` | INJ |
| Algorand | `algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=` | USDC |

Chains vary per service — see the gateway manifest for the per-service chain list.

## Quick Start

```bash
# Free health check
curl https://api.gentechlabs.net/health

# Paid call — returns 402 + payment challenge
curl https://api.gentechlabs.net/v1/security/score/0x8e53ad52980478794bb5b459b7cbdd836975e4cb

# Full manifest (all services, prices, chains)
curl https://api.gentechlabs.net/.well-known/x402-bazaar
```

## Spend-aware Usage

- Start with the free `/health` check to verify connectivity.
- Use specific endpoints over broad searches (`token-security` at $0.01 vs `agent-research` at $0.05).
- Cache results — token risk scores and market prices change infrequently.
- Data-intel endpoints are cheapest ($0.005) for high-volume queries.
