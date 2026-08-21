# NFT Operations Reference

Browse, purchase, sell, bid on, and manage NFTs across chains via OpenSea integration.

**Supported Chains**: Base, Ethereum, Polygon, Unichain, Arbitrum, and Robinhood Chain.

**World Chain and BNB Chain are not supported for NFTs** even though Bankr trades tokens on both — there's no marketplace coverage for them, so a collection on either chain is rejected rather than traded. (Solana NFTs are also outside these tools.)

## Operations

**Buy side**

- **Browse** - Search NFT collections
- **View Listings** - Find best deals and floor prices
- **Buy** - Purchase NFTs from marketplace listings
- **Make a collection-wide bid** - An offer good for *any* token in a collection
- **View your bids** - See the offers you've made
- **Cancel your collection bids** - Retract every open collection offer you have on a collection, in one transaction

**Sell side**

- **List for sale** - Put an NFT you own on the market
- **View your listings** - See your own live listings
- **Cancel listings** - Take one or more listings down
- **Check the best offer** - Ask what the highest live bid on an NFT is before selling
- **Accept Offer** - Accept an offer on an NFT you own

**Everything else**

- **View Holdings** - Check your NFT portfolio
- **Transfer** - Send NFTs to another wallet
- **Mint** - Mint from supported platforms (Manifold, SeaDrop)

## Offers and Bids

**Offers are always paid in an ERC-20, never in the chain's native token.** Seaport can't pull native value from the offerer, so a bid falls back to wrapped native — WETH on most chains — or to whatever currency the collection pins (USDG on some Robinhood Chain collections). The currency is per-collection, not per-chain. If your balance of that currency is short and it's WETH, Bankr wraps the difference from ETH as part of the same flow.

Other things to expect:

- **Price per item, not total.** A bid on several NFTs takes a per-item price and a quantity; Bankr multiplies.
- **OpenSea enforces per-collection minimums and bid increments**, so a very small offer can be rejected outright. Raise the amount rather than retrying the same price.
- **A live collection offer holds an ERC-20 approval open** until it's accepted, expires, or is cancelled.
- **Only collection-wide bids can be retracted through Bankr.** A bid on a single token has to be cancelled on OpenSea directly — Bankr will tell you so rather than promising a cancel it can't perform.
- **"No offers" is a normal answer.** Asking for the best offer on an NFT that has none returns exactly that, not an error.

Asking for offers has three distinct meanings, and they map to three different lookups: offers *you made* (your bids), the best offer *received* on an NFT you own, and your own *listings*. Say which you mean and Bankr picks the right one.

## Prompt Examples

**Browse NFTs:**
- "Find NFTs from the Bored Ape collection"
- "Show me trending NFT collections"
- "Search for Pudgy Penguins NFTs"
- "What are the top NFT collections on Base?"

**View listings:**
- "What's the floor price for Pudgy Penguins?"
- "Show cheapest NFTs in Azuki collection"
- "List all available Bored Apes under 50 ETH"
- "Show me the rarest items in [collection]"

**Buy NFTs:**
- "Buy the cheapest Bored Ape"
- "Purchase this NFT: [OpenSea URL]"
- "Buy Pudgy Penguin #1234"
- "Get the floor Azuki"

Listings priced in an **ERC-20** rather than the chain's native token — for example USDG listings on Robinhood Chain — are buyable the same way. Bankr submits the token approval the marketplace conduit needs, checks your balance of the payment currency before signing, and prices the listing using that token's decimals, so the quoted amount is the amount you pay. If a listing turns out to be stale, it moves on to the next one instead of failing the whole request.

**Sell — list, cancel, and check offers:**
- "List my Pudgy Penguin #1234 for 5 ETH"
- "List my Bored Ape for 30 ETH, expiring in a week"
- "Show my NFT listings"
- "Cancel my listing on Pudgy Penguin #1234"
- "What's the best offer on my Bored Ape?"
- "Accept the best offer on my Pudgy Penguin #1234"

