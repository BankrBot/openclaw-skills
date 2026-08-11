---
name: jb-permit2-metadata
description: |
  Encode metadata for Juicebox terminal calls using the JBMetadataResolver format. Covers Permit2
  gasless ERC-20 payments, 721 hook tier selection and NFT cash outs, buyback and router swap
  quotes, and combining multiple entries. Use when: (1) seeing AllowanceExpired or
  PermitAllowanceNotEnough errors, (2) metadata extraction returns exists=false or zeros,
  (3) specifying NFT tiers to mint on pay, (4) supplying swap quotes to the buyback hook or router
  terminal, (5) combining several metadata entries in one payment.
version: 6.0.0
---

# JBMetadataResolver: Terminal Metadata Encoding

The `metadata` bytes argument of `pay()`, `addToBalanceOf()`, and `cashOutTokensOf()` is a shared blob multiple contracts read from. `JBMetadataResolver` (nana-core-v6) defines the format:

```
+-------------------------------+ word 0
| 32B reserved for the protocol |
+-------------------------------+ word 1
| lookup table: (bytes4 id, uint8 wordOffset) entries, zero-padded to 32B |
+-------------------------------+ word <offset₁>
| data for id₁, zero-padded to a 32B multiple |
+-------------------------------+ word <offset₂>
| data for id₂, ...             |
+-------------------------------+
```

- Offsets are in **32-byte words**, not bytes; max addressable offset is 255.
- Every data payload must be ≥32 bytes and a multiple of 32 (`createMetadata` reverts `JBMetadataResolver_DataNotPadded` otherwise).
- Consumers call `getDataFor(id, metadata)` → `(bool found, bytes data)`.

Use the `juicebox-metadata-helper` npm package (or replicate `JBMetadataResolver.createMetadata`) rather than hand-packing.

## Metadata IDs

Every ID follows one rule:

```solidity
id = bytes4(bytes20(target) ^ bytes20(keccak256(bytes(purpose))));  // JBMetadataResolver.getId(purpose, target)
```

