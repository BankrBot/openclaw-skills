---
name: superbowl-squares
description: Claim boxes in onchain Super Bowl Squares contests on Base. Use when user wants to play Super Bowl squares, claim a box in a contest, join a squares game, or participate in football betting pools. Automatically handles entry fee token lookup, approval, and box claiming via Bankr wallet.
---

# Super Bowl Squares

Claim boxes in onchain Super Bowl Squares contests on Base. The app is deployed at:
- Squares Contract: `0x55d8F49307192e501d9813fC4d116a79f66cffae`
- Boxes NFT: `0x7b02f27E6946b77F046468661bF0770C910d72Ef`

## Quick Start

```bash
# Claim first available box in contest 74
./scripts/claim-box.sh 74

# Claim specific box 7410
./scripts/claim-box.sh 74 7410
```

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
