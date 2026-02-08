---
name: superbowl-squares
description: Claim boxes in onchain Super Bowl Squares contests on Base. Use when user wants to play Super Bowl squares, claim a box in a contest, join a squares game, or participate in football betting pools. Automatically handles entry fee token lookup, approval, and box claiming via Bankr wallet. If all boxes are sold out, checks OpenSea for secondary market listings.
---

# Super Bowl Squares

Claim boxes in onchain Super Bowl Squares contests on Base. The app is deployed at:
- Squares Contract: `0x55d8F49307192e501d9813fC4d116a79f66cffae`
- Boxes NFT: `0x7b02f27E6946b77F046468661bF0770C910d72Ef`
- OpenSea Collection: `super-bowl-squares-onchain`

## Quick Start

```bash
# Claim first available box in contest 74
./scripts/claim-box.sh 74

# Claim specific box 80 in contest 74 (auto-converts to 7480)
./scripts/claim-box.sh 74 80

# Or use full token ID directly
./scripts/claim-box.sh 74 7480

# Check OpenSea for boxes if sold out
./scripts/check-opensea-listings.sh 74
```

## Sold Out? Check OpenSea

If all boxes are sold out, check OpenSea for secondary listings:

```bash
./scripts/check-opensea-listings.sh <contest_id>
```

This will:
1. Query OpenSea for any listed boxes from the contest
2. Show price in ETH and USD
3. Show the box's grid position (row/col for score lookup)

## ⚠️ IMPORTANT: Always Confirm Before Buying

**Unless explicitly told to "buy all" or "grab them all", ALWAYS:**
1. Show the available boxes with prices
2. Ask the human if they want to buy
3. Wait for confirmation before purchasing

**Format when presenting listings:**
> "There's a box available on OpenSea:
> - **Box 46** (Row 4, Col 6) - 0.0001 ETH (~$0.20)
> 
> Do you want me to buy it?"

For multiple boxes:
> "Found 3 boxes available (all 0.0001 ETH / ~$0.20 each):
> - Box 23 (Row 2, Col 3)
> - Box 41 (Row 4, Col 1)  
> - Box 96 (Row 9, Col 6)
>
> Which ones do you want? Or say 'grab them all' to buy everything."

**Only auto-buy when human explicitly says:** "grab them all", "buy all", "get everything", etc.

To buy via OpenSea, use the opensea skill's fulfill-listing workflow:
1. Get the listing order hash from the check-opensea-listings output
2. Use `opensea-fulfill-listing.sh base <order_hash> <buyer_wallet>` to get tx data
3. Submit the transaction via Bankr

### Understanding Box Numbers

Each box is on a 10x10 grid. The box number (0-99) maps to:
- **Row** = box_number / 10 (0-9) → corresponds to one team's score digit
- **Col** = box_number % 10 (0-9) → corresponds to other team's score digit

Example: Box 52 = Row 5, Col 2. If rows are "KC" and cols are "SF", this box wins when KC's last digit is 5 and SF's last digit is 2 (scores like 35-12, 15-22, etc.)

The actual team assignments and random score mappings are revealed after the contest fills.

### After Buying via OpenSea

**Always call the cache-clear endpoint after a successful purchase:**

```bash
./scripts/notify-order-fulfilled.sh <order_hash> <contest_id> [chain_id]
```

This notifies the app to remove the listing from the UI so other users see updated availability.

Example:
```bash
./scripts/notify-order-fulfilled.sh 0x6d89... 2 8453
```

## Box Numbering

- Boxes 0-99 represent positions on the 10x10 grid
- Token IDs are `contestId * 100 + boxNumber` (e.g., contest 74, box 80 → token 7480)
- The script auto-converts: pass `80` and it becomes `7480` for contest 74

## How It Works

1. **Looks up contest data** - Gets entry fee token and amount from the contract
2. **Finds available box** - Checks which boxes are still owned by the contest contract
3. **Approves entry fee** - Submits ERC-20 approval via Bankr
4. **Claims the box** - Calls `claimBoxes()` via Bankr raw transaction

## Contest Structure

- Contest ID determines NFT ID range: Contest 74 → boxes 7400-7499
- Each contest has 100 boxes (10x10 grid)
- Entry fee varies by contest (token + amount stored in contract)
- Boxes are ERC-721 NFTs - once claimed, they're yours

## Prerequisites

- **Bankr wallet** with sufficient entry fee tokens
- **ETH on Base** for gas fees
- **js-sha3** npm package (auto-installed if missing)

## Manual Process

If the script fails, manually:

1. **Get contest data:**
   ```
   Call getContestData(contestId) on 0x55d8F49307192e501d9813fC4d116a79f66cffae
   ```

2. **Check box availability:**
   ```
   Call ownerOf(boxId) on 0x7b02f27E6946b77F046468661bF0770C910d72Ef
   Box is available if owned by contest contract or reverts
   ```

3. **Approve entry token:**
   ```
   approve(0x55d8F49307192e501d9813fC4d116a79f66cffae, entryAmount) on entry token
   ```

4. **Claim box:**
   ```
   claimBoxes([boxId], yourAddress) on 0x55d8F49307192e501d9813fC4d116a79f66cffae
   Function selector: 0x92a54cac
   ```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Box already claimed" | Choose different box number or let script find one |
| "Insufficient balance" | Buy more of the entry fee token |
| "Approval failed" | Check token balance and retry |
| "Transaction reverted" | Verify box is actually available |

## Links

- App: https://superbowlsquares.xyz (if available)
- Contract: https://basescan.org/address/0x55d8F49307192e501d9813fC4d116a79f66cffae