**Bid on a collection:**
- "Bid 0.02 WETH on any okcomputers NFT"
- "Make an offer of 0.5 each for 3 Bored Apes, expiring in 2 days"
- "Show the offers I've made"
- "Show my bids on okcomputers"
- "Cancel my okcomputers bids"

**View holdings:**
- "Show my NFTs"
- "What NFTs do I own on Ethereum?"
- "My NFT collection on Base"
- "Show all my Pudgy Penguins"

**Transfer NFTs:**
- "Send my Bored Ape #123 to 0x..."
- "Transfer Pudgy Penguin to vitalik.eth"
- "Send NFT to @friend"

**Minting:**
- "Mint from [Manifold link]"
- "Mint 5 NFTs from this collection"

## Collection Resolution

Bankr resolves common names and abbreviations:

| Input | Resolved |
|-------|----------|
| "Bored Apes" / "BAYC" | boredapeyachtclub |
| "Pudgy Penguins" | pudgypenguins |
| "CryptoPunks" / "Punks" | cryptopunks |
| "Azuki" | azuki |
| "Doodles" | doodles-official |
| "Cool Cats" | cool-cats-nft |

## Chain Considerations

### Ethereum
- Most valuable blue-chip collections
- Highest liquidity
- Expensive gas fees
- Established marketplace

### Base
- Growing NFT ecosystem
- Very low gas fees
- Newer collections
- Good for emerging artists

### Polygon
- Gaming and metaverse NFTs
- Low gas fees
- Good for frequent trading
- Strong gaming communities

### Robinhood Chain
- Listings and offers are commonly denominated in **USDG**, not the native token
- Buying, listing, bidding, and accepting offers all work here — the ERC-20 payment currency is handled for you
- Very low gas fees

### Unichain, Arbitrum
- Supported by the same tools; collection depth varies by chain

## OpenSea Integration

Bankr uses OpenSea's marketplace:
- Real-time floor prices
- Verified collections
- Direct purchase links
- Rarity data
- Collection stats

## Common Issues

| Issue | Resolution |
|-------|------------|
| Collection not found | Try alternative names or contract address |
| NFT already sold | Try another listing or wait for new listings |
| Insufficient funds | Check balance including gas costs |
| High gas | Wait for lower gas or try L2 (Base/Polygon) |
| Unverified collection | Verify legitimacy before purchasing |
| Bid rejected as too low | OpenSea enforces per-collection minimums and increments — raise the amount, don't retry the same price |
| "You don't have enough WETH" on a bid | Bids are ERC-20; Bankr wraps ETH → WETH for you, but you still need the ETH to wrap |
| Can't cancel a bid | Only collection-wide bids are cancellable through Bankr; single-token bids must be cancelled on OpenSea |
| "Not supported by Bankr" on a collection | The collection is on World Chain or BNB Chain — no NFT marketplace coverage there, though token trading works |

## Safety Tips

1. **Verify collection** - Check official links and social media
2. **Check floor price** - Avoid overpaying, compare to floor
3. **Verified badge** - Look for OpenSea verified collections
4. **Gas costs** - Factor in gas, especially on Ethereum
5. **Research** - DYOR on collection before buying
6. **Scams** - Be wary of too-good-to-be-true deals
7. **Contract address** - Verify it matches official contract

## NFT Portfolio

View your holdings:
- Total NFT count by chain
- Estimated floor value
- Collection breakdown
- Recently acquired
- Rarest pieces

## Minting

For supported mint platforms:
- Manifold mints
- SeaDrop protocol
- Direct contract mints (if supported)

Provide the mint page URL and Bankr handles the transaction.

## Best Practices

1. **Start small** - Learn with cheaper NFTs first
2. **Research collections** - Check roadmap and community
3. **Compare prices** - Look at recent sales and floor
4. **Gas timing** - Mint/buy during low gas periods
5. **Hold long-term** - Most value comes from holding
6. **Diversify** - Don't put everything in one collection
