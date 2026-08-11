---
name: jb-721-tier-content
description: |
  Juicebox 721 tier content patterns: IPFS-based static content vs on-chain resolver
  content. Use when: (1) building NFT tier displays for Juicebox projects, (2) deciding
  between encodedIpfsUri and tokenUriResolver, (3) implementing custom on-chain SVG
  resolvers like Banny, (4) debugging tier metadata not loading, (5) understanding the
  tiersOf() / tokenURI() / tokenUriOf() flow.
version: 6.0.0
---

# 721 Tier Content Patterns

`JB721TiersHook` NFTs resolve content through one of two mechanisms:

1. **Static IPFS content** — each tier stores an `encodedIpfsUri` (`bytes32`); `tokenURI` returns `baseUri + base58(CID)`.
2. **Dynamic on-chain content** — a `tokenUriResolver` contract returns the URI for every token; used for generative/composable/on-chain SVG collections (Banny).

Resolution order (`JB721TiersHookLib.resolveTokenURI`): if `STORE.tokenUriResolverOf(hook)` is non-zero, the resolver handles **all** tokens; otherwise `baseUri` + the base58-decoded tier IPFS hash.

| Use case | Solution |
|----------|----------|
| Static artwork per tier | `encodedIpfsUri` in the tier config |
| Dynamic / generative / composable / on-chain SVG | Custom `IJB721TokenUriResolver` |
| Minimal gas and complexity | `encodedIpfsUri` (no resolver) |

## Contract topology

- `JB721TiersHook` (per-project instance) → `STORE` (immutable) → `JB721TiersHookStore` (singleton, same address on every chain — see `references/shared/chain-config.json`).
- `hook.tokenURI(tokenId)` → resolver if set, else IPFS decode.
- `STORE.tiersOf(hook, categories, includeResolvedUri, startingId, size)` returns `JB721Tier[]`.
- `STORE.tokenUriResolverOf(hook)` returns the resolver (zero address = none).

## Token ID encoding

```
tokenId = tierId * 1_000_000_000 + tokenNumber   // tokenNumber starts at 1 per mint
tierId  = tokenId / 1_000_000_000                // STORE.tierIdOfToken(tokenId)
```

For tier previews (unminted content), use the synthetic ID `tierId * 1_000_000_000` (tokenNumber 0) — the store itself passes this to the resolver when `tiersOf` is called with `includeResolvedUri = true`.

## Tier structs

### JB721TierConfig (input, fields in ABI order)

| Field | Type | Meaning |
|-------|------|---------|
| `price` | `uint104` | Price in the currency/decimals of the hook's `JB721InitTiersConfig` |
| `initialSupply` | `uint32` | Max mints from this tier (max 999,999,999) |
| `votingUnits` | `uint32` | Votes per NFT if `flags.useVotingUnits` |
| `reserveFrequency` | `uint16` | Mint 1 reserve NFT per N purchased |
| `reserveBeneficiary` | `address` | Receives reserve NFTs |
| `encodedIpfsUri` | `bytes32` | IPFS CID digest (sha256, `0x1220` multihash prefix stripped) |
| `category` | `uint24` | Grouping key; tiers must be added sorted by category ascending |
| `discountPercent` | `uint8` | Discount applied to the tier |
| `flags` | `JB721TierConfigFlags` | 7 bools (below) |
| `splitPercent` | `uint32` | Portion of the price routed to the tier's split group on mint, out of `JBConstants.SPLITS_TOTAL_PERCENT` |
| `splits` | `JBSplit[]` | The tier's split group |

### JB721TierConfigFlags (7 bools, ABI order)

| Flag | Meaning |
|------|---------|
| `allowOwnerMint` | Owner can mint from this tier on demand |
| `useReserveBeneficiaryAsDefault` | Store this tier's `reserveBeneficiary` as the hook-wide default. WARNING: overwrites the global default, affecting all tiers without a tier-specific beneficiary |
| `transfersPausable` | Transfers can be paused for this tier |
| `useVotingUnits` | Use `votingUnits` for voting power (else price is used) |
| `cantBeRemoved` | Tier cannot be removed once added |
| `cantIncreaseDiscountPercent` | Discount cannot be increased |
| `cantBuyWithCredits` | Only fresh payment value counts — accumulated pay credits can't buy this tier |

### JB721Tier (returned by `tiersOf` / `tierOf`, ABI order)

| Field | Type |
|-------|------|
| `id` | `uint32` |
| `price` | `uint104` |
| `remainingSupply` | `uint32` |
| `initialSupply` | `uint32` |
| `votingUnits` | `uint104` |
| `reserveFrequency` | `uint16` |
| `reserveBeneficiary` | `address` |
| `encodedIpfsUri` | `bytes32` |
| `category` | `uint24` |
| `discountPercent` | `uint8` |
| `flags` | `JB721TierFlags` (5 bools: `allowOwnerMint`, `transfersPausable`, `cantBeRemoved`, `cantIncreaseDiscountPercent`, `cantBuyWithCredits`) |
| `splitPercent` | `uint32` |
| `resolvedUri` | `string` (only populated when `includeResolvedUri = true` and a resolver is set) |

Note the shape difference: config flags have 7 bools, returned tier flags have 5 (`useReserveBeneficiaryAsDefault` and `useVotingUnits` are consumed at storage time).

---

## Pattern 1: Static IPFS content

