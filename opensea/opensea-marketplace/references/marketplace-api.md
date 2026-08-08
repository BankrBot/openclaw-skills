# OpenSea Marketplace API

This reference covers the marketplace endpoints for buying and selling NFTs and tokens on OpenSea.

## Overview

OpenSea uses the **Seaport protocol** for all marketplace orders. The API provides endpoints to:
- Query existing listings and offers
- Build new listings and offers (returns unsigned Seaport orders)
- Fulfill orders (accept listings or offers)
- Cancel orders

**Important**: Creating and fulfilling orders requires wallet signatures. The API returns order data that must be signed client-side before submission.

## Base URL and Authentication

```
Base URL: https://api.opensea.io/api/v2
Auth: x-api-key: $OPENSEA_API_KEY
```

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

---

## Read Operations (GET)

### Get Best Listing for NFT

Returns the lowest-priced active listing for an NFT.

```bash
GET /api/v2/listings/collection/{collection_slug}/nfts/{identifier}/best
```

**Parameters:**
- `collection_slug`: Collection slug (e.g., `boredapeyachtclub`)
- `identifier`: NFT identifier (token ID)

**Example:**
```bash
opensea listings best-for-nft boredapeyachtclub 1234
```

### Get Best Offer for NFT

Returns the highest active offer for an NFT.

```bash
GET /api/v2/offers/collection/{collection_slug}/nfts/{identifier}/best
```

**Example:**
```bash
opensea offers best-for-nft boredapeyachtclub 1234
```

### Get All Listings for Collection

Returns all active listings for a collection.

```bash
GET /api/v2/listings/collection/{collection_slug}/all
```

**Query parameters:**
- `limit`: Page size (default 50, max 100)
- `next`: Cursor for pagination

**Example:**
```bash
opensea listings all boredapeyachtclub --limit 50
```

### Get All Offers for Collection

Returns all active offers for a collection.

```bash
GET /api/v2/offers/collection/{collection_slug}/all
```

**Example:**
```bash
opensea offers all boredapeyachtclub --limit 50
```

### Get Best Listing for Specific NFT

```bash
GET /api/v2/listings/collection/{slug}/nfts/{token_id}/best
```

**Example:**
```bash
curl "https://api.opensea.io/api/v2/listings/collection/boredapeyachtclub/nfts/1234/best" \
  -H "x-api-key: $OPENSEA_API_KEY"
```

For all listings on a collection (optionally filtered by maker), use `GET /api/v2/listings/collection/{slug}/all?maker=0x...`. There is no per-NFT all-listings endpoint — the best-listing endpoint returns a single result.

### Get Offers for Specific NFT

```bash
GET /api/v2/offers/collection/{slug}/nfts/{token_id}
```

**Query parameters:**
- `limit`, `next`: Pagination

**Example:**
```bash
curl "https://api.opensea.io/api/v2/offers/collection/boredapeyachtclub/nfts/1234" \
  -H "x-api-key: $OPENSEA_API_KEY"
```

For just the best offer, use `GET /api/v2/offers/collection/{slug}/nfts/{token_id}/best`. For collection-wide offers filtered by maker, use `GET /api/v2/offers/collection/{slug}/all?maker=0x...`.

### Get Order by Hash

Retrieve details of a specific order.

```bash
GET /api/v2/orders/chain/{chain}/protocol/{protocol_address}/{order_hash}
```

**Example:**
```bash
curl "https://api.opensea.io/api/v2/orders/chain/ethereum/protocol/0x0000000000000068F116a894984e2DB1123eB395/0xORDER_HASH" \
  -H "x-api-key: $OPENSEA_API_KEY"
```

---

## Write Operations (POST)

### Build a Listing

Creates an unsigned Seaport listing order. Returns order parameters to sign.

```bash
POST /api/v2/orders/{chain}/seaport/listings
```

