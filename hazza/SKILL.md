---
name: hazza
description: Register, buy, sell, and manage hazza.name — immediately useful onchain names on Base. Check availability, register names, buy/list on marketplace, set agent bounties, set profile records.
---

# hazza — Onchain Names on Base

Register immediately useful names on Base for your users. Each name is an ERC-721 NFT at `name.hazza.name` with a profile page, text records, and multi-chain addresses. Powered by x402, XMTP and Net Protocol.

## Command Format

Users request names using the full domain:

```
register brian.hazza.name
```

Parse the name by stripping `.hazza.name` from the end. The registerable name is the part before the first dot. Names must be lowercase ASCII: a-z, 0-9, hyphens. 3-63 characters. No leading/trailing hyphens, no consecutive hyphens. No spaces, no emojis, no uppercase.

## Quick Start

### 1. Check Availability

```bash
curl -s https://hazza.name/api/available/brian
```

Returns `{"available": true}` or `{"available": false, "owner": "0x..."}`.

### 2. Check Price

```bash
curl -s "https://hazza.name/api/quote/brian?wallet=USER_WALLET_ADDRESS"
```

Returns `{"total": "5", "totalRaw": "5000000", "registrationFee": "5", "lineItems": [...]}`. A `totalRaw` of `"0"` means the name is free for this wallet. Amounts in `total` and `registrationFee` are human-readable USD; `totalRaw` is USDC with 6 decimals.

### 3. Check Free Claim Eligibility

```bash
curl -s https://hazza.name/api/free-claim/USER_WALLET_ADDRESS
```

