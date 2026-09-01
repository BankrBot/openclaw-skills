# OpenSea REST API Reference

## Base URL and Authentication

```
Base URL: https://api.opensea.io
OpenAPI spec: https://api.opensea.io/api/v2/openapi.json
API key header: x-api-key: $OPENSEA_API_KEY
Bearer token header: Authorization: Bearer <token>  (wallet-authenticated endpoints only)
```

See [authentication.md](authentication.md) for the full auth flow and scope reference.

## Pagination

List endpoints support cursor-based pagination:
- `limit`: Page size (default varies, max 100)
- `next`: Cursor token from previous response

## Supported Chains

| Chain | Identifier |
|-------|------------|
| Ethereum | `ethereum` |
| Polygon | `matic` |
| Arbitrum | `arbitrum` |
| Optimism | `optimism` |
| Base | `base` |
| Avalanche | `avalanche` |
| Klaytn | `klaytn` |
| Zora | `zora` |
| Blast | `blast` |
| Sepolia (testnet) | `sepolia` |

## Endpoint Reference

### Collections

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v2/collections/{slug}` | GET | Single collection details |
| `/api/v2/collections/{slug}/stats` | GET | Collection statistics (floor, volume) |
| `/api/v2/collections` | GET | List multiple collections |
| `/api/v2/collections/trending` | GET | Trending collections by sales activity |
| `/api/v2/collections/top` | GET | Top collections by volume/sales/floor |
| `/api/v2/collections/batch` | POST | Fetch multiple collections by slug in one request |
| `/api/v2/collections/{slug}/offer_aggregates` | GET | Top offers grouped by price level |
| `/api/v2/collections/{slug}/holders` | GET | Holders ranked by quantity owned |
| `/api/v2/collections/{slug}/floor_prices` | GET | Floor-price history |

### NFTs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v2/chain/{chain}/contract/{contract}/nfts/{token_id}` | GET | Single NFT details |
| `/api/v2/collection/{slug}/nfts` | GET | NFTs by collection |
| `/api/v2/chain/{chain}/account/{address}/nfts` | GET | NFTs by wallet |
| `/api/v2/chain/{chain}/contract/{contract}/nfts` | GET | NFTs by contract |
| `/api/v2/nft/{contract}/{token_id}/refresh` | POST | Refresh NFT metadata |
| `/api/v2/nfts/batch` | POST | Fetch multiple NFTs in one request |
| `/api/v2/chain/{chain}/contract/{contract}/nfts/{token_id}/owners` | GET | Owners of an NFT (paginated for ERC-1155s) |
| `/api/v2/chain/{chain}/contract/{contract}/nfts/{token_id}/analytics` | GET | Historical sale points for an NFT |

### Listings

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v2/listings/collection/{slug}/all` | GET | All listings for collection (filter by `?maker=`) |
| `/api/v2/listings/collection/{slug}/nfts/{token_id}/best` | GET | Best listing for NFT |
| `/api/v2/orders/{chain}/seaport/listings` | POST | Create new listing |
| `/api/v2/listings/fulfillment_data` | POST | Get buy transaction data |
| `/api/v2/listings/sweep` | POST | Bulk-buy items from a collection |
| `/api/v2/listings/actions` | POST | Ordered approval + sign actions to create listings |

### Offers

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v2/offers/collection/{slug}/all` | GET | All offers for collection (filter by `?maker=`) |
| `/api/v2/offers/collection/{slug}/nfts/{token_id}` | GET | All offers for a specific NFT |
| `/api/v2/offers/collection/{slug}/nfts/{token_id}/best` | GET | Best offer for NFT |
| `/api/v2/orders/{chain}/seaport/offers` | POST | Create new offer |
| `/api/v2/offers/fulfillment_data` | POST | Get sell transaction data |

### Orders

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v2/orders/chain/{chain}/protocol/{protocol}/{hash}` | GET | Get order by hash |
| `/api/v2/orders/chain/{chain}/protocol/{protocol}/{hash}/cancel` | POST | Cancel order (requires `write:orders` scope + Bearer token for authenticated cancel) |

### Events

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v2/events/collection/{slug}` | GET | Events by collection |
| `/api/v2/events/chain/{chain}/contract/{contract}/nfts/{token_id}` | GET | Events by NFT |
| `/api/v2/events/chain/{chain}/account/{address}` | GET | Events by account |

