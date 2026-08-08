# Seaport (OpenSea marketplace protocol)

## What it is
Seaport is the marketplace protocol used for OpenSea orders. All listings and offers on OpenSea are Seaport orders under the hood.

## Order structure
- **Offer items**: What the offerer provides (e.g., an NFT for listings, WETH for offers)
- **Consideration items**: What the offerer expects to receive (e.g., ETH payment + fees)

## Seaport Contract Addresses

| Chain | Seaport 1.6 Address |
|-------|---------------------|
| All EVM chains | `0x0000000000000068F116a894984e2DB1123eB395` |

Legacy Seaport 1.5: `0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC`

---

## Buying NFTs (Fulfilling Listings)

**No SDK required!** The OpenSea API returns ready-to-use calldata.

### Workflow

1. **Find a listing** - Get order hash from listings endpoint
2. **Get fulfillment data** - POST to fulfillment endpoint
3. **Submit transaction** - Send calldata directly to blockchain

### Step 1: Get Listings

```bash
# Via the opensea-api skill (CLI)
opensea listings all basenames --limit 10

# Via MCP
mcporter call opensea.get_listings collection="basenames" limit=10
```

Note the `order_hash` and `protocol_address` from the response.

### Step 2: Get Fulfillment Calldata

```bash
# Via script
./scripts/opensea-fulfill-listing.sh base 0xORDER_HASH 0xYOUR_WALLET

# Via curl
curl -X POST "https://api.opensea.io/api/v2/listings/fulfillment_data" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $OPENSEA_API_KEY" \
  -d '{
    "listing": {
      "hash": "0xORDER_HASH",
      "chain": "base",
      "protocol_address": "0x0000000000000068F116a894984e2DB1123eB395"
    },
    "fulfiller": {
      "address": "0xYOUR_WALLET"
    }
  }'
```

**Response contains:**
- `fulfillment_data.transaction.to` - Seaport contract
- `fulfillment_data.transaction.value` - ETH to send (wei)
- `fulfillment_data.transaction.input_data` - Encoded calldata

### Step 3: Submit Transaction

Use the Privy wallet adapter from `@opensea/cli` to sign and send:

```typescript
import { PrivyAdapter, resolveChainId } from '@opensea/cli';

const wallet = PrivyAdapter.fromEnv();
const txData = response.fulfillment_data.transaction;

const result = await wallet.sendTransaction({
  to: txData.to,
  data: txData.input_data.parameters ? encodeSeaportCall(txData.input_data) : txData.data,
  value: txData.value,
  chainId: resolveChainId('base'),
});

console.log(`TX: ${result.hash}`);
```

Requires `PRIVY_APP_ID`, `PRIVY_APP_SECRET`, and `PRIVY_WALLET_ID` environment variables.
See the [`opensea-wallet`](../../opensea-wallet/SKILL.md) skill for Privy configuration.

### Complete Working Example

