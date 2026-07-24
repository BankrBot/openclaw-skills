---
name: gentech-x402
description: Pay-per-call API gateway using the x402 protocol. Access on-chain agent intelligence — token risk scoring, wallet analysis, market data, agent discovery, airdrop checking, game/movie price comparison, and DeFi insights — across Base, Solana, Avalanche, BNB, X Layer, and Algorand. Pay USDC per call, no subscription or API key needed. Use when an agent needs to research tokens, analyze wallets, find deals, check airdrops, or get market intelligence.
---

# GenTech Labs — x402 Gateway

Pay-per-call access to on-chain agent intelligence via the x402 protocol. 16 endpoints across 6 chains — no API key, no subscription, just USDC micropayments.

## Available Services

| Service | Endpoint | Price | Description |
|---------|----------|-------|-------------|
| Token Security | `POST /api/v1/token-security` | $0.01 | Risk scan for any EVM token (honeypot, mint, ownership) |
| Wallet Analyzer | `POST /api/v1/wallet/analyze` | $0.025 | Portfolio, P&L, smart money patterns |
| Agent Discovery | `GET /api/v1/agentscan` | $0.10 | Search and enumerate on-chain agents |
| Airdrop Checker | `POST /api/v1/airdrops/check` | $0.01 | Check wallet eligibility for active airdrops |
| Market Intel | `GET /api/v1/intel/search` | $0.005 | Price comparison across stores |
| Game Intel | `GET /api/v1/games/search` | $0.005 | Multi-store game pricing + news |
| Movie Intel | `GET /api/v1/movies/search` | $0.005 | Streaming prices + cast/crew |
| NFT Search | `GET /api/v1/nft/search` | $0.005 | Multi-chain NFT collection data |
| Shipping Tracker | `GET /api/v1/shipping/track` | $0.005 | Package tracking across carriers |
| Agent Health | `GET /api/v1/health` | Free | Service status |

## Payment Flow

1. Call any endpoint → receives HTTP 402 with `Payment-Required` header
2. Parse the V2 JSON payload: `{ scheme, network, amount, asset, payTo }`
3. Sign a USDC transfer via EIP-3009 or wallet signature
4. Retry the original request with `Payment-Signature` header
5. Receive the response

## Supported Chains

| Chain | Network ID | Asset |
|-------|-----------|-------|
| Base | `eip155:8453` | USDC |
| Solana | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` | USDC |
| Avalanche | `eip155:43114` | USDC |
| BNB | `eip155:56` | USDC |
| X Layer | `eip155:196` | USDC |
| Algorand | `algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=` | USDC |

## Spend-aware Usage

- Start with free health check to verify connectivity
- Use specific endpoints over broad searches (token-security at $0.01 vs agent-discover at $0.10)
- Cache results when possible — token risk scores change infrequently
- DeFi intel endpoints are cheapest ($0.005) for high-volume queries