Returns whether the user qualifies for a free registration (first name per wallet, or Unlimited Pass holder's bonus free name).

### 4. Register via x402

```bash
curl -s -X POST https://hazza.name/x402/register \
  -H "Content-Type: application/json" \
  -d '{"name": "brian", "owner": "USER_WALLET_ADDRESS"}'
```

**If the name is free** for this wallet → returns success immediately with `{name, owner, tokenId, registrationTx, profileUrl}`.

**If payment is required** → returns HTTP 402 with payment details:

```json
{
  "accepts": [{
    "scheme": "exact",
    "maxAmountRequired": "5000000",
    "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "payTo": "RELAYER_ADDRESS",
    "network": "base"
  }]
}
```

To complete payment:

1. Transfer the exact USDC amount to the `payTo` address on Base
2. Retry the same POST with the payment header:

```bash
curl -s -X POST https://hazza.name/x402/register \
  -H "Content-Type: application/json" \
  -H "X-PAYMENT: BASE64_ENCODED_PAYMENT" \
  -d '{"name": "brian", "owner": "USER_WALLET_ADDRESS"}'
```

The `X-PAYMENT` header is Base64-encoded JSON: `{"scheme":"exact","txHash":"0x...","from":"USER_WALLET_ADDRESS"}`

### 5. Set Profile Records (Optional)

After registration, the user can set text records via the manage page at `https://hazza.name/manage` (connect wallet, select name, edit records, sign transaction).

The write API requires an API key and returns unsigned transactions:

```bash
curl -s -X POST https://hazza.name/api/text/brian \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer API_KEY" \
  -d '{"key": "description", "value": "Builder on Base"}'
```

Returns `{name, key, value, tx}` — the `tx` object must be signed and submitted by the name owner.

## Pricing

| Situation | Cost |
|-----------|------|
| First name per wallet | **FREE** (gas only) |
| Unlimited Pass holder — 2nd name | **FREE** (gas only) |
| Paid names 1-3 (per wallet, 90-day window) | $5 USDC |
| Paid names 4-5 | $12.50 USDC |
| Paid names 6-7 | $25 USDC |
| Paid names 8+ | $50 USDC |
| Unlimited Pass discount | 20% off all paid tiers |

Free registrations do not count toward the progressive pricing tiers. If a user gets 2 free names, their next 3 paid names are still at the $5 tier.

Names are permanent — no renewals, no expiry. Pay once, own forever.

## Marketplace — Buy & Sell Names

hazza names trade on the Seaport protocol (same as OpenSea) via the Net Protocol Bazaar. The hazza API handles all Seaport complexity — you never need to decode raw order parameters yourself.

### Browse Listings

```bash
curl -s https://hazza.name/api/marketplace/listings
```

Returns:

```json
{
  "listings": [
    {
      "name": "example",
      "tokenId": "42",
      "seller": "0x...",
      "price": 0.01,
      "priceRaw": "10000000000000000",
      "currency": "ETH",
      "listingExpiry": "2026-04-01T00:00:00Z",
      "orderHash": "0xabc123...",
      "isNamespace": false,
      "avatar": "https://...",
      "profileUrl": "https://example.hazza.name",
      "orderComponents": { ... }
    }
  ],
  "total": 1
}
```

Listings include `orderComponents` (the full Seaport order) but you do NOT need to use them directly. Use the fulfill endpoint instead.

### Buy a Listed Name (2-Step)

**Step 1 — Get the transaction data:**

```bash
curl -s -X POST https://hazza.name/api/marketplace/fulfill \
  -H "Content-Type: application/json" \
  -d '{"orderHash": "0xabc123...", "buyerAddress": "BUYER_WALLET"}'
```

Returns the exact transactions to execute:

```json
{
  "approvals": [
    {
      "to": "0x...",
      "data": "0x095ea7b3...",
      "value": "0",
      "spender": "0x...",
      "amount": "10000000000000000"
    }
  ],
  "fulfillment": {
    "to": "0x0000000000000068F116a894984e2DB1123eB395",
    "data": "0xb3a34c4c...",
    "value": "10000000000000000"
  }
}
```

**Step 2 — Execute the transactions:**

1. If `approvals` is non-empty, send each approval transaction first (these approve token spending)
2. Send the `fulfillment` transaction — this is the actual Seaport purchase

The `fulfillment.to` is the Seaport contract (`0x0000000000000068F116a894984e2DB1123eB395`). The `data` is the complete Seaport calldata. The `value` is the ETH amount to send (for ETH-priced listings).

**Important:** The fulfillment data is ready to use as-is. Do NOT try to decode or reconstruct Seaport orders. The API does all the heavy lifting.

### Browse Collection Offers

```bash
curl -s https://hazza.name/api/marketplace/offers
```

Returns active offers on any hazza name.

### Accept an Offer (Seller Flow)

```bash
curl -s -X POST https://hazza.name/api/marketplace/fulfill-offer \
  -H "Content-Type: application/json" \
  -d '{"orderHash": "0x...", "tokenId": "42", "sellerAddress": "SELLER_WALLET"}'
```

Returns the same `{approvals, fulfillment}` format. The seller executes these transactions to accept the offer and transfer their name.

### List a Name for Sale (Seaport + Bazaar)

All listings go through Seaport and the Net Protocol Bazaar. This ensures every listing appears on **both** hazza.name/marketplace and netprotocol.app/bazaar simultaneously.

**How it works:**
1. Seller approves Seaport to transfer the NFT (`setApprovalForAll`)
2. Seller signs an EIP-712 Seaport order (offer = NFT, consideration = ETH payment)
3. Seller submits the signed order to the Bazaar contract
4. Listing is live everywhere

The hazza.name UI handles all of this — users just enter a price and sign.

### Agent Bounty

When listing, the seller can optionally set an agent bounty. The bounty comes out of the sale price. The bounty ETH is held by the Bounty Escrow contract (`0x95a29AD7f23c1039A03de365c23D275Fc5386f90`) until the name sells or the seller cancels.

**How it works:**
- Seller sets a bounty amount when listing — the ETH is held until the sale completes or the listing is cancelled
- Agents register on the bounty for the name (self-registered agents expire after 24 hours, seller-assigned agents never expire)
- When the name sells, the agent claims the bounty
- If the seller cancels or no agent claims, the bounty is returned to the seller

**Example:** List "coolname" for 0.1 ETH with a 0.01 ETH bounty. Name sells for 0.1 ETH. Seller nets 0.09 ETH (sale price minus bounty). Agent earns 0.01 ETH. If no agent claims, the bounty is returned.

### Bounty Escrow API

All bounty operations are available as unsigned transaction endpoints from the worker:

```bash
# Check if a name has a bounty
curl -s https://hazza.name/api/bounty/TOKEN_ID

# Check pending withdrawals for an address
curl -s https://hazza.name/api/bounty/pending/ADDRESS

# Register a bounty (returns unsigned tx — send with ETH value)
curl -s -X POST https://hazza.name/api/bounty/register \
  -H "Content-Type: application/json" \
  -d '{"tokenId": "TOKEN_ID", "bountyAmountWei": "10000000000000000"}'

# Register as agent for a bounty
curl -s -X POST https://hazza.name/api/bounty/register-agent \
  -H "Content-Type: application/json" \
  -d '{"tokenId": "TOKEN_ID", "agentAddress": "0x..."}'

# Claim bounty after sale
curl -s -X POST https://hazza.name/api/bounty/claim \
  -H "Content-Type: application/json" \
  -d '{"tokenId": "TOKEN_ID"}'

# Cancel bounty (seller only)
curl -s -X POST https://hazza.name/api/bounty/cancel \
  -H "Content-Type: application/json" \
  -d '{"tokenId": "TOKEN_ID"}'

# Withdraw bounty ETH (seller, only when no agent active)
curl -s -X POST https://hazza.name/api/bounty/withdraw-bounty \
  -H "Content-Type: application/json" \
  -d '{"tokenId": "TOKEN_ID"}'

# Withdraw pending payouts
curl -s -X POST https://hazza.name/api/bounty/withdraw \
  -H "Content-Type: application/json" \
  -d '{"address": "0x..."}'
```

### Cancel a Listing

```bash
curl -s -X POST https://hazza.name/api/marketplace/cancel \
  -H "Content-Type: application/json" \
  -d '{"orderHash": "0xabc123..."}'
```

Returns an unsigned Seaport cancel transaction. The seller's wallet must execute it (only the original offerer can cancel).

```json
{
  "cancel": { "to": "0x0000000000000068F116a894984e2DB1123eB395", "data": "0x...", "value": "0" },
  "listing": { "orderHash": "0xabc123...", "name": "coolname", "tokenId": "42", "offerer": "0x..." }
}
```

### Edit a Listing (Cancel + Relist)

Seaport has no native edit — editing means cancelling the old order and creating a new one. This endpoint handles both in one call.

```bash
curl -s -X POST https://hazza.name/api/marketplace/edit \
  -H "Content-Type: application/json" \
  -d '{"orderHash": "0xabc123...", "sellerAddress": "0x...", "newPriceWei": "200000000000000000"}'
```

Accepts: `orderHash` (required), `sellerAddress` (required), `newPriceWei` (optional), `newDuration` in seconds (optional), `newBounty` (optional).

Returns: `cancel` tx (send first), then `newListing.eip712` data to sign and submit to Bazaar.

**For Bankr/SIWA flow:** When acting on behalf of a user, execute the cancel tx with the user's delegated wallet, then sign the new EIP-712 order and submit to Bazaar. The user sees it as a single "edit" action.

### Marketplace Fees

- No marketplace fee — sellers receive the sale price minus any optional agent bounty
- Seaport contract: `0x0000000000000068F116a894984e2DB1123eB395` (Base)
- Bazaar contract: `0x000000058f3ade587388daf827174d0e6fc97595` (Base)
- Bounty Escrow (Proxy): `0x95a29AD7f23c1039A03de365c23D275Fc5386f90`

## API Reference

Base URL: `https://hazza.name`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/available/:name` | GET | Check name availability |
| `/api/quote/:name?wallet=ADDR` | GET | Get exact price for this wallet |
| `/api/free-claim/:address` | GET | Free claim eligibility |
| `/api/profile/:name` | GET | Full profile with text records, master inheritance, Helixa Cred |
| `/api/identity/:address` | GET | Resolve address to display name + master profile + Helixa Cred |
| `/api/names/:address` | GET | All names owned by a wallet |
| `/api/resolve/:name` | GET | Resolve name to owner |
| `/api/reverse/:address` | GET | Reverse resolve address to name |
| `/api/stats` | GET | Registry stats (total names) |
| `/api/directory` | GET | Paginated list of all names |
| `/x402/register` | POST | Register a name (x402 flow) |
| `/api/text/:name` | POST | Set a text record |
| `/api/marketplace/listings` | GET | Browse active listings |
| `/api/marketplace/offers` | GET | Browse collection offers |
| `/api/marketplace/fulfill` | POST | Get buy transaction data |
| `/api/marketplace/fulfill-offer` | POST | Get offer acceptance tx data |
| `/api/marketplace/cancel` | POST | Cancel a listing (returns unsigned Seaport cancel tx) |
| `/api/marketplace/edit` | POST | Edit a listing (cancel + relist with new params) |
| `/api/bounty/:tokenId` | GET | Check bounty status for a name |
| `/api/bounty/pending/:address` | GET | Check pending withdrawals |
| `/api/bounty/register` | POST | Register bounty (returns unsigned tx) |
| `/api/bounty/register-agent` | POST | Register as agent for bounty |
| `/api/bounty/claim` | POST | Claim bounty after sale |
| `/api/bounty/cancel` | POST | Cancel bounty (seller only) |
| `/api/bounty/withdraw-bounty` | POST | Withdraw bounty ETH (seller) |
| `/api/bounty/withdraw` | POST | Withdraw pending payouts |

## Resolving an Address to a Person

When you have a wallet address and want to know who owns it, use `/api/identity/:address` — it returns the best display name and master profile in one call:

```bash
curl -s https://hazza.name/api/identity/0xaf5e770478e45650e36805d1ccaab240309f4a20
```

```json
{
  "wallet": "0xaf5e...",
  "primaryName": "cheryl",
  "ens": "cheryl.netlibrary.eth",
  "display": "cheryl",
  "truncated": "0xaf5e...4a20",
  "xmtp": "0x0816...0408",
  "avatar": "https://...",
  "description": "...",
  "profileUrl": "https://cheryl.hazza.name",
  "helixaCred": { "tokenId": 57, "credScore": 63 }
}
```

Use `display` as the user-facing name (primary hazza name > ENS > truncated address). Use `xmtp` to DM them. Use `helixaCred.credScore` to surface their reputation. Use `profileUrl` to link to their main page.

## Profile Response Shape

`GET /api/profile/:name` returns a rich object that already accounts for master inheritance and Helixa Cred:

```json
{
  "name": "mybiz",
  "registered": true,
  "owner": "0x...",
  "ownerEns": "alice.eth",
  "ownerPrimaryName": "alice",
  "tokenId": "42",
  "texts": { "avatar": "...", "description": "...", "...": "..." },
  "ownTexts": { "site.key": "..." },
  "inheritedFrom": "alice",
  "helixaData": { "tokenId": 1128, "credScore": 63, "autoDetected": true, "...": "..." },
  "url": "https://mybiz.hazza.name"
}
```

- `texts` is the merged view (master records + own records, own wins) — display this on profile pages.
- `ownTexts` is the raw on-chain records for THIS name only — use this when editing so you don't accidentally save inherited values.
- `inheritedFrom` is the master name if any, else `null`.
- `ownerPrimaryName` lets you link the owner display to their primary name's profile.
- `helixaData.autoDetected: true` means the cred score came from an address-search fallback rather than an explicit `helixa.id` text record.

## Key Addresses (Base Mainnet)

| Item | Address |
|------|---------|
| Registry | `0xD4E420201fE02F44AaF6d28D4c8d3A56fEaE0D3E` |
| Seaport | `0x0000000000000068F116a894984e2DB1123eB395` |
| Bazaar | `0x000000058f3ade587388daf827174d0e6fc97595` |
| Bounty Escrow (Proxy) | `0x95a29AD7f23c1039A03de365c23D275Fc5386f90` |
| ERC-8004 Registry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| $HAZZA Token | `0xC5C4Fcd6147e3bDAEEB5A0898A439Aec1e1BAba3` |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Chain ID | 8453 |

## Name Rules

- Lowercase only: a-z, 0-9, hyphens
- 3 to 63 characters
- No leading or trailing hyphens
- No consecutive hyphens (--)
- No spaces, emojis, or special characters
- Each name becomes a real web page — names must work as DNS labels

If a user requests a name with invalid characters, explain that names need to work as web addresses, so only letters, numbers, and hyphens are allowed.

## Profile Records

After registration, users can set these text records on their name:

| Key | Purpose | Example |
|-----|---------|---------|
| `avatar` | Profile image URL | `https://example.com/pfp.png` |
| `description` | Bio | `Builder on Base` |
| `url` | Website | `https://alice.dev` |
| `com.twitter` | Twitter/X handle | `alice` |
| `com.github` | GitHub username | `alice` |
| `xyz.farcaster` | Farcaster handle | `alice` |
| `org.telegram` | Telegram handle | `alice` |
| `com.discord` | Discord username | `alice#1234` |
| `com.linkedin` | LinkedIn username | `alice` |
| `xmtp` | XMTP messaging address | `0x...` |
| `message.delegate` | Forward inbound messages to this address | `0x...` |
| `message.mode` | Routing mode: `all`, `delegate-all`, `delegate-agents` | `delegate-agents` |
| `master` | Inherit profile from another hazza name | `geaux` |
| `helixa.id` | Pin a specific Helixa agent token ID | `57` |
| `net.profile` | Net Protocol storage key for custom profile | `my-profile-v1` |
| `netlibrary.member` | Net Library member number | `21` |
| `site.key` | Net Protocol storage key for custom HTML site | `my-site-v1` |
| `agent.uri` | URI to agent metadata JSON | `https://...` |

## Master Profile (Inheritance)

Set `master` on a name to a different hazza name to inherit that name's profile records. This lets one identity feed many names — for example, every name a user owns can inherit avatar/bio/socials/xmtp from their primary name without re-typing them.

**Behavior:**
- The name's own records always win over the master's records
- `master` and `site.key` are NOT inherited — each name controls its own custom site override
- Set to empty string to remove the link

**Example:** `mybiz` sets `master` to `geaux`. `https://mybiz.hazza.name` now displays geaux's avatar, bio, twitter, etc., but can still override any of those by setting its own records. `mybiz` can also have its own `site.key` to look like a fully custom website while keeping the inherited identity on the back end.

## Helixa Cred (Reputation Score)

hazza profile pages auto-detect the owner's [Helixa](https://helixa.xyz) agent (if any) and display a Cred Score badge. No setup is required — it works for any wallet that owns a Helixa agent. Score is 0–100, color-coded by tier (junk/marginal/qualified/prime/preferred).

**Optional override:** if a name represents a project distinct from the owner's personal Helixa identity, set `helixa.id` to that agent's token ID to pin a specific agent.

## CLI

A Node CLI is available for users who prefer the terminal:

```bash
npm install -g hazza-cli
hazza search alice
hazza register alice
hazza names 0x...
hazza profile alice
hazza set alice avatar https://example.com/pfp.png
hazza set alice description "Builder on Base"
```

Source: <https://github.com/geaux-eth/hazza/tree/master/cli>

## Agent Identity (ERC-8004)

Agents register on the ERC-8004 registry (`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`) and link to their hazza name via text records:

1. `POST /api/agent/register` with `{name, agentURI}` (optional: `agentWallet`) — returns unsigned 8004 register tx + instructions
2. Agent signs and submits the tx from the name owner wallet, gets `agentId` from the Transfer event (`topics[3]`)
3. `POST /api/agent/confirm` with `{name, agentId, txHash}` (optional: `agentWallet`) — verifies the 8004 token is owned by the name owner, then sets the agent text records via the relayer

Or pass `agentURI` and `agentWallet` in the `POST /x402/register` body at registration time — agent text records are set automatically (you still need to register on 8004 separately).

Agent text records:
- `agent.8004id` — ERC-8004 agent token ID (set by `/api/agent/confirm`)
- `agent.wallet` — agent's operational wallet address
- `agent.uri` — agent metadata URI (same as the URI passed to 8004 register)
- `agent.endpoint` — agent's API endpoint URL
- `agent.model` — LLM model the agent runs
- `agent.status` — operational status (e.g., "active")

## $HAZZA Token

The hazza protocol token `$HAZZA` (`0xC5C4Fcd6147e3bDAEEB5A0898A439Aec1e1BAba3` on Base) is launched and traded via Bankr. The token is a utility/governance token tied to the protocol — it does **not** confer name discounts or unlock free claims (those are tied to Unlimited Pass and first-name-per-wallet logic).

## Post-Registration

After a successful registration, share these with the user:

- **Profile page:** `https://brian.hazza.name`
- **Marketplace:** `https://hazza.name/marketplace`
- **Set up profile:** Visit `https://hazza.name/manage` to set text records
- **Dashboard:** `https://hazza.name/dashboard` to see all your names

## Guidelines

- It's "hazza" or "hazza.name" — never "HAZZA" or "Hazza Names"
- Names are "immediately useful" — they come with a working profile page from day one
- Powered by x402, XMTP and Net Protocol
- Never promise price appreciation or investment value
- If a name is taken, suggest alternatives (add numbers, try different names)
