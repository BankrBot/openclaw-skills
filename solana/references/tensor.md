# Tensor NFT Trading

Trade Solana NFTs on the leading marketplace.

## Overview

Tensor is the #1 NFT marketplace on Solana by volume. Features:
- Lowest fees (1.5% taker)
- AMM pools for instant liquidity
- Collection bids
- Advanced analytics

## Browsing

### Floor Prices

**Prompt examples:**
- "Show floor price for Mad Lads"
- "What's the floor on Okay Bears?"
- "Floor prices for top 10 Solana NFT collections"

### Trending Collections

- "What's trending on Tensor?"
- "Top collections by volume today"
- "Show new collections launching"

### Search

- "Search Tensor for frog NFTs"
- "Find cat-themed collections"
- "Collections under 1 SOL floor"

## Buying

### Buy Floor

**Prompt examples:**
- "Buy floor Mad Lad"
- "Purchase cheapest Okay Bear"
- "Buy the floor [collection_slug]"

### Buy Specific

- "Buy Mad Lad #1234"
- "Purchase Okay Bear with laser eyes trait"

### Sweep

- "Sweep 3 floor SMBs"
- "Buy 5 cheapest Claynosaurz"
- "Sweep floor up to 100 SOL total"

### With Price Limit

- "Buy floor Mad Lad under 200 SOL"
- "Sweep 3 Okay Bears max 50 SOL each"

## Selling

### List NFT

**Prompt examples:**
- "List my Mad Lad #1234 for 100 SOL"
- "List Okay Bear #5678 at floor + 10%"
- "List all my SMBs 5% above floor"

### Delist

- "Delist my Mad Lad"
- "Cancel listing for Okay Bear #5678"
- "Remove all my listings"

## Bidding

### Collection Bids

Place a bid that accepts any NFT from the collection.

**Prompt examples:**
- "Place collection bid on Mad Lads at 180 SOL"
- "Bid 45 SOL on any Okay Bear"
- "Collection bid 0.5 SOL on DeGods"

### Trait Bids

Bid on NFTs with specific traits.

- "Bid 250 SOL on Mad Lads with Alien skin"
- "Collection bid for Okay Bears with laser eyes"

### Managing Bids

- "Show my active bids"
- "Cancel my Mad Lads bid"
- "Cancel all bids"

## AMM Pools

Tensor AMM provides instant buy/sell liquidity.

### Selling to Pool

- "Instant sell my Mad Lad to pool"
- "Sell 3 Okay Bears to AMM"

**Note:** Pool prices may be below floor but offer instant execution.

### Pool Info

- "Show Mad Lads pool liquidity"
- "Best pool prices for Okay Bears"

## API Reference

### Get Collection Info
```bash
curl "https://api.tensor.so/graphql" \
  -H "Content-Type: application/json" \
  -d '{"query": "query { collection(slug: \"mad_lads\") { statsV2 { floor1h } } }"}'
```

### Get Listings
```bash
curl "https://api.tensor.so/graphql" \
  -H "Content-Type: application/json" \
  -d '{"query": "query { activeListings(slug: \"mad_lads\", limit: 10) { mint { onchainId } tx { grossAmount } } }"}'
```

### Buy NFT
```bash
scripts/solana-native.sh tensor buy <mint_address>
```

### List NFT
```bash
scripts/solana-native.sh tensor list <mint_address> <price_sol>
```

## Fees

| Fee Type | Amount |
|----------|--------|
| Taker fee | 1.5% |
| Maker fee | 0% |
| Royalties | Variable (optional) |

## Popular Collections

| Collection | Slug |
|------------|------|
| Mad Lads | mad_lads |
| Okay Bears | okay_bears |
| DeGods | degods |
| Claynosaurz | claynosaurz |
| Famous Fox Federation | famous_fox_federation |
| Tensorians | tensorians |

## Best Practices

1. **Check rarity** - Use Tensor's rarity tools before buying
2. **Set alerts** - Track floor movements
3. **Use collection bids** - Often better prices than floor
4. **Check royalties** - Some collections enforce royalties
5. **Verify authenticity** - Always check official collection addresses
