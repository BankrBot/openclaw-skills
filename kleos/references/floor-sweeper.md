# Floor Sweeper Strategy

Floor sweeping is buying the cheapest available NFTs from a collection — either a single floor item or multiple in bulk. This workflow covers both manual and automated floor sweeping via Bankr.

## Pre-Sweep Checklist

Before sweeping any collection, do this research flow:

1. **Check the collection**: `"show the floor price for [collection]"` and `"search for [collection]"` — verify it's the correct collection, not a copycat
2. **Check floor trend**: Ask `"show [collection] chart"` or use browser automation to check recent sales on OpenSea to see if floor is rising or falling
3. **Check liquidity**: How many listings near floor? Low liquidity means higher slippage
4. **Set budget**: Confirm with the user how much they want to spend (ETH amount or number of NFTs)
5. **Set profit target**: Agree on exit strategy — sell at X% above floor, or hold

## Single Floor Buy

Simplest case — buy the cheapest NFT from a collection:

```
Prompt: "buy the cheapest [collection]"
Prompt: "buy floor [collection]"
```

**Agent steps:**
1. Search for the collection to get correct contract/OpenSea slug
2. Show the user: current floor price, number of listings at floor, the specific NFT details
3. Ask for confirmation
4. Execute buy via Bankr's NFT buy tool
5. Log to `/.memory/nft-activity.md` with: timestamp, collection, token ID, price, tx hash

## Multi-Floor Sweep (Batch Buy)

Buy multiple floor NFTs from one collection:

```
Prompt: "sweep 5 floor [collection]"
Prompt: "buy the 3 cheapest [collection] NFTs"
```

**Agent steps:**
1. Search collection and check floor + available listings
2. Show the user a summary: "Buying 5 floor NFTs from [collection]. Estimated cost: [total] ETH + gas. Current floor: [X] ETH."
3. Warn if buying multiple will push the floor up significantly
4. Ask for confirmation
5. Execute buys one at a time (buy the cheapest, then re-check floor for the next)
6. After each buy: log to activity file, update remaining budget
7. Summary after completion: total spent, average price, new floor price

## Multi-Collection Sweep

Sweep floors across multiple collections:

```
Prompt: "sweep the floor of [collection A], [collection B], and [collection C]"
Prompt: "buy 1 floor from each of my watchlist collections"
```

**Agent steps:**
1. Read `/.memory/nft-watchlist.md` if user references watchlist
2. For each collection: check floor, show the NFT, ask per-collection or batch confirmation
3. Execute buys
4. Log each buy separately

## Auto-Profit Strategy

Set up automated profit-taking using Bankr automations:

```
Prompt: "sweep the floor of [collection] and automatically list it for 2x"
Prompt: "buy floor [collection] and set a sell order at 50% profit"
```

**Agent steps:**
1. Buy the floor NFT(s)
2. Immediately list them at the profit target price
3. Set up a price alert automation:
   ```
   "every hour, check if [collection] floor is below [X] ETH. If yes, alert me."
   ```
4. Log profit targets to `/.memory/nft-targets.md`

## Auto-Relist Strategy

Keep NFTs listed at optimal prices — relist if undercut:

```
Prompt: "keep my [collection] listed at floor price, relist if I get undercut"
```

Use Bankr automations:
```
"every 30 minutes, check the floor price of [collection]. If my listing is above floor by more than 5%, cancel and relist at floor."
```

## Risk Management

### Stop Loss
If a collection floor crashes, exit quickly:
```
Prompt: "set a stop loss on my [collection] — if floor drops below [X] ETH, list all mine at floor immediately"
```

Agent automation:
```
"every 15 minutes, check [collection] floor. If floor dropped more than [Y]% from my buy price, list all my [collection] NFTs at current floor."
```

### Max Spend Limits
Always track total spend and warn the user:
- If they're about to spend >50% of their ETH balance on NFTs
- If a single sweep would buy more than 5 floor NFTs and push the price up

### Collection Health Checks
Before large sweeps, warn the user about:
- Collections with <50 items listed near floor (low liquidity)
- Collections where the floor dropped >20% in 24h
- New collections (<7 days old) with no trading volume

## Logging Template

After each sweep, append to `/.memory/nft-activity.md`:

```markdown
### [Timestamp]
- **Action**: Floor Sweep
- **Collection**: [Name] ([Contract])
- **Chain**: [base/ethereum/polygon/unichain]
- **Quantity**: [N] NFTs
- **Total Cost**: [X] ETH
- **Avg Price**: [Y] ETH per NFT
- **Floor at Buy**: [Z] ETH
- **Tx Hashes**: [list]
- **Profit Target**: [X] ETH / [Y]% (if set)
- **Stop Loss**: [X] ETH / [Y]% (if set)
```

## Profit Taking

When the user wants to sell:

```
Prompt: "sell all my [collection] NFTs at floor"
Prompt: "list all my [collection] at 1.5x my buy price"
```

**Agent steps:**
1. Read `/.memory/nft-activity.md` and `/.memory/nft-targets.md`
2. Show current market: floor price, my buy price, current PnL
3. Execute listings or accept best offers
4. Log sales to activity file
5. Calculate realized PnL and report to user

## Edge Cases

- **Floor moves while sweeping**: After each buy, re-check floor before buying the next one. If floor jumped >10%, pause and ask the user.
- **Insufficient balance**: Calculate total including gas before sweeping. Warn if balance is tight.
- **Collection not found**: Try multiple search queries. If still not found, ask for OpenSea link.
- **Gas spike**: On Ethereum mainnet, check current gas before sweeping. If >100 gwei, suggest waiting or using a different chain.