1. Tier is configured with `encodedIpfsUri`.
2. `tokenURI(tokenId)` returns `baseUri` + base58-encoded CID (`JBIpfsDecoder` re-adds the `0x1220` sha256 multihash prefix). Set `baseUri = "ipfs://"` so the output is a standard `ipfs://Qm...` URI.
3. The CID should point to ERC-721 JSON metadata (`name`, `description`, `image`, `attributes`).

### Encoding / decoding (CIDv0 only)

```typescript
// Encode ipfs://Qm... CID to bytes32 for tier config
function encodeIpfsUri(cid: string): `0x${string}` {
  const decoded = base58Decode(cid.replace('ipfs://', ''))
  return `0x${Buffer.from(decoded.slice(2)).toString('hex')}` // strip 0x1220 multihash prefix
}

// Decode bytes32 back to ipfs:// URI
function decodeEncodedIpfsUri(encoded: string): string | null {
  if (!encoded || encoded === '0x' + '0'.repeat(64)) return null
  const bytes = hexToBytes('1220' + encoded.slice(2)) // re-add sha256 prefix
  return `ipfs://${base58Encode(bytes)}`
}
```

---

## Pattern 2: On-chain resolver content

1. Deploy a contract implementing `IJB721TokenUriResolver` and set it as `tokenUriResolver` in the `JBDeploy721TiersHookConfig` (or later via the hook's URI setter).
2. Leave `encodedIpfsUri` as zero bytes in tier configs.
3. The resolver receives every `tokenURI` call.

```solidity
interface IJB721TokenUriResolver {
    /// @param nft The 721 hook address.
    /// @param tokenId The token ID (or synthetic tierId * 1e9 for tier previews).
    function tokenUriOf(address nft, uint256 tokenId) external view returns (string memory tokenUri);
}
```

A resolver typically extracts `tierId = tokenId / 1_000_000_000`, renders SVG + JSON, and returns a `data:application/json;base64,...` URI. Reference: `Banny721TokenUriResolver` (banny-retail-v6; address in `references/shared/chain-config.json`) — composable outfit layers combined into one on-chain SVG.

### Frontend resolution

```typescript
const storeAddress = await client.readContract({
  address: hookAddress, abi: JB721TiersHookAbi, functionName: 'STORE',
})
const resolverAddress = await client.readContract({
  address: storeAddress, abi: JB721TiersHookStoreAbi,
  functionName: 'tokenUriResolverOf', args: [hookAddress],
})
if (resolverAddress !== zeroAddress) {
  const dataUri = await client.readContract({
    address: resolverAddress,
    abi: [{ name: 'tokenUriOf', type: 'function', stateMutability: 'view',
            inputs: [{ type: 'address' }, { type: 'uint256' }],
            outputs: [{ type: 'string' }] }],
    functionName: 'tokenUriOf',
    args: [hookAddress, BigInt(tierId) * 1_000_000_000n], // synthetic preview ID
  })
}
```

Resolver reads can be gas-heavy (on-chain SVG). Lazy-load per tier, cache results, and use an RPC with a high `eth_call` gas cap.

---

## Deployment config

`JBDeploy721TiersHookConfig` (ABI order): `name`, `symbol`, `baseUri`, `tokenUriResolver`, `contractUri`, `tiersConfig` (`JB721InitTiersConfig { tiers, currency (uint32), decimals (uint8) }`), `flags` (`JB721TiersHookFlags`).

`JB721TiersHookFlags` (5 bools): `noNewTiersWithReserves`, `noNewTiersWithVotes`, `noNewTiersWithOwnerMinting`, `preventOverspending`, `issueTokensForSplits`.

## Categories

- `category` is `uint24`. Tiers must be sorted by category ascending when initializing or calling `adjustTiers` — the store reverts with `JB721TiersHookStore_InvalidCategorySortOrder` otherwise.
- `tiersOf` filters by category and returns tiers sorted by category:

```typescript
const merchTiers = await client.readContract({
  address: storeAddress, abi: JB721TiersHookStoreAbi,
  functionName: 'tiersOf',
  args: [hookAddress, [1n], false, 0n, 100n], // only category 1
})
```

- Default new tiers to category `0` unless the project sells distinct item types; keep human-readable category names in app-level project metadata.

## Common mistakes

- **Field name is `encodedIpfsUri`** (lowercase `pfs`), both in `JB721TierConfig` and `JB721Tier`. Wrong casing breaks ABI encoding by name.
- **Flag names use `cant`, not `cannot`**: `cantBeRemoved`, `cantIncreaseDiscountPercent`, `cantBuyWithCredits`.
- **Config flags are a nested struct.** `JB721TierConfig.flags` is a 7-bool `JB721TierConfigFlags` tuple, not inline bools; returned `JB721Tier.flags` is a different 5-bool shape.
- **Forgetting `splitPercent`/`splits`.** Tier configs include a per-tier split group; set `splitPercent: 0` and `splits: []` when unused.
- **Calling the resolver with a raw tier ID.** Pass the synthetic ID `tierId * 1_000_000_000`, not `tierId`.
- **`tiersOf` with `includeResolvedUri = true` reverting or timing out.** Large on-chain SVG resolvers exceed RPC gas caps — fetch with `false` and lazy-load resolver content per tier.
- **Expecting `baseUri` to apply when a resolver is set.** The resolver takes precedence for every token.
- **Encoding CIDv1 into `encodedIpfsUri`.** The bytes32 encoding assumes a CIDv0 sha256 multihash (`Qm...`).
