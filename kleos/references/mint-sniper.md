# Mint Sniper Strategy

Mint sniping is identifying promising NFT collections before or at launch and minting quickly. This covers research, monitoring, and automated mint execution via Bankr.

## Discovery: Finding Mints

### Built-in Bankr Tools

Use Bankr's native mint discovery:
```
"what's minting today?"
"show featured NFT mints"
"trending NFT collections"
```

### Browser Automation for Research

When the user asks to research upcoming mints, use Bankr's browser automation to check:

1. **OpenSea Drops calendar**: Navigate to `opensea.io/drops` for upcoming mints
2. **Manifold**: Check for active and upcoming mints
3. **Collection Twitter/X**: Check the project's social media for mint announcements
4. **Discord announcements**: If the user has access, check project Discord for mint details

### Discovery Automation

Set up recurring mint discovery:
```
"every day at 8am, check what's minting today and show me promising drops"
```

## Pre-Mint Research Checklist

Before suggesting a mint, evaluate these factors:

### Must Check
1. **Collection legitimacy**: Is it a known artist/project or random drop?
2. **Supply**: Total supply — lower = more scarce, but too low = illiquid
3. **Mint price**: Free mint? Paid? How much?
4. **Chain**: Prefer gas-sponsored chains (Base, Unichain) for lower costs
5. **Social presence**: Check Twitter followers, Discord members, engagement
6. **Team**: Anonymous or doxxed? Known in the space?

### Red Flags to Warn About
- No social media presence or brand new accounts
- Unrealistic promises ("guaranteed 10x")
- No revealed art before mint
- Contract not verified
- Copycat names (e.g., "Bored Ape Yatch Club" instead of "Bored Ape Yacht Club")

## Mint Execution

### Standard Mint

```
Prompt: "mint from [manifold/seadrop link]"
Prompt: "mint this NFT: https://app.manifold.xyz/..."
```

**Agent steps:**
1. Verify the mint link is valid
2. Show user: collection name, mint price, chain, quantity
3. Ask how many to mint (default: 1)
4. Confirm total cost (mint price + gas)
5. Execute mint via Bankr's mint tool
6. Log to `/.memory/nft-activity.md`

### Bulk Mint

```
Prompt: "mint 5 from [collection link]"
```

**Agent steps:**
1. Verify mint allows multiple mints per wallet
2. Calculate total cost: (mint price × quantity) + estimated gas
3. Show summary and ask confirmation
4. Execute mints
5. Log each mint

### Auto-Mint Setup

For collections that haven't launched yet:

```
Prompt: "monitor [collection] and auto-mint when it goes live"
```

**Agent steps:**
1. Save collection to `/.memory/nft-watchlist.md` with mint date if known
2. Set up Browser Automation: navigate to the mint page at regular intervals
3. When mint is live → alert user, then mint if auto-mint is confirmed
4. Set up automation:
   ```
   "every hour, check if [collection] mint is live at [URL]"
   ```

## Post-Mint Strategy

### Immediate Actions After Mint
1. **Reveal check**: If art hasn't been revealed, note the reveal date
2. **Floor monitoring**: Set up automation for the first 24h:
   ```
   "every 30 minutes for the next 24 hours, check [collection] floor price"
   ```
3. **List or hold**: Discuss with the user:
   - If floor > 2x mint: consider listing some
   - If floor < mint: hold or set stop loss
   - If unrevealed: usually hold until reveal

### Reveal Sniping
For unrevealed collections, the reveal event often causes price movement:
```
"alert me when [collection] reveals and show the new floor price"
```

## Mint Sniper Automation Template

Full automation setup for a planned mint:

```
"Set up mint monitoring for [collection]:
1. Check [mint URL] every 30 minutes starting [date/time]
2. If mint is live, mint [N] NFTs
3. After minting, monitor floor price every 15 minutes for 2 hours
4. Alert me if floor drops below mint price, or if floor exceeds 2x mint"
```

## Fee-Aware Minting

Remind users about fees:
- Manifold/SeaDrop mint fees vary by creator
- Gas fees on Ethereum can be significant — prefer Base/Unichain mints
- Some collections charge a platform fee on top of mint price

## Logging Template

After each mint, append to `/.memory/nft-activity.md`:

```markdown
### [Timestamp]
- **Action**: Mint
- **Collection**: [Name]
- **Platform**: [Manifold/SeaDrop/Other]
- **Chain**: [base/ethereum/polygon/unichain]
- **Quantity**: [N]
- **Mint Price**: [X] ETH each
- **Total Cost**: [Y] ETH (including gas)
- **Tx Hashes**: [list]
- **Reveal**: [Date or "N/A"]
```

## Edge Cases

- **Mint not live yet**: Save to watchlist. Don't spam — max check every 30 min.
- **Mint sold out**: Alert user immediately. Suggest checking secondary market floor.
- **Gas war**: If gas spikes during a hyped mint, warn user before executing. Show estimated gas vs mint price ratio.
- **Failed transaction**: Retry once with higher gas. If fails again, report to user with the error.
- **Unknown platform**: If the mint link isn't Manifold or SeaDrop, use browser automation to inspect the page and guide the user manually.