**Request body:**
```json
{
  "protocol_address": "0x0000000000000068f116a894984e2db1123eb395",
  "parameters": {
    "offerer": "0xYourWalletAddress",
    "offer": [{
      "itemType": 2,
      "token": "0xContractAddress",
      "identifierOrCriteria": "1234",
      "startAmount": "1",
      "endAmount": "1"
    }],
    "consideration": [{
      "itemType": 0,
      "token": "0x0000000000000000000000000000000000000000",
      "identifierOrCriteria": "0",
      "startAmount": "1000000000000000000",
      "endAmount": "1000000000000000000",
      "recipient": "0xYourWalletAddress"
    }],
    "startTime": "1704067200",
    "endTime": "1735689600",
    "orderType": 0,
    "zone": "0x0000000000000000000000000000000000000000",
    "zoneHash": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "salt": "24446860302761739304752683030156737591518664810215442929805094493721949474548",
    "conduitKey": "0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000",
    "totalOriginalConsiderationItems": 1,
    "counter": "0"
  },
  "signature": "0xSignedOrderSignature"
}
```

**Required top-level fields:** `protocol_address`, `parameters`, `signature`.

**Required `parameters` fields** (all must be present before signing): `offerer`, `zone`, `offer`, `consideration`, `startTime`, `endTime`, `orderType`, `zoneHash`, `salt`, `conduitKey`, `totalOriginalConsiderationItems`, `counter`.

**Field notes:**
- `counter`: Seaport nonce for the offerer. Fetch with `getCounter(address)` on the Seaport contract, or use `"0"` for accounts that have never canceled via `incrementCounter`. Order hashes and EIP-712 signatures are bound to this value.
- `salt`: uint256 as a decimal string (e.g. from `toString(randomBigInt(256))`). A hex string works too as long as it parses as uint256.
- `conduitKey`: `0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000` is OpenSea's conduit. Use `0x0000…0000` to transfer directly without a conduit.
- `zone` / `zoneHash`: use zero address / zero bytes32 unless you're integrating a custom zone. `zone` is part of the signed `OrderComponents` struct, so it must be present in `parameters` (even as the zero address) or signing will fail.
- See `### Signing Orders (EIP-712)` below for building the signature.

**Item Types:**
- `0`: Native currency (ETH, MATIC, etc.)
- `1`: ERC20 token
- `2`: ERC721 NFT
- `3`: ERC1155 NFT

**Example (curl):**
```bash
curl -X POST "https://api.opensea.io/api/v2/orders/ethereum/seaport/listings" \
  -H "x-api-key: $OPENSEA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"protocol_address": "0x0000000000000068f116a894984e2db1123eb395", "parameters": {...}, "signature": "0x..."}'
```

### Build an Offer

Creates an unsigned Seaport offer order.

```bash
POST /api/v2/orders/{chain}/seaport/offers
```

**Request body structure** (same shape as listings, with top-level `protocol_address`, `parameters`, `signature`, but `offer` contains payment and `consideration` contains the NFT):
```json
{
  "protocol_address": "0x0000000000000068f116a894984e2db1123eb395",
  "parameters": {
    "offerer": "0xBuyerWalletAddress",
    "offer": [{
      "itemType": 1,
      "token": "0xWETHAddress",
      "identifierOrCriteria": "0",
      "startAmount": "1000000000000000000",
      "endAmount": "1000000000000000000"
    }],
    "consideration": [{
      "itemType": 2,
      "token": "0xNFTContractAddress",
      "identifierOrCriteria": "1234",
      "startAmount": "1",
      "endAmount": "1",
      "recipient": "0xBuyerWalletAddress"
    }],
    "startTime": "1704067200",
    "endTime": "1735689600",
    "orderType": 0,
    "zone": "0x0000000000000000000000000000000000000000",
    "zoneHash": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "salt": "24446860302761739304752683030156737591518664810215442929805094493721949474548",
    "conduitKey": "0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000",
    "totalOriginalConsiderationItems": 1,
    "counter": "0"
  },
  "signature": "0x..."
}
```

