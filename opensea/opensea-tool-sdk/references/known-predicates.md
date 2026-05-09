# Known Predicates

These predicates are deployed on Base and available for any tool to use. They are multi-tenant: one deployment serves all tools, configured per `toolId`.

## ERC721OwnerPredicate

Grants access to holders of any configured ERC-721 collection (`balanceOf > 0`).

| Field | Value |
|-------|-------|
| Address | `0xd1F703D0B90BB7106fAebBfbcAdD2B07BDc4c769` |
| Requirement `kind` | `0xbdf8c428` (`IERC721Holding` interface ID) |
| Requirement `data` | `abi.encode(address collection)` |
| Logic | `OR` (any one collection suffices) |
| Max collections | 10 per tool |

**Register and configure via CLI:**

```bash
# Registers the tool with ERC721OwnerPredicate and configures the collection in one flow
npx @opensea/tool-sdk register \
  --metadata https://my-tool.example.com/.well-known/ai-tool/my-tool.json \
  --network base \
  --nft-gate 0xCOLLECTION_ADDRESS
```

**Configure via SDK (after registration):**

```typescript
import { ERC721OwnerPredicateClient, walletAdapterToClient, createWalletFromEnv } from "@opensea/tool-sdk"
import { base } from "viem/chains"

const adapter = createWalletFromEnv()
const walletClient = await walletAdapterToClient(adapter, base)

const predicate = new ERC721OwnerPredicateClient({ walletClient })
await predicate.setCollections(toolId, [
  "0xCOLLECTION_1",
  "0xCOLLECTION_2",
])
```

**Manifest access declaration:**

```json
{
  "access": {
    "logic": "OR",
    "requirements": [
      {
        "kind": "0xbdf8c428",
        "data": "0x000000000000000000000000<collection-address-no-0x-prefix>",
        "label": "Hold any NFT from My Collection"
      }
    ]
  }
}
```

## ERC1155OwnerPredicate

Grants access to holders of specific `(collection, tokenId)` pairs across ERC-1155 collections.

| Field | Value |
|-------|-------|
| Address | `0xc179b9d4D9B7ffe0CdA608134729f72003380A7e` |
| Requirement `kind` | `0xcb429230` (`IERC1155Holding` interface ID) |
| Requirement `data` | `abi.encode(address collection, uint256 tokenId)` |
| Logic | `OR` (any one entry suffices) |
| Max collections | 10 per tool |
| Max token IDs | 16 per collection |

**Configure via SDK:**

```typescript
import { ERC1155OwnerPredicateClient, walletAdapterToClient, createWalletFromEnv } from "@opensea/tool-sdk"
import { base } from "viem/chains"

const adapter = createWalletFromEnv()
const walletClient = await walletAdapterToClient(adapter, base)

const predicate = new ERC1155OwnerPredicateClient({ walletClient })
await predicate.setCollectionTokens(toolId, [
  { collection: "0xCOLLECTION_ADDRESS", tokenIds: [1n, 2n, 3n] },
])
```

**Manifest access declaration:**

```json
{
  "access": {
    "logic": "OR",
    "requirements": [
      {
        "kind": "0xcb429230",
        "data": "0x000000000000000000000000<collection-addr>0000000000000000000000000000000000000000000000000000000000000001",
        "label": "Hold token #1 from My ERC-1155 Collection"
      }
    ]
  }
}
```

## SubscriptionPredicate

Grants access based on ERC-5643 subscription NFTs with optional tier gating.

| Field | Value |
|-------|-------|
| Requirement `kind` | `0x44387cc2` (`ISubscription` interface ID) |
| Requirement `data` | `abi.encode(address collection, uint8 minTier)` |

**Configure via SDK (after deploying the predicate):**

```typescript
// 1. Register tool with subscriptionPredicate as the accessPredicate
const { toolId } = await registry.registerTool({
  metadataURI: "...",
  manifest,
  accessPredicate: subscriptionPredicateAddress,
})

// 2. Configure which subscription NFT gates the tool
// (call configureToolGating on the SubscriptionPredicate contract)
```

## CompositePredicate

Combines up to 3 leaf predicates under AND-all or OR-any with optional per-term negation.

| Field | Value |
|-------|-------|
| Max terms | 3 per composition |
| Operators | `ALL` (AND), `ANY` (OR) |
| Negation | Per-term `negate` flag |
| Fail behavior | Fail-closed (sub-call failure means `false` before negation) |

**Example: "owns ERC-721 X OR has active subscription Y"**

```
CompositePredicate.setComposition(toolId, Op.ANY, [
  { predicate: ERC721OwnerPredicate, negate: false },
  { predicate: SubscriptionPredicate, negate: false },
])
```

**Example: "owns ERC-721 X AND NOT owns ERC-1155 Z"**

```
CompositePredicate.setComposition(toolId, Op.ALL, [
  { predicate: ERC721OwnerPredicate, negate: false },
  { predicate: ERC1155OwnerPredicate, negate: true },
])
```

## SDK helpers for reading predicate requirements

Use `describeToolAccess` to read a tool's predicate name, requirements, and logic from the registry, and `decodeRequirement` to decode the raw `kind`/`data` into typed objects:

```typescript
import { describeToolAccess, decodeRequirement } from "@opensea/tool-sdk"

const description = await describeToolAccess({ toolId: 1n })
// { openAccess: false, predicateName: "ERC721OwnerPredicate", requirements: [...], logic: "OR" }

for (const req of description.requirements) {
  const decoded = decodeRequirement(req)
  switch (decoded.type) {
    case "erc721":
      console.log(`Requires NFT from collection ${decoded.collection}`)
      break
    case "erc1155":
      console.log(`Requires token #${decoded.tokenId} from ${decoded.collection}`)
      break
    case "subscription":
      console.log(`Requires subscription (min tier ${decoded.minTier}) from ${decoded.collection}`)
      break
    case "unknown":
      console.log(`Unknown requirement kind ${decoded.kind}`)
      break
  }
}
```
