# Known Predicates

These predicates are deployed on Ethereum mainnet, Base, Shape, Abstract, and Monad and available for any tool to use. They are multi-tenant: one deployment serves all tools, configured per `toolId`.

## ERC721OwnerPredicate

Grants access to holders of any configured ERC-721 collection (`balanceOf > 0`).

| Field | Value |
|-------|-------|
| Address | `0xc8721c9A776958FfFfEb602DA1b708bf1D318379` |
| Requirement `kind` | `0xbdf8c428` (`IERC721Holding` interface ID) |
| Requirement `data` | `abi.encode(address collection)` |
| Logic | `OR` (any one collection suffices) |
| Max collections | 10 per tool |

**Register and configure via CLI:**

```bash
# Registers the tool with ERC721OwnerPredicate and configures the collection in one flow
npx @opensea/tool-sdk@0.27.0 register \
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

**Manifest access declaration (manual):**

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

**Generate manifest access via SDK:**

```typescript
const predicate = new ERC721OwnerPredicateClient()
const access = predicate.toManifestAccess("0xCOLLECTION_ADDRESS")
// access.requirements[0].links?.opensea is included automatically for base, ethereum, and polygon
```

With a custom label:
```typescript
const accessCustom = predicate.toManifestAccess("0xCOLLECTION_ADDRESS", { label: "Hold a Chonk" })
```

## ERC1155OwnerPredicate

Grants access to holders of specific `(collection, tokenId)` pairs across ERC-1155 collections.

| Field | Value |
|-------|-------|
| Address | `0x77373Dc3c1AE9A1e937eF3e5E08F4807D47c7c11` |
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

**Manifest access declaration (manual):**

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

**Generate manifest access via SDK:**

```typescript
const predicate = new ERC1155OwnerPredicateClient()
const access = predicate.toManifestAccess("0xCOLLECTION_ADDRESS", 1n)
// access.requirements[0].links?.opensea is included automatically for base, ethereum, and polygon
```

With a custom label:
```typescript
const accessCustom = predicate.toManifestAccess("0xCOLLECTION_ADDRESS", 1n, { label: "Hold a VIP pass" })
```

## SubscriptionPredicate

Grants access based on ERC-5643 subscription NFTs with optional tier gating.

| Field | Value |
|-------|-------|
| Address | `0xCBe0cd9B1d99d95Baa9c58f2767246C52e461f25` |
| Requirement `kind` | `0x44387cc2` (`ISubscription` interface ID) |
| Requirement `data` | `abi.encode(address collection, uint8 minTier)` |
| Logic | `AND` |

**Configure via SDK:**

```typescript
import { SubscriptionPredicateClient, walletAdapterToClient, createWalletFromEnv } from "@opensea/tool-sdk"
import { base } from "viem/chains"

const adapter = createWalletFromEnv()
const walletClient = await walletAdapterToClient(adapter, base)

const predicate = new SubscriptionPredicateClient({ walletClient })

const toolId = 1n // obtained from registerTool()

// Configure which subscription NFT collection gates the tool (minTier 0 = any active sub)
await predicate.configureToolGating(toolId, "0xSUBSCRIPTION_NFT_COLLECTION", 0)
```

**Check subscription status:**

```typescript
const status = await predicate.getSubscriptionStatus(toolId, "0xUSER_ADDRESS")
// { hasNft, tier, requiredTier, expiration, active }
```

**Generate manifest access via SDK:**

```typescript
const access = predicate.toManifestAccess("0xSUBSCRIPTION_NFT_COLLECTION", 0)
```

With a custom label and minimum tier:
```typescript
const access = predicate.toManifestAccess("0xCOLLECTION", 2, { label: "Pro subscription required" })
```

## TraitGatedPredicate

Gates access based on ERC-721 ownership plus an ERC-7496 dynamic trait value. The traits contract may differ from the NFT contract (e.g. a separate renderer). Multi-tenant: one canonical deployment per chain, configured per `toolId`.

| Field | Value |
|-------|-------|
| Address | `0x10abF07CfA34Bf22372C57f27e8bd9C2DCF93fA1` |
| Requirement `kind` | `0x37d8dc22` (`IERC7496Trait` interface ID) |
| Requirement `data` | `abi.encode(address collection, address traitsContract, bytes32 traitKey, bytes32[] allowedValues)` |
| Logic | `AND` |
| Max allowed values | 32 per tool |
| `hasAccess` `data` | `abi.encode(uint256 tokenId)` — must be exactly 32 bytes; empty/malformed data returns `false` |

**Bytes32 encoding:** Trait keys and values are `bytes32`. ERC-7496 stores values as left-aligned, zero-padded bytes32 (e.g. `bytes32("Rare")` → `0x5261726500...00`). The `allowedValues` you configure **must match exactly** how the traits contract emits them. Use `toHex(value, { size: 32 })` in TypeScript or `bytes32("value")` in Solidity. `bytes32(0)` is rejected as an allowed value — it is the default return for unset traits, so including it would grant access to every holder.

**Important:** If `hasAccess` receives empty or wrong-length `data`, it returns `false` (never reverts).

**Configure via SDK (after registration):**

```typescript
import { TraitGatedPredicateClient, walletAdapterToClient, createWalletFromEnv } from "@opensea/tool-sdk"
import { base } from "viem/chains"
import { toHex } from "viem"