Field requirements and notes are identical to **Build a Listing** (see above).

### Signing Orders (EIP-712)

Both listing and offer creation require an EIP-712 signature over the order parameters. The signer must be the `offerer`.

**Before signing**, fetch the offerer's current Seaport counter:

```bash
# Returns the uint256 counter. Use "0" for any account that has never called incrementCounter.
cast call 0x0000000000000068F116a894984e2DB1123eB395 \
  "getCounter(address)(uint256)" 0xYourWalletAddress \
  --rpc-url <chain-rpc-url>
```

**EIP-712 `domain`:**
```json
{
  "name": "Seaport",
  "version": "1.6",
  "chainId": 1,
  "verifyingContract": "0x0000000000000068F116a894984e2DB1123eB395"
}
```

Set `chainId` to the target chain ID (`1` for Ethereum, `8453` for Base, `137` for Polygon, etc.). `verifyingContract` is the Seaport 1.6 address (the same value as `protocol_address` in the request body).

**EIP-712 `types` (primary type `OrderComponents`):**
```json
{
  "OrderComponents": [
    { "name": "offerer", "type": "address" },
    { "name": "zone", "type": "address" },
    { "name": "offer", "type": "OfferItem[]" },
    { "name": "consideration", "type": "ConsiderationItem[]" },
    { "name": "orderType", "type": "uint8" },
    { "name": "startTime", "type": "uint256" },
    { "name": "endTime", "type": "uint256" },
    { "name": "zoneHash", "type": "bytes32" },
    { "name": "salt", "type": "uint256" },
    { "name": "conduitKey", "type": "bytes32" },
    { "name": "counter", "type": "uint256" }
  ],
  "OfferItem": [
    { "name": "itemType", "type": "uint8" },
    { "name": "token", "type": "address" },
    { "name": "identifierOrCriteria", "type": "uint256" },
    { "name": "startAmount", "type": "uint256" },
    { "name": "endAmount", "type": "uint256" }
  ],
  "ConsiderationItem": [
    { "name": "itemType", "type": "uint8" },
    { "name": "token", "type": "address" },
    { "name": "identifierOrCriteria", "type": "uint256" },
    { "name": "startAmount", "type": "uint256" },
    { "name": "endAmount", "type": "uint256" },
    { "name": "recipient", "type": "address" }
  ]
}
```

**`message`:** the `parameters` object from the request body, minus `totalOriginalConsiderationItems` (which is a submission-only field, not part of the signed struct). All uint256 values can stay as decimal strings; ethers/viem will coerce.

**Example with viem:**
```typescript
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const account = privateKeyToAccount(process.env.PRIVATE_KEY);
const client = createWalletClient({ account, transport: http() });

const { totalOriginalConsiderationItems, ...message } = parameters;

const signature = await client.signTypedData({
  domain: {
    name: 'Seaport',
    version: '1.6',
    chainId: 1,
    verifyingContract: '0x0000000000000068F116a894984e2DB1123eB395',
  },
  types: { OrderComponents, OfferItem, ConsiderationItem },
  primaryType: 'OrderComponents',
  message,
});

// POST { protocol_address, parameters, signature } to /api/v2/orders/{chain}/seaport/listings
```

After signing, submit with `protocol_address`, the full `parameters` object (including `totalOriginalConsiderationItems`), and `signature`.

---

### Fulfill a Listing (Buy NFT)

Accept an existing listing to purchase an NFT.

```bash
POST /api/v2/listings/fulfillment_data
```

**Request body:**
```json
{
  "listing": {
    "hash": "0xOrderHash",
    "chain": "ethereum",
    "protocol_address": "0x0000000000000068f116a894984e2db1123eb395"
  },
  "fulfiller": {
    "address": "0xBuyerWalletAddress"
  }
}
```

**Response:** Returns transaction data for the buyer to submit onchain.

### Fulfill an Offer (Sell NFT)

