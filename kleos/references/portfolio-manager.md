# Portfolio Manager Strategy

Track, manage, and optimize an NFT portfolio — including PnL calculation, floor alerts, offer management, and collection rebalancing.

## Portfolio Overview

### View Full Portfolio

```
Prompt: "show my NFT portfolio"
Prompt: "what's my NFT portfolio worth?"
```

**Agent steps:**
1. Run `"show my NFTs"` to get all owned NFTs across chains
2. For each NFT: get current floor price of its collection
3. Read `/.memory/nft-activity.md` for buy/mint prices
4. Calculate unrealized PnL for each NFT
5. Present a structured portfolio view

### Portfolio Display Template

Present the user with a clear table:

```
📊 NFT Portfolio Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Chain: Base
  🖼️ [Collection A]
     - Token #123 | Bought: 0.1 ETH | Floor: 0.15 ETH | PnL: +0.05 ETH (+50%)
     - Token #456 | Bought: 0.12 ETH | Floor: 0.10 ETH | PnL: -0.02 ETH (-17%)

  🖼️ [Collection B]
     - Token #789 | Minted: 0.05 ETH | Floor: 0.20 ETH | PnL: +0.15 ETH (+300%)

Chain: Ethereum
  🖼️ [Collection C]
     - Token #001 | Bought: 0.5 ETH | Floor: 0.45 ETH | PnL: -0.05 ETH (-10%)
     - Token #002 | Bought: 0.5 ETH | Floor: 0.55 ETH | PnL: +0.05 ETH (+10%)

━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Invested: 1.27 ETH
Total Current Value: 1.45 ETH
Unrealized PnL: +0.18 ETH (+14.2%)
NFTs Owned: 5 across 3 collections, 2 chains
```

### Chain-Specific Portfolio

```
Prompt: "show my NFT portfolio on base"
Prompt: "what NFTs do I own on ethereum?"
```

Filter the portfolio view to a specific chain.

### Collection-Specific Breakdown

```
Prompt: "show my [collection] position"
Prompt: "how are my [collection] NFTs doing?"
```

Show detailed view for one collection: each NFT with PnL, floor comparison, and listing status.

## Floor Price Alerts

Set up monitoring for price movements:

### Price Drop Alert
```
Prompt: "alert me if [collection] floor drops below [X] ETH"
```

Set up automation:
```
"every hour, check [collection] floor. Alert me if it drops below [X] ETH."
```

### Price Pump Alert
```
Prompt: "alert me if [collection] floor goes above [X] ETH"
```

### Percentage-Based Alerts
```
Prompt: "alert me if [collection] floor moves more than 20% in either direction"
```

### Automated Alerts via Bankr Automations

The agent sets these as Agent Command automations:
```
"every 30 minutes, check the floor of [collection] and compare to my buy price. Alert me if PnL exceeds +50% or drops below -20%."
```

Remind users about automation limits (5 standard, 20 Bankr Club).

## Listing Management

### List All from Collection

```
Prompt: "list all my [collection] NFTs at floor price"
Prompt: "list all my [collection] at 10% above floor"
```

**Agent steps:**
1. Get all owned NFTs from the collection
2. Get current floor price
3. Calculate listing prices (floor, floor + X%, or custom)
4. Show summary: "Listing [N] NFTs from [collection] at [X] ETH each"
5. Execute listings one at a time
6. Log each listing to activity file

### Undercut Protection

```
Prompt: "keep my [collection] NFTs listed at the lowest price"
```

Set up automation:
```
"every 15 minutes, check if any of my [collection] listings are above floor by more than 2%. If so, cancel and relist at floor + 1%."
```

### Bulk Cancel Listings

```
Prompt: "cancel all my [collection] listings"
Prompt: "cancel all my NFT listings"
```

### Listing Optimization

```
Prompt: "optimize my NFT listings — list the rare ones higher, commons at floor"
```

**Agent steps:**
1. Get all owned NFTs and their traits/rarity (use browser automation on OpenSea or rarity tools)
2. Categorize: rare traits → premium listing, commons → floor listing
3. Show proposed pricing to user
4. Execute listings after confirmation

## Offer Management

### View Offers

```
Prompt: "show offers on my NFTs"
Prompt: "what offers do I have on my [collection]?"
Prompt: "best offer for my [collection] #ID?"
```

### Accept Offers

```
Prompt: "accept the best offer on my [collection]"
Prompt: "accept all offers above [X] ETH on my NFTs"
```

