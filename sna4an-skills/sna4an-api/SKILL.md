---
name: sna4an-api
description: Blockchain data APIs for AI agents - cross-chain bridge routing, whale alerts, DeFi yield aggregation, multi-chain RPC proxy, NFT data, token data, and transaction history across 50+ chains. Pay-per-call via x402 on Base.
tags: [blockchain, defi, bridge, whale, rpc, nft, token, data, multi-chain, x402]
version: 1
metadata:
  clawdbot:
    emoji: "🔗"
    homepage: "https://bankr.bot/x402"
---

# Sna4an API

Blockchain data APIs for AI agents. 7 paid endpoints covering cross-chain operations, DeFi intelligence, and on-chain data across 50+ blockchains.

All endpoints are pay-per-call via x402 on Base. No API keys required - just pay with USDC.

## Endpoints

| Endpoint | Price | Description |
|----------|-------|-------------|
| **bridge-route** | $0.005 | Find optimal cross-chain bridge route. Aggregates Li.fi, Bungee, 1inch Fusion, and Jupiter for best rates. |
| **whale-alerts** | $0.001 | Real-time whale transaction alerts. Track large transfers across EVM chains. |
| **defi-yields** | $0.001 | Find best DeFi yields across 100+ protocols and 20+ chains via DefiLlama. |
| **blockchain-rpc** | $0.01 | JSON-RPC proxy to 57+ blockchain networks via Alchemy. |
| **nft-data** | $0.01 | NFT data - ownership, metadata, floor prices, sales. 20+ EVM chains. |
| **token-data** | $0.01 | ERC-20 token balances, metadata, and transfer history. 20+ EVM chains. |
| **tx-history** | $0.01 | Transaction history for any address. External, ERC-20, ERC-721, ERC-1155 transfers. |

## Base URL

```
https://x402.bankr.bot/0x98db0a1690f487d14eb45153e5c61f64693a2799
```

## Usage

All endpoints require POST method with JSON body. Send request without payment to receive 402 with payment requirements.

### Example: Get DeFi Yields

```bash
curl -X POST https://x402.bankr.bot/0x98db0a1690f487d14eb45153e5c61f64693a2799/defi-yields \
  -H "Content-Type: application/json" \
  -d '{"chain": "Base", "token": "USDC", "limit": 5}'
```

### Example: Bridge Route

```bash
curl -X POST https://x402.bankr.bot/0x98db0a1690f487d14eb45153e5c61f64693a2799/bridge-route \
  -H "Content-Type: application/json" \
  -d '{"fromChain": "ethereum", "toChain": "base", "fromToken": "USDC", "toToken": "USDC", "amount": "1000"}'
```

### Example: Whale Alerts

```bash
curl -X POST https://x402.bankr.bot/0x98db0a1690f487d14eb45153e5c61f64693a2799/whale-alerts \
  -H "Content-Type: application/json" \
  -d '{"chain": "ethereum", "minAmountUSD": 100000, "limit": 10}'
```

### Example: Blockchain RPC

```bash
curl -X POST https://x402.bankr.bot/0x98db0a1690f487d14eb45153e5c61f64693a2799/blockchain-rpc \
  -H "Content-Type: application/json" \
  -d '{"chain": "base", "method": "eth_blockNumber", "params": []}'
```

## Supported Chains

Ethereum, Base, Polygon, Arbitrum, Optimism, Avalanche, BNB Chain, Solana, zkSync, Linea, Starknet, Gnosis, Berachain, Monad, Sonic, Sei, Mantle, Zora, Ronin, Celo, Metis, Ink, Unichain, World Chain, Abstract, Soneium, opBNB, Sui, Aptos, Tron, Injective, and 20+ more.

## API Reference

See [references/endpoints.md](references/endpoints.md) for full endpoint documentation including request/response schemas.