Accept an existing offer to sell your NFT.

```bash
POST /api/v2/offers/fulfillment_data
```

**Request body:**
```json
{
  "offer": {
    "hash": "0xOfferOrderHash",
    "chain": "ethereum",
    "protocol_address": "0x0000000000000068f116a894984e2db1123eb395"
  },
  "fulfiller": {
    "address": "0xSellerWalletAddress"
  },
  "consideration": {
    "asset_contract_address": "0xNFTContract",
    "token_id": "1234"
  }
}
```

### Cancel an Order

Cancel an active listing or offer.

```bash
POST /api/v2/orders/chain/{chain}/protocol/{protocol_address}/{order_hash}/cancel
```

**Note:** Cancellation requires an onchain transaction. The API returns the transaction data to execute.

---

## Workflow: Buying an NFT

Steps 1 and 2 are read-only and live in the [`opensea-api`](../../opensea-api/SKILL.md) skill.

1. **Find the NFT** (opensea-api): `opensea nfts get <chain> <contract> <token_id>`
2. **Check listings** (opensea-api): `opensea listings best-for-nft <slug> <token_id>`
3. **Get fulfillment data** (this skill): POST to `/api/v2/listings/fulfillment_data`
4. **Execute transaction**: sign and submit the returned transaction data

```bash
# Step 1: Get NFT info (opensea-api skill)
opensea nfts get ethereum 0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d 1234

# Step 2: Get best listing (opensea-api skill)
opensea listings best-for-nft boredapeyachtclub 1234

# Step 3: Request fulfillment (this skill)
./scripts/opensea-fulfill-listing.sh ethereum 0x_order_hash 0x_your_wallet
```

## Workflow: Selling an NFT (Creating a Listing)

1. **Build the listing** - POST to `/api/v2/orders/{chain}/seaport/listings`
2. **Sign the order** - Use wallet to sign the Seaport order
3. **Submit signed order** - POST again with signature
4. **Monitor** - Check listing via `/api/v2/listings/collection/{slug}/all`

## Workflow: Making an Offer

1. **Ensure WETH approval** - Buyer needs WETH allowance for Seaport
2. **Build the offer** - POST to `/api/v2/orders/{chain}/seaport/offers`
3. **Sign the order** - Wallet signature required
4. **Submit** - POST with signature

## Workflow: Accepting an Offer

1. **View offers** (opensea-api): `opensea offers all <slug> --limit 50`
2. **Get fulfillment data** (this skill): POST to `/api/v2/offers/fulfillment_data`
3. **Execute**: submit the returned transaction

---

## Error Codes

| Code | Meaning |
|------|---------|
| 400 | Bad request - invalid parameters |
| 401 | Unauthorized - missing or invalid API key |
| 404 | Not found - order/NFT doesn't exist |
| 429 | Rate limited - too many requests |
| 500 | Server error |

## Rate Limits

Rate limits apply per-account across all API keys. See `references/rest-api.md` for full details.

**Default limits (Tier 1):** 120 read/min, 60 write/min, 60 fulfillment/min

Fulfillment endpoints (`/api/v2/listings/fulfillment_data`, `/api/v2/offers/fulfillment_data`) use the **fulfillment** rate bucket. Order creation endpoints use the **write** rate bucket. All other GET endpoints use the **read** rate bucket.

---

## Seaport Contract Addresses

| Chain | Seaport 1.6 Address |
|-------|---------------------|
| All chains | `0x0000000000000068F116a894984e2DB1123eB395` |

---

## Tips

1. **Always use WETH for offers** - Native ETH cannot be used for offers due to ERC20 approval requirements
2. **Check approval status** - Before creating listings, ensure Seaport has approval for your NFTs
3. **Test on Sepolia first** - Use testnet before mainnet transactions
4. **Handle expiration** - Orders have startTime/endTime - check these before fulfilling
5. **Monitor events** - Use Stream API for real-time order updates