const adapter = createWalletFromEnv()
const walletClient = await walletAdapterToClient(adapter, base)

const predicate = new TraitGatedPredicateClient({ walletClient })

const toolId = 1n // obtained from registerTool()
const tierKey = toHex("tier", { size: 32 })
const rareValue = toHex("Rare", { size: 32 })
const legendaryValue = toHex("Legendary", { size: 32 })

await predicate.configureToolTrait(
  toolId,
  "0xNFT_COLLECTION",        // ERC-721 contract (for ownerOf)
  "0xTRAITS_CONTRACT",       // ERC-7496 contract (for getTraitValue) — can be the same address
  tierKey,
  [rareValue, legendaryValue],
)
```

**Read trait gating config:**

```typescript
const config = await predicate.getToolTraitConfig(toolId)
// { collection, traitsContract, traitKey, allowedValues }
```

**Generate manifest access via SDK:**

```typescript
const access = predicate.toManifestAccess(
  "0xNFT_COLLECTION",
  "0xTRAITS_CONTRACT",
  tierKey,
  [rareValue, legendaryValue],
)
```

With a custom label:
```typescript
const access = predicate.toManifestAccess(
  "0xNFT_COLLECTION",
  "0xTRAITS_CONTRACT",
  tierKey,
  [rareValue],
  { label: "Rare tier required" },
)
```

**Configure via CLI:**

```bash
npx @opensea/tool-sdk@0.27.0 configure-trait-gating <TOOL_ID> \
  0xNFT_COLLECTION tier Rare Legendary \
  --traits-contract 0xTRAITS_CONTRACT \
  --network base
```

If the NFT itself implements ERC-7496, omit `--traits-contract` (defaults to collection):
```bash
npx @opensea/tool-sdk@0.27.0 configure-trait-gating <TOOL_ID> \
  0xNFT_COLLECTION tier Rare Legendary --network base
```

**Read trait config via CLI:**

```bash
npx @opensea/tool-sdk@0.27.0 get-trait-config <TOOL_ID> --network base
```

**Decode requirements via SDK:**

```typescript
import { decodeRequirement, ERC7496_TRAIT_KIND } from "@opensea/tool-sdk"

const decoded = decodeRequirement(req)
if (decoded.type === "erc7496Trait") {
  console.log(`Collection: ${decoded.collection}`)
  console.log(`Traits contract: ${decoded.traitsContract}`)
  console.log(`Trait key: ${decoded.traitKey}`)
  console.log(`Allowed values: ${decoded.allowedValues}`)
}
```

## ERC20BalancePredicate

Gates access based on holding a configurable minimum balance of an ERC-20 token. Multi-tenant: one deployment per chain, configured per `toolId`. Canonical deployment: `0x1a834FC48B5f6e119c62C12a98b32137bCFA77cD` (Ethereum mainnet, Base, Shape, Abstract, Monad). The CLI commands default to this address; pass `--predicate-address` only to override it.

| Field | Value |
|-------|-------|
| Address | `0x1a834FC48B5f6e119c62C12a98b32137bCFA77cD` |
| Requirement `kind` | `0x812b02ee` (`IERC20Balance` interface ID) |
| Requirement `data` | `abi.encode(address token, uint256 minBalance)` |
| Logic | `AND` |
| `hasAccess` `data` | unused (can be empty) |

**Configure via SDK:**

```typescript
import { ERC20BalancePredicateClient, walletAdapterToClient, createWalletFromEnv } from "@opensea/tool-sdk"
import { base } from "viem/chains"

const adapter = createWalletFromEnv()
const walletClient = await walletAdapterToClient(adapter, base)

const predicate = new ERC20BalancePredicateClient({ walletClient })

const toolId = 1n // obtained from registerTool()
await predicate.configureToolERC20(
  toolId,
  "0xTOKEN_ADDRESS",  // ERC-20 token contract
  1000000000000000000n, // minBalance (e.g. 1e18 = 1 token with 18 decimals)
)
```

**Read ERC-20 config:**

```typescript
const config = await predicate.getToolERC20Config(toolId)
// { token, minBalance }
```

**Generate manifest access via SDK:**

```typescript
const access = predicate.toManifestAccess(
  "0xTOKEN_ADDRESS",
  1000000000000000000n,
)
```

With a custom label (**recommended** — the default renders raw bigint units):
```typescript
const access = predicate.toManifestAccess(
  "0xTOKEN_ADDRESS",
  1000000000000000000n,
  { label: "Hold at least 1 USDC" },
)
```

**Register and configure via CLI (one shot):**

```bash
npx @opensea/tool-sdk@0.27.0 register \
  --metadata https://my-tool.example.com/.well-known/ai-tool/my-tool.json \
  --network base \
  --erc20-gate 0xTOKEN_ADDRESS --erc20-min-balance 1000000000000000000