```javascript
// buy-nft.mjs - Buy an NFT via OpenSea fulfillment API
import { createPublicClient, createWalletClient, http, encodeFunctionData } from 'viem';
import { base } from 'viem/chains';

const SEAPORT_ABI = [{
  name: 'fulfillBasicOrder_efficient_6GL6yc',
  type: 'function',
  stateMutability: 'payable',
  inputs: [{
    name: 'parameters',
    type: 'tuple',
    components: [
      { name: 'considerationToken', type: 'address' },
      { name: 'considerationIdentifier', type: 'uint256' },
      { name: 'considerationAmount', type: 'uint256' },
      { name: 'offerer', type: 'address' },
      { name: 'zone', type: 'address' },
      { name: 'offerToken', type: 'address' },
      { name: 'offerIdentifier', type: 'uint256' },
      { name: 'offerAmount', type: 'uint256' },
      { name: 'basicOrderType', type: 'uint8' },
      { name: 'startTime', type: 'uint256' },
      { name: 'endTime', type: 'uint256' },
      { name: 'zoneHash', type: 'bytes32' },
      { name: 'salt', type: 'uint256' },
      { name: 'offererConduitKey', type: 'bytes32' },
      { name: 'fulfillerConduitKey', type: 'bytes32' },
      { name: 'totalOriginalAdditionalRecipients', type: 'uint256' },
      { name: 'additionalRecipients', type: 'tuple[]', components: [
        { name: 'amount', type: 'uint256' },
        { name: 'recipient', type: 'address' }
      ]},
      { name: 'signature', type: 'bytes' }
    ]
  }],
  outputs: [{ name: 'fulfilled', type: 'bool' }]
}];

async function buyNFT(orderHash, chain, buyerAddress, account) {
  // 1. Get fulfillment data
  const res = await fetch('https://api.opensea.io/api/v2/listings/fulfillment_data', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.OPENSEA_API_KEY
    },
    body: JSON.stringify({
      listing: { hash: orderHash, chain, protocol_address: '0x0000000000000068F116a894984e2DB1123eB395' },
      fulfiller: { address: buyerAddress }
    })
  });
  
  const { fulfillment_data } = await res.json();
  const tx = fulfillment_data.transaction;
  const params = tx.input_data.parameters;
  
  // 2. Setup wallet via Privy adapter
  const { PrivyAdapter, resolveChainId } = await import('@opensea/cli');
  const wallet = PrivyAdapter.fromEnv();
  
  // 3. Encode and send
  const orderParams = {
    ...params,
    considerationIdentifier: BigInt(params.considerationIdentifier),
    considerationAmount: BigInt(params.considerationAmount),
    offerIdentifier: BigInt(params.offerIdentifier),
    offerAmount: BigInt(params.offerAmount),
    startTime: BigInt(params.startTime),
    endTime: BigInt(params.endTime),
    salt: BigInt(params.salt),
    totalOriginalAdditionalRecipients: BigInt(params.totalOriginalAdditionalRecipients),
    additionalRecipients: params.additionalRecipients.map(r => ({
      amount: BigInt(r.amount),
      recipient: r.recipient
    }))
  };
  
  const data = encodeFunctionData({
    abi: SEAPORT_ABI,
    functionName: 'fulfillBasicOrder_efficient_6GL6yc',
    args: [orderParams]
  });
  
  const result = await wallet.sendTransaction({
    to: tx.to,
    data,
    value: tx.value,
    chainId: resolveChainId('base'),
  });
  
  console.log(`TX: https://basescan.org/tx/${result.hash}`);
  return true;
}
```

---

## Selling NFTs (Accepting Offers)

Similar workflow using `/api/v2/offers/fulfillment_data`:

```bash
./scripts/opensea-fulfill-offer.sh base 0xOFFER_HASH 0xYOUR_WALLET 0xNFT_CONTRACT 1234
```

---

## Creating Listings

Creating listings (and offers) requires signing a Seaport order:

1. **Fetch the offerer's `counter`**: call `getCounter(address)` on the Seaport contract, or use `"0"` for accounts that have never called `incrementCounter`. The counter must be included both in the signed payload and in the submitted `parameters`.
2. **Build order structure** with offer (your NFT) and consideration (payment). `salt` is a uint256 decimal string.
3. **Sign with EIP-712** using domain `{ name: "Seaport", version: "1.6", chainId, verifyingContract }` and primary type `OrderComponents`.
4. **POST** `{ protocol_address, parameters, signature }` to `/api/v2/orders/{chain}/seaport/listings` (or `/offers`). `protocol_address` is a top-level field, not inside `parameters`.

See `references/marketplace-api.md` → **Build a Listing** and **Signing Orders (EIP-712)** for the full request schema, field-by-field notes, and a complete `viem` signing example.

---

## Key Points

- **Fulfillment API returns ready-to-use calldata** - No SDK needed for buying
- **Value field** tells you exactly how much ETH to send
- **Works on all EVM chains** OpenSea supports
- **Basic orders** use `fulfillBasicOrder_efficient_6GL6yc` function
- **Advanced orders** use `fulfillAvailableAdvancedOrders` for partial fills
