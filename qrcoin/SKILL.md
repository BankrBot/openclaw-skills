---
name: qrcoin
description: Interact with QR Coin auctions on Base. Use when the user wants to participate in qrcoin.fun QR code auctions — check auction status, view current bids, create new bids, or contribute to existing bids. QR Coin lets you bid to display URLs on QR codes; the highest bidder's URL gets encoded.
metadata: {"clawdbot":{"emoji":"📱","homepage":"https://qrcoin.fun","requires":{"bins":["curl","jq"]}}}
---

# QR Coin Auction

Participate in [QR Coin](https://qrcoin.fun) auctions on Base blockchain. QR Coin lets you bid to display URLs on QR codes — the highest bidder's URL gets encoded when the auction ends.

## Contracts (Base Mainnet)

| Contract | Address |
|----------|---------|
| QR Auction | `0x7309779122069EFa06ef71a45AE0DB55A259A176` |
| USDC | `0x833589fCD6eDb6E08f4c7c32D4f71b54bdA02913` |

## How It Works

1. Each auction runs for a fixed period (~24h)
2. Bidders submit URLs with USDC (6 decimals — 1 USDC = 1000000 units)
3. Creating a new bid costs ~11.11 USDC (createBidReserve)
4. Contributing to an existing bid costs ~1.00 USDC (contributeReserve)
5. Highest bid wins; winner's URL is encoded in the QR code
6. Losers get refunded; **winners receive attention** — their URL is displayed on the QR code for the duration of the next auction

> **Note**: Winners don't receive QR tokens — the reward is having your URL prominently displayed on the QR code, driving traffic and visibility to your project.

## Auction Status Queries

> **Note**: The examples below use `https://mainnet.base.org` (public RPC). You can substitute your own RPC endpoint if preferred.

### Get Current Token ID

Always query this first to get the active auction ID before bidding.

```bash
curl -s -X POST https://mainnet.base.org \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_call","params":[{"to":"0x7309779122069EFa06ef71a45AE0DB55A259A176","data":"0x7d9f6db5"},"latest"],"id":1}' \
  | jq -r '.result' | xargs printf "%d\n"
```

### Get Auction End Time

```bash
# First get the current token ID, then use it here
TOKEN_ID=329  # Replace with result from currentTokenId()
TOKEN_ID_HEX=$(printf '%064x' $TOKEN_ID)

curl -s -X POST https://mainnet.base.org \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_call","params":[{"to":"0x7309779122069EFa06ef71a45AE0DB55A259A176","data":"0xa4d0a17e'"$TOKEN_ID_HEX"'"},"latest"],"id":1}' \
  | jq -r '.result' | xargs printf "%d\n"
```

### Get Reserve Prices

```bash
# Create bid reserve (~11.11 USDC)
curl -s -X POST https://mainnet.base.org \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_call","params":[{"to":"0x7309779122069EFa06ef71a45AE0DB55A259A176","data":"0x5b3bec22"},"latest"],"id":1}' \
  | jq -r '.result' | xargs printf "%d\n" | awk '{print $1/1000000 " USDC"}'

# Contribute reserve (~1.00 USDC)
curl -s -X POST https://mainnet.base.org \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_call","params":[{"to":"0x7309779122069EFa06ef71a45AE0DB55A259A176","data":"0xda5a5cf3"},"latest"],"id":1}' \
  | jq -r '.result' | xargs printf "%d\n" | awk '{print $1/1000000 " USDC"}'
```

## Querying Current Bids

The contract provides several functions for querying bid data. These are essential for monitoring auction state and building competitive bidding strategies.

### Get All Bids

Returns an array of all current bids with their amounts, URLs, and contributor details.

**Function**: `getAllBids()`
**Selector**: `0xd5430d2d`
**Returns**: Array of Bid structs (totalAmount, urlString, contributions[])

```bash
# Using cast (foundry)
cast call 0x7309779122069EFa06ef71a45AE0DB55A259A176 "getAllBids()" --rpc-url https://mainnet.base.org

# Using web3.py
from web3 import Web3
w3 = Web3(Web3.HTTPProvider("https://mainnet.base.org"))
contract = w3.eth.contract(address="0x7309779122069EFa06ef71a45AE0DB55A259A176", abi=ABI)
bids = contract.functions.getAllBids().call()
```

### Get Specific Bid by URL

Check if a URL already has a bid and get its current amount.

**Function**: `getBid(string _urlString)`
**Selector**: `0x4de9e652`
**Returns**: Bid struct (totalAmount, urlString, contributions[])

```bash
# Using cast
cast call 0x7309779122069EFa06ef71a45AE0DB55A259A176 \
  "getBid(string)" "https://example.com" \
  --rpc-url https://mainnet.base.org
```

### Get Bid Count

Get the total number of bids in the current auction.

**Function**: `getBidCount()`
**Selector**: `0x4635256e`
**Returns**: uint256

```bash
curl -s -X POST https://mainnet.base.org \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_call","params":[{"to":"0x7309779122069EFa06ef71a45AE0DB55A259A176","data":"0x4635256e"},"latest"],"id":1}' \
  | jq -r '.result' | xargs printf "%d\n"
```

### Get Auction State

Get full auction details including highest bid, timing, and settlement status.

**Function**: `auction()`
**Selector**: `0x7d9f6db5`
**Returns**: (tokenId, highestBid, startTime, endTime, settled, qrMetadata)

```bash
cast call 0x7309779122069EFa06ef71a45AE0DB55A259A176 "auction()" --rpc-url https://mainnet.base.org
```

## Transactions via Bankr

QR Coin auctions require USDC transactions on Base. Use Bankr to execute these — Bankr handles:
- Function signature parsing and parameter encoding
- Gas estimation
- Transaction signing and submission
- Confirmation monitoring

### Step 1: Approve USDC (One-Time)

Before bidding, approve the auction contract to spend USDC:

```
Approve 50 USDC to 0x7309779122069EFa06ef71a45AE0DB55A259A176 on Base
```

### Step 2: Create a New Bid

To start a new bid for your URL:

**Function**: `createBid(uint256 tokenId, string url, string name)`
**Contract**: `0x7309779122069EFa06ef71a45AE0DB55A259A176`
**Cost**: ~11.11 USDC

> **Important**: Always query `currentTokenId()` first to get the active auction ID.

Example prompt for Bankr:
```
Send transaction to 0x7309779122069EFa06ef71a45AE0DB55A259A176 on Base
calling createBid(329, "https://example.com", "MyName")
```

### Step 3: Contribute to Existing Bid

To add funds to an existing URL's bid:

**Function**: `contributeToBid(uint256 tokenId, string url, string name)`
**Contract**: `0x7309779122069EFa06ef71a45AE0DB55A259A176`
**Cost**: ~1.00 USDC per contribution

Example prompt for Bankr:
```
Send transaction to 0x7309779122069EFa06ef71a45AE0DB55A259A176 on Base
calling contributeToBid(329, "https://grokipedia.com/page/debtreliefbot", "MerkleMoltBot")
```

## Function Selectors

| Function | Selector | Parameters |
|----------|----------|------------|
| `currentTokenId()` | `0x7d9f6db5` | — |
| `auctionEndTime(uint256)` | `0xa4d0a17e` | tokenId |
| `createBidReserve()` | `0x5b3bec22` | — |
| `contributeReserve()` | `0xda5a5cf3` | — |
| `createBid(uint256,string,string)` | `0xf7842286` | tokenId, url, name |
| `contributeToBid(uint256,string,string)` | `0x7ce28d02` | tokenId, url, name |
| `approve(address,uint256)` | `0x095ea7b3` | spender, amount |
| `getAllBids()` | `0xd5430d2d` | — |
| `getBid(string)` | `0x4de9e652` | urlString |
| `getBidCount()` | `0x4635256e` | — |
| `auction()` | `0x7d9f6db5` | — |

## Error Codes

| Error | Meaning | Solution |
|-------|---------|----------|
| `RESERVE_PRICE_NOT_MET` | Bid amount below minimum | Check reserve prices |
| `URL_ALREADY_HAS_BID` | URL already has a bid | Use `contributeToBid` instead |
| `BID_NOT_FOUND` | URL doesn't have existing bid | Use `createBid` instead |
| `AUCTION_OVER` | Current auction has ended | Wait for next auction |
| `AUCTION_NOT_STARTED` | Auction hasn't begun | Wait for auction to start |
| `INSUFFICIENT_ALLOWANCE` | USDC not approved | Approve USDC first |

## Typical Workflow

1. **Query `currentTokenId()`** — Get the active auction ID
2. **Check auction status** — Verify time remaining
3. **Approve USDC** — One-time approval for the auction contract
4. **Decide action**:
   - **New URL**: Use `createBid` (~11.11 USDC)
   - **Support existing URL**: Use `contributeToBid` (~1.00 USDC)
5. **Monitor** — Watch for outbids and contribute more if needed
6. **Win** — Your URL gets displayed on the QR code for the next auction period!

## Automated Bidding with HEARTBEAT.md

For agents that want to participate competitively in QR auctions, set up a `HEARTBEAT.md` file with monitoring and bidding logic. Here's a template strategy:

```markdown
# HEARTBEAT.md - QR Auction Monitor

## Instructions

Query auction state periodically and take action based on timing and position.

---

## Check Auction State

1. Query current auction: `getAllBids()` or use a helper script
2. Parse: tokenId, endTime, your bid's rank, leading bid amount

---

## PRE-AUCTION END (~1-2 hours before)

**Trigger:** Auction ACTIVE and timeRemaining < 2 hours

**Actions:**
1. Check your bid's current rank
2. If not in winning position and funds available:
   - Calculate amount needed to take the lead
   - Contribute additional USDC if within budget
3. Tweet/notify about auction ending soon (optional)
4. Update state to avoid duplicate actions

---

## POST-AUCTION START (~1 hour after new auction)

**Trigger:** New tokenId detected (higher than last tracked)

**Actions:**
1. Check wallet balance (ETH for gas, USDC for bidding)
2. If funds available:
   - Check if your URL already has a bid this auction
   - No existing bid → `createBid` with your URL
   - Existing bid → `contributeToBid` to increase position
3. Tweet about new auction participation (optional)
4. Update state with new tokenId

---

## Competitive Strategy Tips

- **Early bird**: Bid early to establish presence, but save reserves for final hours
- **Snipe defense**: Keep USDC approved and ready for last-minute contributions
- **Monitor rivals**: Track which URLs are gaining contributions
- **Budget wisely**: Set a max spend per auction to avoid overspending
- **Collaborate**: Multiple agents can contribute to the same URL

---

## State Tracking

Track in a JSON file to avoid duplicate actions:

```json
{
  "lastPreActionTokenId": 333,
  "lastPostActionTokenId": 333,
  "lastBidTokenId": 333,
  "totalSpentUsdc": 150.00
}
```

---

## Quiet Hours

Skip non-urgent actions during off-hours (e.g., 23:00-07:00 local) unless auction ending imminently.

## If Nothing To Do

Reply: HEARTBEAT_OK
```

### Key Considerations for Automated Bidding

1. **Wallet Setup**: Pre-fund your agent's wallet with ETH (gas) and USDC
2. **USDC Approval**: Approve enough USDC upfront for multiple bids
3. **State Persistence**: Track actions to prevent duplicate bids
4. **Budget Limits**: Set maximum spend per auction
5. **Error Handling**: Handle RPC failures and transaction reverts gracefully

## Links

- **Platform**: https://qrcoin.fun
- **Auction Contract**: [BaseScan](https://basescan.org/address/0x7309779122069EFa06ef71a45AE0DB55A259A176)
- **USDC on Base**: [BaseScan](https://basescan.org/token/0x833589fCD6eDb6E08f4c7c32D4f71b54bdA02913)

## Tips

- **Start small**: Contribute to existing bids (~1 USDC) to learn the flow
- **Check timing**: Auctions have fixed end times; plan accordingly
- **Monitor bids**: Others can outbid you; watch the auction
- **Use Bankr**: Let Bankr handle transaction signing and execution
- **Specify Base**: Always include "on Base" when using Bankr
- **Visibility is the prize**: Remember, winning = your URL on the QR code

---

**💡 Pro Tip**: Contributing to an existing bid is cheaper than creating a new one. Check if someone already bid for your URL before creating a new bid.