```

**Configure via CLI (after registration):**

```bash
npx @opensea/tool-sdk@0.27.0 configure-erc20-gate <TOOL_ID> \
  0xTOKEN_ADDRESS 1000000000000000000 \
  --network base
```

**Read ERC-20 config via CLI:**

```bash
npx @opensea/tool-sdk@0.27.0 get-erc20-config <TOOL_ID> \
  --network base
```

**Decode requirements via SDK:**

```typescript
import { decodeRequirement, ERC20_BALANCE_KIND } from "@opensea/tool-sdk"

const decoded = decodeRequirement(req)
if (decoded.type === "erc20Balance") {
  console.log(`Token: ${decoded.token}`)
  console.log(`Min Balance: ${decoded.minBalance}`)
}
```

## CompositePredicate

Combines up to 3 leaf predicates under AND-all or OR-any with optional per-term negation. No canonical deployment — each tool creator deploys their own instance.

| Field | Value |
|-------|-------|
| Max terms | 3 per composition |
| Operators | `ALL` (AND), `ANY` (OR) |
| Negation | Per-term `negate` flag |
| Fail behavior | Fail-closed (sub-call failure = `false` before negation) |

**Configure via SDK (after deploying the predicate):**

```typescript
import { CompositePredicateClient, CompositeOp, walletAdapterToClient, createWalletFromEnv } from "@opensea/tool-sdk"
import { base } from "viem/chains"

const adapter = createWalletFromEnv()
const walletClient = await walletAdapterToClient(adapter, base)

const composite = new CompositePredicateClient({
  predicateAddress: "0xYOUR_COMPOSITE_PREDICATE",
  walletClient,
})
```

**Example: "owns ERC-721 X **OR** has active subscription Y"**

```typescript
await composite.setComposition(toolId, CompositeOp.ANY, [
  { predicate: "0xc8721c9A776958FfFfEb602DA1b708bf1D318379", negate: false },
  { predicate: "0xCBe0cd9B1d99d95Baa9c58f2767246C52e461f25", negate: false },
])
```

**Example: "owns ERC-721 X **AND NOT** owns ERC-1155 Z"**

```typescript
await composite.setComposition(toolId, CompositeOp.ALL, [
  { predicate: "0xc8721c9A776958FfFfEb602DA1b708bf1D318379", negate: false },
  { predicate: "0x77373Dc3c1AE9A1e937eF3e5E08F4807D47c7c11", negate: true },
])
```

**Read current composition:**

```typescript
const op = await composite.getOp(toolId)     // CompositeOp.ALL or CompositeOp.ANY
const terms = await composite.getTerms(toolId) // [{ predicate, negate }]
```

## WalletStateAttestationPredicate

Gates access based on offchain-signed wallet-state attestations. Designed for cross-chain wallet state that cannot be evaluated natively in EVM (e.g., Solana, XRPL, Bitcoin holdings). An offchain issuer evaluates conditions against the relevant chain, signs a verdict, and the onchain predicate verifies the signature via the RIP-7212 P-256 precompile.

| Field | Value |
|-------|-------|
| Requirement `kind` | `0x7a111640` (`IWalletStateAttestation` interface ID) |
| Requirement `data` (getRequirements) | `abi.encode(string issuerJWKSURI, bytes32 conditionHash)` |
| Proof `data` (hasAccess) | `abi.encode(bool pass, address wallet, bytes32 conditionHash, uint256 blockNumber, bytes32 r, bytes32 s, bytes32 messageHash)` |
| Signature verification | ECDSA P-256 via RIP-7212 precompile (~3,450 gas) |

This is a third-party predicate type. No canonical deployment exists; each issuer deploys their own instance. The `IWalletStateAttestation` marker interface is not pinned in `IRequirementTypes.sol` but is a valid extension per the spec's open `kind` namespace.

**Decode requirements via SDK:**

```typescript
import { decodeRequirement, WALLET_STATE_ATTESTATION_KIND } from "@opensea/tool-sdk"

const decoded = decodeRequirement(req)
if (decoded.type === "walletStateAttestation") {
  // decoded.issuerJwksUri — URL to fetch the issuer's JWKS public key set
  // decoded.conditionHash — identifies which condition set the predicate enforces
  console.log(`Issuer JWKS: ${decoded.issuerJwksUri}`)
  console.log(`Condition:   ${decoded.conditionHash}`)
}
```

**Manifest access declaration (manual):**

```json
{
  "access": {
    "logic": "AND",
    "requirements": [
      {
        "kind": "0x7a111640",
        "data": "<abi.encode(string issuerJWKSURI, bytes32 conditionHash)>",
        "label": "Cross-chain wallet attestation required"
      }
    ]
  }
}
```

**Reference implementation:** [douglasborthwick-crypto/insumer-examples](https://github.com/douglasborthwick-crypto/insumer-examples)

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
    case "erc20Balance":
      console.log(`Requires balance >= ${decoded.minBalance} of token ${decoded.token}`)
      break
    case "walletStateAttestation":
      console.log(`Requires attestation from ${decoded.issuerJwksUri} (condition: ${decoded.conditionHash})`)
      break
    case "unknown":
      console.log(`Unknown requirement kind ${decoded.kind}`)
      break
  }
}
```