**Agent steps:**
1. Get all open offers
2. Filter by threshold
3. Show summary: "Accepting [N] offers totaling [X] ETH"
4. Ask confirmation
5. Accept offers one at a time
6. Log to activity file

### Make Offers (Collection Bidding)

```
Prompt: "offer [X] ETH on the cheapest [collection]"
Prompt: "bid [X] ETH on [collection] #ID"
```

Note: Making offers on specific NFTs is supported via OpenSea. Making collection offers (bidding on any NFT from a collection) may require browser automation if not natively supported.

## Profit/Loss Tracking

### Realized PnL

```
Prompt: "show my NFT trading PnL"
Prompt: "how much profit have I made from NFTs?"
```

**Agent steps:**
1. Read all entries from `/.memory/nft-activity.md`
2. Calculate: total bought, total sold, fees paid
3. Show: Realized PnL = Total Sold - Total Bought - Gas Fees
4. Show: Unrealized PnL from current holdings
5. Show: Best and worst performing trades

### Collection PnL

```
Prompt: "show PnL for [collection] trades"
```

Filter PnL to a specific collection.

### Tax Summary (US)

```
Prompt: "summarize my NFT trades for tax purposes"
```

Show: total proceeds, cost basis, realized gains/losses, by tax year.

## Portfolio Rebalancing

### Sell Underperformers

```
Prompt: "sell my worst performing NFTs"
Prompt: "cut losses on NFTs down more than 50%"
```

**Agent steps:**
1. Calculate unrealized PnL for each NFT
2. Identify those below the loss threshold
3. Show list with current floor and loss amount
4. Ask confirmation before listing

### Take Profits

```
Prompt: "take profits on NFTs up more than 100%"
Prompt: "sell half my [collection] to lock in gains"
```

### Consolidation

```
Prompt: "sell my small NFTs and buy one blue chip"
Prompt: "consolidate my portfolio into top collections"
```

## Watchlist Management

### Add to Watchlist

```
Prompt: "add [collection] to my NFT watchlist"
Prompt: "watch [collection A], [collection B], [collection C]"
```

Save to `/.memory/nft-watchlist.md`:
```markdown
## Watchlist
- [Collection Name] — [Contract/OpeanSea slug] — [Chain] — Added: [Date] — Notes: [Why watching]
```

### View Watchlist

```
Prompt: "show my NFT watchlist"
Prompt: "what collections am I watching?"
```

Read from `/.memory/nft-watchlist.md` and show with current floor prices.

### Watchlist Floor Check

```
Prompt: "check floors on my watchlist"
```

Get current floor for all watchlisted collections, show changes since last check.

### Remove from Watchlist

```
Prompt: "remove [collection] from my watchlist"
```

## Memory File Templates

### `/.memory/nft-activity.md`
Maintain a chronological log. After each action, append. See `floor-sweeper.md` and `mint-sniper.md` for sell/buy/mint templates. For listings:

```markdown
### [Timestamp]
- **Action**: List
- **Collection**: [Name]
- **Token ID**: [#]
- **List Price**: [X] ETH
- **Floor at List**: [Y] ETH
```

For sold:
```markdown
### [Timestamp]
- **Action**: Sold
- **Collection**: [Name]
- **Token ID**: [#]
- **Sale Price**: [X] ETH
- **Buy Price**: [Y] ETH
- **PnL**: [+/-Z ETH] ([+/-%])
- **Hold Time**: [N] days
- **Tx Hash**: [hash]
```

### `/.memory/nft-targets.md`
```markdown
## Active Profit Targets
- [Collection] #ID — Buy: [X] ETH — Target: [Y] ETH (+[Z]%) — Status: [Listed/Not Listed]
- [Collection] #ID — Buy: [X] ETH — Target: [Y] ETH (+[Z]%) — Status: [Listed/Not Listed]

## Active Stop Losses
- [Collection] #ID — Buy: [X] ETH — Stop: [Y] ETH (-[Z]%) — Status: [Active/Triggered]
```

## Edge Cases

- **Delisted NFTs**: If a previously owned NFT no longer shows in `"show my NFTs"`, it was transferred or sold outside Bankr. Mark as "Transferred Out" in activity log.
- **Zero-value collections**: Warn if a collection has no recent sales or floor = 0.
- **Hidden/suspicious collections**: If OpenSea hides a collection, warn the user before any interaction.
- **Cross-chain confusion**: Same collection name on different chains? Always confirm the chain with the user.