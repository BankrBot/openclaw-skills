# Zapper API Reference

All endpoints use `POST https://public.zapper.xyz/graphql` with GraphQL queries.

**Required Header:** `x-zapper-api-key: YOUR_API_KEY`

## Authentication

```bash
# Set your API key in config
mkdir -p ~/.clawdbot/skills/zapper
cat > ~/.clawdbot/skills/zapper/config.json << 'EOF'
{
  "apiKey": "YOUR_ZAPPER_API_KEY"
}
EOF
```

Get your API key from [Zapper Dashboard](https://dashboard.zapper.xyz/settings/api).

## GraphQL Queries

### Portfolio V2 (Main Query)

The main query for portfolio data across all asset types:

```graphql
query PortfolioV2($addresses: [Address!]!) {
  portfolioV2(addresses: $addresses) {
    tokenBalances {
      totalBalanceUSD
      byToken(first: 10) {
        edges {
          node {
            symbol
            balance
            balanceUSD
            price
            name
            network { name }
          }
        }
      }
    }
    appBalances {
      totalBalanceUSD
      byNetwork(first: 5) {
        edges {
          node {
            network { name }
            balanceUSD
          }
        }
      }
    }
    nftBalances {
      totalBalanceUSD
    }
  }
}
```

**Variables:** `{"addresses": ["0x..."]}`

### Token Balances

```graphql
query TokenBalances($addresses: [Address!]!) {
  portfolioV2(addresses: $addresses) {
    tokenBalances(first: 50) {
      edges {
        node {
          symbol
          balance
          balanceUSD
          price
          name
          network { name }
        }
      }
    }
  }
}
```

### App Balances (DeFi Positions)

```graphql
query AppBalances($addresses: [Address!]!) {
  portfolioV2(addresses: $addresses) {
    appBalances(first: 50) {
      edges {
        node {
          appId
          appName
          balance
          balanceUSD
          network { name }
        }
      }
    }
  }
}
```

### NFT Balances

```graphql
query NftBalances($addresses: [Address!]!) {
  portfolioV2(addresses: $addresses) {
    nftBalances {
      totalBalanceUSD
      edges {
        node {
          name
          collectionName
          balance
          floorPrice
          network { name }
        }
      }
    }
  }
}
```

### Token Price Lookup

```graphql
query TokenPrice($symbol: String!) {
  token(symbol: $symbol) {
    price
    priceChange24h {
      percent
    }
    marketCap
    volume24h
  }
}
```

### Transaction History

```graphql
query Transactions($addresses: [Address!]!, $limit: Int) {
  transactions(addresses: $addresses, limit: $limit) {
    edges {
      node {
        hash
        blockNumber
        timestamp
        type
        details {
          ... on TokenTransfer {
            tokenSymbol
            tokenAmount
            valueUSD
          }
          ... on Swap {
            fromTokenSymbol
            toTokenSymbol
            fromAmount
            toAmount
          }
        }
      }
    }
  }
}
```

### Claimables (Unclaimed Rewards)

```graphql
query Claimables($addresses: [Address!]!) {
  claimables(addresses: $addresses) {
    edges {
      node {
        appId
        appName
        claimableBalance
        claimableBalanceUSD
        network { name }
        tokenSymbol
      }
    }
  }
}
```

## Rate Limits

| Plan | Rate Limit |
|------|------------|
| Free | 100 req/min |
| Pro | 1000 req/min |
| Enterprise | Custom |

## Common Networks

- `ethereum`
- `base`
- `polygon`
- `arbitrum`
- `optimism`
- `avalanche`
- `bsc` (BNB Chain)
- `zksync`
- `linea`
- `scroll`
- `gnosis`
- `fantom`

## Error Handling

```json
{
  "errors": [
    {
      "message": "Invalid API key",
      "locations": [...],
      "path": [...]
    }
  ]
}
```

Common errors:
- `Invalid API key` - Check your API key
- `Rate limit exceeded` - Wait before retrying
- `Invalid address` - Check the wallet address format

## See Also

- [Zapper API Docs](https://build.zapper.xyz/docs/api)
- [Zapper Dashboard](https://dashboard.zapper.xyz)
