---
name: zapper
description: Query DeFi portfolio data across 50+ chains via Zapper's GraphQL API. Use when the user wants to check wallet balances, DeFi positions, NFT holdings, token prices, or transaction history. Supports Base, Ethereum, Polygon, Arbitrum, Optimism, and more. Requires ZAPPER_API_KEY.
metadata: {"clawdbot":{"emoji":"⚡","homepage":"https://zapper.xyz","requires":{"bins":["curl","jq","python3"]}}}
---

# Zapper Skill

Query DeFi portfolio data across 50+ chains via Zapper's GraphQL API.

## Quick Start

### Setup

Get your API key from [Zapper Dashboard](https://dashboard.zapper.xyz/settings/api) (free tier available):

```bash
mkdir -p ~/.clawdbot/skills/zapper
cat > ~/.clawdbot/skills/zapper/config.json << 'EOF'
{
  "apiKey": "YOUR_ZAPPER_API_KEY"
}
EOF
```

### Basic Usage

```bash
# Portfolio summary
scripts/zapper.sh portfolio 0x...

# Token holdings
scripts/zapper.sh tokens 0x...

# DeFi positions
scripts/zapper.sh apps 0x...

# NFT holdings
scripts/zapper.sh nfts 0x...

# Token price
scripts/zapper.sh price ETH

# Recent transactions
scripts/zapper.sh tx 0x...

# Unclaimed rewards
scripts/zapper.sh claimables 0x...
```

## Commands

| Command | Description | Example |
|---------|-------------|---------|
| `portfolio <address>` | Token balances + totals across all chains | `zapper.sh portfolio 0x123...` |
| `tokens <address>` | Detailed token holdings | `zapper.sh tokens 0x123...` |
| `apps <address>` | DeFi positions (LPs, lending, staking) | `zapper.sh apps 0x123...` |
| `nfts <address>` | NFT holdings | `zapper.sh nfts 0x123...` |
| `price <symbol>` | Token price lookup | `zapper.sh price ETH` |
| `tx <address>` | Recent transactions (human-readable) | `zapper.sh tx 0x123...` |
| `claimables <address>` | Unclaimed rewards | `zapper.sh claimables 0x123...` |

## Supported Networks

Zapper supports 50+ chains including:

- Ethereum
- Base
- Polygon
- Arbitrum
- Optimism
- Avalanche
- BNB Chain
- zkSync
- Linea
- Scroll
- And more...

## Use Cases

- **Portfolio tracking**: Aggregate all DeFi positions across chains
- **Yield hunting**: Check claimables and unclaimed rewards
- **NFT portfolio**: Track NFT holdings across marketplaces
- **Transaction history**: Human-readable on-chain activity
- **Token prices**: Quick price lookups

## API Reference

All endpoints use `POST https://public.zapper.xyz/graphql` with GraphQL queries.

See [references/api.md](references/api.md) for full API documentation.

## Requirements

- `curl` - HTTP requests
- `jq` - JSON parsing
- `python3` - Formatting output
- Zapper API key (free tier available)

## Notes

- API key is required for all endpoints
- Rate limits apply based on your Zapper plan
- GraphQL queries allow flexible data selection