`target` is the consuming contract — except the 721 hook, whose clones all use the shared implementation address (`METADATA_ID_TARGET`, baked in the implementation's constructor).

Precomputed IDs for the canonical deployments (same addresses on all chains):

| Consumer (target) | purpose | ID | Payload (`abi.encode`) |
|---|---|---|---|
| `JBMultiTerminal` `0x130f5dd2…7f53` | `permit2` | `0xd260d5c9` | `JBSingleAllowance` tuple |
| `JBRouterTerminalRegistry` `0xe0427f25…8cbc` | `permit2` | `0x212df73e` | `JBSingleAllowance` tuple |
| `JBRouterTerminal` `0x0fbcbb3d…18d7` | `permit2` | `0xced33326` | `JBSingleAllowance` tuple |
| `JBRouterTerminal` | `pay` | `0xa27bedbd` | `(address quotedTokenOut, uint256 quotedMinAmountOut)` swap quote |
| `JBRouterTerminal` | `cashOut` | `0x890df4c9` | `(uint256 minTokensReclaimed)` reclaim floor |
| `JB721TiersHook` implementation `0xf4a58871…b5ab` | `pay` | `0x5962def1` | `(bool allowOverspending, uint16[] tierIds)` |
| `JB721TiersHook` implementation | `cashOut` | `0x7214c785` | `(uint256[] tokenIds)` NFTs to burn |
| `JBBuybackHook` `0x77bee1ad…4948` | `pay` | `0xda79b72d` | `(uint256 amountToSwapWith, uint256 minimumSwapAmountOut)` |
| `JBBuybackHook` | `cashOut` | `0xf10fae59` | `(uint256 minimumSwapAmountOut, bool skip)` |

```typescript
import { keccak256, toBytes, type Address } from 'viem'

function computeMetadataId(purpose: string, target: Address): `0x${string}` {
  const hash = BigInt(keccak256(toBytes(purpose)).slice(0, 42)) // first 20 bytes
  const xor = BigInt(target) ^ hash
  return `0x${(xor >> 128n & 0xffffffffn).toString(16).padStart(8, '0')}`
}
```

## Permit2 (gasless ERC-20 payments)

The terminal consumes a `permit2` entry inside `_acceptFundsFor`. Behavior verified in `JBMultiTerminal` / `JBRouterTerminalRegistry`:

- `amount > allowance.amount` reverts `…_PermitAllowanceNotEnough(amount, allowance)`.
- The `PERMIT2.permit` call is wrapped in try/catch — a failed permit emits `Permit2AllowanceFailed` and the transfer falls back to (a) an existing ERC-20 approval to the terminal, then (b) an existing Permit2 allowance.
- The permit's `spender` is `address(this)` — **the contract you call directly**. Paying via the registry means the registry is the spender and the ID target.

### 1. Encode `JBSingleAllowance` as a tuple

```solidity
struct JBSingleAllowance {
    uint256 sigDeadline;
    uint160 amount;
    uint48 expiration;
    uint48 nonce;
    bytes signature;   // EOA, EIP-2098 compact, or EIP-1271 contract signature
}
```

```typescript
import { encodeAbiParameters, type Hex } from 'viem'

function encodeJBSingleAllowance(
  sigDeadline: bigint, amount: bigint, expiration: number, nonce: number, signature: Hex
): Hex {
  return encodeAbiParameters(
    [{
      type: 'tuple',
      components: [
        { name: 'sigDeadline', type: 'uint256' },
        { name: 'amount', type: 'uint160' },
        { name: 'expiration', type: 'uint48' },
        { name: 'nonce', type: 'uint48' },
        { name: 'signature', type: 'bytes' },
      ],
    }],
    [{ sigDeadline, amount, expiration: BigInt(expiration), nonce: BigInt(nonce), signature }]
  )
}
```

Tuple encoding is mandatory — the contract does `abi.decode(parsedMetadata, (JBSingleAllowance))`.

### 2. Sign the Permit2 message

```typescript
const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3'

// Read the current nonce for (owner, token, spender):
const [, , currentNonce] = await publicClient.readContract({
  address: PERMIT2_ADDRESS, abi: permit2AllowanceAbi, functionName: 'allowance',
  args: [userAddress, tokenAddress, terminalAddress],
})

const signature = await walletClient.signTypedData({
  domain: { name: 'Permit2', chainId, verifyingContract: PERMIT2_ADDRESS },
  types: {
    PermitSingle: [
      { name: 'details', type: 'PermitDetails' },
      { name: 'spender', type: 'address' },
      { name: 'sigDeadline', type: 'uint256' },
    ],
    PermitDetails: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint160' },
      { name: 'expiration', type: 'uint48' },
      { name: 'nonce', type: 'uint48' },
    ],
  },
  primaryType: 'PermitSingle',
  message: {
    details: { token: tokenAddress, amount, expiration, nonce: Number(currentNonce) },
    spender: terminalAddress, // the contract being called
    sigDeadline,
  },
})
```

One-time prerequisite: the user must have approved the token to the Permit2 contract itself (`approve(PERMIT2_ADDRESS, maxUint256)`).

### 3. Build and send

```typescript
import createMetadata from 'juicebox-metadata-helper'

function padTo32(data: Hex): Hex {
  const len = (data.length - 2) / 2
  return ('0x' + data.slice(2).padEnd(Math.ceil(len / 32) * 32 * 2, '0')) as Hex
}

const allowanceData = encodeJBSingleAllowance(sigDeadline, amount, expiration, Number(currentNonce), signature)
const metadata = createMetadata(
  [computeMetadataId('permit2', terminalAddress)],
  [padTo32(allowanceData)]
) as Hex

await walletClient.writeContract({
  address: terminalAddress, abi: terminalAbi, functionName: 'pay',
  args: [projectId, tokenAddress, amount, beneficiary, 0n, memo, metadata],
})
```

## 721 hook (NFT tier selection on pay)

The ID target is the shared `JB721TiersHook` **implementation** address (`0xf4a5887170e4d7efb1c874ad88fc82ebf076b5ab`) — every cloned hook reads its `METADATA_ID_TARGET` immutable from the implementation, so one ID works for all 721 projects:

```typescript
const JB721_PAY_ID = '0x5962def1' // computeMetadataId('pay', '0xf4a5887170e4d7efb1c874ad88fc82ebf076b5ab')

const hookData = encodeAbiParameters(
  [{ type: 'bool' }, { type: 'uint16[]' }],
  [true /* allowOverspending */, [1, 3] /* tierIds */]
)
const metadata = createMetadata([JB721_PAY_ID], [padTo32(hookData)])
```

- `allowOverspending: true` → payment beyond tier prices mints project tokens; `false` → leftover reverts. The store-level `preventOverspending` flag overrides the payer's `true`.
- Tier IDs are `uint16[]`.
- Cashing out NFTs: entry `0x7214c785` (`cashOut`), payload `abi.encode(uint256[] tokenIds)`; `cashOutCount` in `cashOutTokensOf` must be 0 (the hook derives the count from NFT weights and reverts on non-zero fungible counts).

## Combining entries

```typescript
const metadata = createMetadata(
  [permit2Id, JB721_PAY_ID],
  [padTo32(allowanceData), padTo32(hookData)]
) as Hex
```

The lookup table lets each consumer find its own entry; unknown entries are ignored. On-chain composers use `JBMetadataResolver.addToMetadata` (append-only).

## Debugging

| Symptom | Cause |
|---------|-------|
| `getDataFor` → `exists: false` in trace | Wrong ID: wrong purpose string, or wrong target (downstream terminal instead of the called contract; cloned hook address instead of the implementation) |
| `exists: true` but zeros / shifted values | Data not padded to 32B, offset computed in bytes instead of words, or struct encoded as loose params instead of a tuple |
| `PermitAllowanceNotEnough` revert | `amount` paid exceeds `allowance.amount` in the signed permit |
| `AllowanceExpired` from Permit2 | `expiration` passed, or the permit silently failed (check for `Permit2AllowanceFailed` event) and a stale prior allowance was used |
| Permit fails but tx still tries to pull | By design: failed permits fall back to existing approvals; the revert then comes from the transfer, not the permit |
| No NFTs minted despite metadata | Payment below tier price, tier sold out/paused/removed, or project's data hook isn't the 721 hook |

## Common mistakes

1. **Encoding `JBSingleAllowance` as individual parameters.** Must be one tuple.
2. **Wrong ID target.** permit2 → the contract you call; 721 → the shared implementation address, not the per-project clone; buyback/router quotes → the hook/router address itself.
3. **Data not padded to a 32-byte multiple.** `createMetadata` and `addToMetadata` reject it; hand-rolled blobs mis-parse.
4. **Offsets in bytes.** They're 32-byte word indices.
5. **Permit2 spender set to the downstream terminal when paying through the registry.** The registry pulls the funds — it's the spender.
6. **`uint256[]` tier IDs.** Tier selection is `uint16[]`.
7. **Reusing a nonce.** Read the live `(owner, token, spender)` nonce from Permit2 before each signature.