### Drops

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v2/drops` | GET | List drops (featured, upcoming, recently_minted) |
| `/api/v2/drops/{slug}` | GET | Detailed drop info with stages and supply |
| `/api/v2/drops/{slug}/mint` | POST | Build mint transaction data |
| `/api/v2/drops/eligibility/{slug}` | GET | Check drop eligibility (requires `read:eligibility` scope + Bearer token) |
| `/api/v2/drops/deploy` | POST | Build deploy-contract transaction for a new drop |
| `/api/v2/drops/deploy/{chain}/{tx_hash}/receipt` | GET | Receipt for a previously submitted deploy transaction |

### Accounts

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v2/accounts/{address}` | GET | Account profile |
| `/api/v2/accounts/resolve/{identifier}` | GET | Resolve ENS name, username, or address |
| `/api/v2/account/{address}/portfolio` | GET | Portfolio stats (net worth, P&L) |
| `/api/v2/account/{address}/portfolio/history` | GET | Portfolio net-worth history |
| `/api/v2/account/{address}/offers` | GET | Active offers made by an account |
| `/api/v2/account/{address}/offers_received` | GET | Offers received by an account |
| `/api/v2/account/{address}/listings` | GET | Active listings for an account |
| `/api/v2/account/{address}/favorites` | GET | Items favorited by an account (requires `read:favorites` scope + Bearer token) |
| `/api/v2/account/{address}/collections` | GET | Collections owned by an account |
| `/api/v2/account/{address}/pnl` | GET | Aggregated trading P&L (realized + unrealized) for a wallet |
| `/api/v2/account/{address}/pnl/closed-positions` | GET | Closed (realized) trading positions for a wallet |
| `/api/v2/account/{address}/pnl/token-transfers` | GET | Token transfers contributing to a wallet's position in a currency (requires `contract_address` + `chain`) |

### Tokens

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v2/tokens/batch` | POST | Fetch multiple tokens in one request |
| `/api/v2/chain/{chain}/token/{address}/price_history` | GET | Token price history |
| `/api/v2/chain/{chain}/token/{address}/ohlcv` | GET | OHLCV candles for a token |
| `/api/v2/chain/{chain}/token/{address}/activity` | GET | Recent swap activity for a token |
| `/api/v2/chain/{chain}/token/{address}/holders` | GET | Paginated holders + aggregate distribution health |
| `/api/v2/chain/{chain}/token/{address}/liquidity-pools` | GET | Liquidity pools for a token |

### Tools

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v2/tools` | GET | List registered tools (sort by newest/oldest, filter by type) |
| `/api/v2/tools/search` | GET | Search tools by keyword, tags, creator, access type |
| `/api/v2/tools/{registry_chain}/{registry_addr}/{tool_id}` | GET | Get a specific registered tool |

### Assets

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v2/assets/transfer` | POST | Build transactions to transfer NFTs or tokens between wallets |

### Swap & Transactions

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v2/swap/quote` | GET | Get a single-asset swap quote |
| `/api/v2/swap/execute` | POST | Get executable transactions for a multi-asset swap |
| `/api/v2/transactions/receipt` | POST | Fetch transaction status (any tx type — sweep, swap, fulfillment) |

## Event Types

For the events endpoint, filter with `event_type`:
- `sale` - NFT sold
- `transfer` - NFT transferred
- `listing` - New listing created
- `offer` - New offer made
- `cancel` - Order cancelled
- `redemption` - NFT redeemed

## Rate Limits

All v2 endpoints require an API key. OpenSea uses a **token bucket** algorithm: your API key has a bucket of request tokens that refills over a fixed time window. Each request consumes one token. When the bucket is empty, the API returns `429 Too Many Requests`.

All API keys under the same account share a single rate limit bucket. Creating multiple API keys will not increase your overall rate limit.

### Default Rate Limits (Tier 1)

| Operation | Limit |
|-----------|-------|
| Read (GET) | 120 requests/minute |
| Write (POST) | 60 requests/minute |
| Fulfillment | 60 requests/minute |

Higher tiers are available for select users. You can apply for a rate limit increase via the [OpenSea Developer Portal](https://opensea.io/settings/developer).

### Rate Limit Response Headers

A `429` response includes these headers:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests allowed in the current time window |
| `X-RateLimit-Window` | Duration of the time window (e.g., `60s`) |
| `X-RateLimit-Remaining` | Requests remaining in the current window |
| `Retry-After` | Seconds to wait before retrying |

## Error Codes

| Code | Meaning |
|------|---------|
| 400 | Bad request - check parameters |
| 401 | Unauthorized - missing/invalid API key or Bearer token |
| 403 | Forbidden - valid auth but insufficient scopes |
| 404 | Resource not found |
| 429 | Rate limited |
| 500 | Server error |

## Tips

1. Use collection slugs (not addresses) for collection endpoints
2. Use chain identifiers for NFT/account endpoints
3. All timestamps are Unix epoch seconds
4. Prices are in wei (divide by 10^18 for ETH)
5. Use `jq` to parse JSON responses: `./script.sh | jq '.nft.name'`
