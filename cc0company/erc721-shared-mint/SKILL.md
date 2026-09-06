---
name: cc0company-erc721-shared-mint
version: 1.0.0
description: Deploy a single-artwork ERC721 collection on cc0.company as an AI agent — one shared image, fixed max supply, multi-phase mint with merkle-allowlist + public windows. Single-payment orchestrator handles deploy + on-chain artwork commit in one server-side flow.
homepage: https://cc0.company
api_base: https://cc0.company/api
chain: base
chain_id: 8453
factory: 0xB9585C09B6A78a16Bfb18D5b49D7F43431623065
reference_deploy: 0x5112A2Db56dA0E5c96fECAf5e11a3F4E6135c9B4
---

# cc0.company ERC721Shared — Skill for AI Agents

Drop a classic NFT collection on Base — one artwork shared by every
minted token, fixed max supply, optional allowlist phases. The
agent-friendly counterpart to the human ERC721 Generative wizard:
**no layers, no DNA, no traits to design** — just an image, a price,
and a phase schedule.

> **Pick the right standard:**
>
> - **ERC721Shared** (this skill) → one image, edition-style drop with
>   allowlist + public phases, fixed max supply. Each token is unique
>   by `tokenId` but renders the same artwork. Pick this for memes,
>   profile-pic drops, single-asset open or limited editions.
> - **ERC1155** (`../erc1155-mint`) → multiple distinct artworks under
>   one contract, mixed edition types (open / limited / 1-of-1
>   auction) per token. Pick this if you want auctions or want to
>   keep multiple drops under one contract.
> - **CC0Store** (ERC721A) → physical product receipts. Tokens are
>   proof-of-purchase, not the artwork.

## Mental model

```
┌─ Collection (= one CC0CollectionShared v3 contract on chain) ──┐
│                                                                 │
│   - name, symbol, description (constructor args)               │
│   - maxSupply (hard cap, baked at deploy)                      │
│   - publicMintPrice + paymentToken (ETH or any ERC20)          │
│   - initialMerkleRoot (allowlist, baked at deploy)             │
│   - SHARED ARTWORK stored fully on-chain via SSTORE2 + DEFLATE │
│                                                                 │
│   Mint surface:                                                │
│     mint(quantity, allowlistProof, allowlistLimit)             │
│     ┌─ public mint     → empty proof, limit=0                 │
│     └─ allowlist mint  → proof from the tree, limit from leaf │
└─────────────────────────────────────────────────────────────────┘
```

Each token in the collection is a unique ERC-721 token, but
`tokenURI(tokenId)` resolves to the **same shared image** for every
ID. Holders get a "#1/100" feel without you having to design 100
distinct images.

## Why "single-payment"

The human wizard makes the creator sign **one ETH transfer**, then
the backend orchestrates the entire deploy + on-chain artwork commit
chain server-side. This skill exposes the same orchestrator to
agents via the standard `402 Payment Required` challenge — your
agent gets a price quote up-front, sends ETH, retries, done.

Old-school flow (still works for ERC1155, fine for agents that
prefer to sign every step) is **2 wallet signatures**: deploy tx,
then upload tx. Single-payment is **1 wallet signature**: ETH
transfer, the backend uses it to drive everything else.

## Who signs what

| Step | Signer | Auth | Cost |
|---|---|---|---|
| Create collection draft (DB row) | Backend | API key | free |
| Upload artwork chunks (transit buffer) | Backend | API key | free |
| Get the deploy quote | Backend | API key | free |
| **Pay** the quoted ETH amount | **Agent** (your wallet) | own pk | quoted dynamically (~$0.05–$0.50 depending on artwork size) |
| `factory.deployCollectionShared(...)` | Backend (with creator=YOU) | API key + payment | already paid in step 4 |
| `addArtworkChunk(...)` × N | Backend (uploader role) | API key + payment | already paid |
| `finalizeArtwork()` | Backend (uploader role) | API key + payment | already paid |
| Mint as buyer | Buyer | own pk | `mintPrice × qty` + gas |
| Rotate merkle root post-deploy | Agent (owner) | own pk | ~$0.01 gas |

**Important: you are the contract owner.** The factory takes
`creator` as an arg and transfers ownership to it in the constructor,
so the resulting contract is owned by your agent's wallet
**regardless of who paid gas to call the factory**. The platform's
backend wallet only gets the `uploader` role, which is scoped to
`addArtworkChunk` + `finalizeArtwork` and **useless after the seal**.

## Prerequisites

1. **A Base EVM wallet** with a few cents of ETH on Base for the
   single deploy payment. Recommended: Coinbase CDP SDK or Base
   MCP. See [`../README.md`](../README.md) for the full options
   list.

2. **An agent API key**. Auto-issued on your first paid x402 invoke
   (e.g. buying an image generation). Pass on every call as
   `Authorization: Bearer <key>` or `X-Agent-API-Key: <key>`.

## The full lifecycle in 5 steps

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Create collection draft (DB row)                             │
│    POST /api/store/agents/me/collections                        │
│    body: { token_standard: "ERC721Shared", name, symbol, ... }  │
│    → returns { collection: { id, ... }, status: "draft" }       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Stream artwork chunks into transit buffer                    │
│    POST /api/store/agents/me/collections/:id/artwork-chunk      │
│    Repeat with chunk_index 0…N-1                                │
│    Final chunk response → { complete: true }                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Get the deploy quote (402 challenge)                         │
│    POST /api/store/agents/me/collections/:id/                   │
│         orchestrate-shared-deploy                               │
│    body: { deploy_params: { ... } }    ← no payment_tx_hash     │
│    → 402 { ethCostWei, platformWallet, chunkCount, ... }        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Send ETH to platformWallet                                   │
│    cdp.evm.sendTransaction({                                    │
│      network: "base",                                           │
│      transaction: { to: platformWallet, value: ethCostWei }     │
│    })                                                           │
│    → returns { transactionHash: "0x..." }                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Retry the orchestrator with payment_tx_hash                  │
│    POST /api/store/agents/me/collections/:id/                   │
│         orchestrate-shared-deploy                               │
│    body: { payment_tx_hash, deploy_params: { ... } }            │
│    → { contract_address, deploy_tx_hash, chunk_tx_hashes, ... } │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                  ✅ Collection is LIVE
                  Buyers call collection.mint() directly
```

---

## Step 1: Create the collection draft

```bash
curl -X POST https://cc0.company/api/store/agents/me/collections \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "name": "Cosmic Dreams",
    "symbol": "COSMIC",
    "description": "100 editions of a hand-drawn cosmic scene.",
    "token_standard": "ERC721Shared",
    "chain": "base",
    "max_supply": 100,
    "mint_price": "1000000000000000",
    "payment_token": "0x0000000000000000000000000000000000000000",
    "royalty_bps": 500
  }'
```

**Field notes:**

| Field | Format | Notes |
|---|---|---|
| `token_standard` | string | Must be `"ERC721Shared"` — separates this from ERC1155 + Generative |
| `mint_price` | string (wei or token base units) | Public mint price PER TOKEN. `"1000000000000000"` = 0.001 ETH |
| `payment_token` | hex address | `0x000…000` = ETH. Any ERC20 = token-priced (USDC on Base: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`) |
| `max_supply` | uint | Hard cap. `0` = unlimited (rarely a good idea for a Shared drop). |
| `royalty_bps` | uint96 | Secondary-market royalty in basis points. `500` = 5%. Recipient defaults to your agent wallet. |

Response:

```json
{
  "success": true,
  "collection": {
    "id": "col_xxx",
    "status": "draft",
    "token_standard": "ERC721Shared",
    "name": "Cosmic Dreams",
    "contract_address": null
  }
}
```

**Save the `collection.id`** for every subsequent step.

## Step 2: Upload the shared artwork (chunked)

The artwork lives **fully on-chain** (no IPFS, no broken links). You
stream it to the backend's in-memory transit buffer in ≤ 50 KB
chunks, then the orchestrator compresses + commits it via SSTORE2 in
Step 5.

**Chunk shape:**
- Encode your artwork as a base64 data URL:
  `data:image/png;base64,iVBORw0KGgo...`
  (also valid: `image/gif`, `image/svg+xml`, `image/jpeg`)
- Slice the string into chunks of ≤ 50,000 characters.
- POST each chunk **in order**. `chunk_index=0` initializes the
  buffer; the buffer auto-completes when all slots are filled.

```typescript
import { readFile } from "node:fs/promises"

const COLLECTION_ID = "col_xxx"
const API_KEY = process.env.CC0_AGENT_API_KEY!

// 1. Read your artwork file and encode it.
const fileBytes = await readFile("./cosmic-dreams.png")
const dataUrl = `data:image/png;base64,${fileBytes.toString("base64")}`

// 2. Slice into ≤ 50KB chunks.
const CHUNK_SIZE = 50_000
const chunks: string[] = []
for (let i = 0; i < dataUrl.length; i += CHUNK_SIZE) {
  chunks.push(dataUrl.slice(i, i + CHUNK_SIZE))
}

// 3. POST each one.
for (let i = 0; i < chunks.length; i++) {
  const res = await fetch(
    `https://cc0.company/api/store/agents/me/collections/${COLLECTION_ID}/artwork-chunk`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        chunk_index: i,
        total_chunks: chunks.length,
        data: chunks[i],
      }),
    },
  )
  const json = await res.json()
  console.log(
    `chunk ${i + 1}/${chunks.length}`,
    json.complete ? "→ buffer complete" : `(${json.received}/${json.total})`,
  )
}
```

**Final chunk response:**

```json
{
  "success": true,
  "complete": true,
  "received": 12,
  "total": 12,
  "collection": { "id": "col_xxx", ... }
}
```

**Caveats:**
- The buffer is **in-memory only** with a **30-minute idle TTL**. If
  you wait too long between chunks (or between Step 2 and Step 3),
  the buffer is dropped and you start over.
- Max practical artwork size: ~5 MB (compressed on-chain). Bigger
  artworks work but the deploy cost grows linearly with byte count.
- Chunks for a single collection MUST be POSTed serially — the
  in-memory buffer is not concurrency-safe.

## Step 3: Get the deploy quote (402 challenge)

POST the orchestrator **without** `payment_tx_hash`. The backend
computes the deploy + upload + finalize cost from the chunk count +
size and replies with the price in WEI.

```bash
curl -X POST https://cc0.company/api/store/agents/me/collections/col_xxx/orchestrate-shared-deploy \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "deploy_params": {
      "name": "Cosmic Dreams",
      "symbol": "COSMIC",
      "description": "100 editions of a hand-drawn cosmic scene.",
      "maxSupply": "100",
      "mintSettings": {
        "publicMintPrice": "1000000000000000",
        "paymentToken": "0x0000000000000000000000000000000000000000",
        "mintStart": 1733000000,
        "mintEnd": 1735000000,
        "maxPerAddress": "5"
      },
      "withdrawRecipients": [
        { "recipient": "0xYourAgentWallet", "percentage": 10000 }
      ],
      "royaltyRecipient": "0xYourAgentWallet",
      "royaltyBps": 500,
      "owner": "0xYourAgentWallet",
      "initialMerkleRoot": "0x0000000000000000000000000000000000000000000000000000000000000000"
    }
  }'
```

**402 response:**

```json
{
  "success": false,
  "error": "Payment Required",
  "message": "Send a plain ETH transfer of ethCostWei to platformWallet, then POST again with payment_tx_hash.",
  "ethCostWei": "4521000000000000",
  "requiredMinPaymentWei": "4068900000000000",
  "platformWallet": "0xPlatformBackendWallet",
  "chunkCount": 11,
  "uploadBytes": 145600,
  "useCompression": true
}
```

### `deploy_params` field reference

| Field | Type | Notes |
|---|---|---|
| `name`, `symbol`, `description` | string | Must match the draft from Step 1. Stored in contract storage. |
| `maxSupply` | string (uint256) | Hard cap. `"0"` = unlimited. |
| `mintSettings.publicMintPrice` | string (wei or token base units) | Price PER MINT. Per-phase overrides come post-deploy via `setMintSettings`. |
| `mintSettings.paymentToken` | address | `0x000…000` = ETH. Any ERC20 = token-priced. |
| `mintSettings.mintStart` / `mintEnd` | unix seconds | Public mint window. Allowlist phases are set post-deploy via `setMerkleRoot` + `setMintSettings`. |
| `mintSettings.maxPerAddress` | string (uint256) | Per-wallet cap. `"0"` = unlimited. |
| `withdrawRecipients` | array | Splits payouts. Percentages are basis points (10000 = 100%), must sum to 10000. |
| `royaltyRecipient` / `royaltyBps` | address / uint96 | Secondary-market royalties (ERC-2981). `500` = 5%. |
| `owner` | address | Contract owner — your agent's wallet, NOT the platform. |
| `initialMerkleRoot` | bytes32 | Allowlist root baked at deploy. Use `0x000…000` if you don't have an allowlist; you can set one later. |

### Building the allowlist merkle root (optional)

If you want allowlist phases sealed at block 0, build a sorted-pair
merkle tree with `keccak256(abi.encodePacked(address, uint256))`
leaves — OpenZeppelin convention. Mirror it exactly so the on-chain
`_verifyAllowlistProof` accepts your proofs.

```typescript
import { StandardMerkleTree } from "@openzeppelin/merkle-tree"

const entries: [string, bigint][] = [
  ["0xAlice", 3n],   // [address, mint limit]
  ["0xBob", 1n],
  ["0xCarol", 5n],
]

const tree = StandardMerkleTree.of(entries, ["address", "uint256"])

const initialMerkleRoot = tree.root  // bytes32 hex string

// Later, when each holder mints, get their per-leaf proof:
const aliceProof = tree.getProof([0])  // index of Alice in `entries`
// → ["0x123…", "0x456…"]   // pass to collection.mint(qty, proof, limit)
```

For lighter dependencies, you can hand-implement the sorted-pair
tree — see [`./examples/build-merkle.ts`](./examples/build-merkle.ts).

## Step 4: Send ETH + finalize the deploy

Wire the quoted `ethCostWei` to `platformWallet` (plain ETH transfer,
**no calldata**), then POST the orchestrator a second time with the
resulting `payment_tx_hash`.

**Via CDP SDK (Coinbase Agentic Wallet):**

```typescript
import { CdpClient } from "@coinbase/cdp-sdk"

const cdp = new CdpClient({
  apiKeyId: process.env.CDP_API_KEY_ID!,
  apiKeySecret: process.env.CDP_API_KEY_SECRET!,
})
const account = await cdp.evm.getOrCreateAccount({ name: "my-agent" })

const { transactionHash: paymentTxHash } = await account.sendTransaction({
  network: "base",
  transaction: {
    to: "0xPlatformBackendWallet" as `0x${string}`,
    value: 4521000000000000n,  // ethCostWei from the 402
    data: "0x",
  },
})
```

**Via viem (raw private key):**

```typescript
import { createWalletClient, http } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { base } from "viem/chains"

const account = privateKeyToAccount(process.env.AGENT_PK! as `0x${string}`)
const client = createWalletClient({ account, chain: base, transport: http() })

const paymentTxHash = await client.sendTransaction({
  to: "0xPlatformBackendWallet" as `0x${string}`,
  value: 4521000000000000n,
})
```

Then retry the orchestrator with the same `deploy_params` plus the
`payment_tx_hash`:

```bash
curl -X POST https://cc0.company/api/store/agents/me/collections/col_xxx/orchestrate-shared-deploy \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "payment_tx_hash": "0xYourEthTransferHash",
    "deploy_params": { ... same as Step 3 ... }
  }'
```

## Step 5: Success — collection is live

```json
{
  "success": true,
  "contract_address": "0xYourDeployedCollection",
  "deploy_tx_hash": "0x...",
  "chunk_tx_hashes": ["0x...", "0x...", "0x..."],
  "finalize_tx_hash": "0x...",
  "collection": {
    "id": "col_xxx",
    "status": "active",
    "contract_address": "0x...",
    "token_standard": "ERC721Shared",
    "shared_artwork_onchain": true,
    "shared_artwork_payment_tx_hash": "0xYourEthTransferHash"
  }
}
```

**What the orchestrator did for you:**
1. Verified the ETH payment covers the quoted cost minus 10% slippage.
2. Called `factory.deployCollectionShared(...)` — you are the
   contract owner, the platform is the uploader.
3. Looped `collection.addArtworkChunk(...)` over every chunk.
4. Called `collection.finalizeArtwork(...)` — the art is now
   permanently sealed and `mint()` is unblocked.
5. Cleared the in-memory buffer.

**Idempotency:** each `payment_tx_hash` can authorize **exactly one
deploy**. If you retry the orchestrator with the same hash against a
different collection, it returns `402 "Payment already consumed"`.
Same for collections that already have a `contract_address`.

---

## Buyer mint flow (no x402 needed)

ERC721Shared accepts ETH or any ERC20 directly via the contract's
`mint(quantity, allowlistProof, allowlistLimit)` function. Buyers
(or AI agents acting as buyers) call it via viem like any standard
NFT contract — no x402 relay, no platform intermediary.

### Public mint (no allowlist)

```typescript
import { createWalletClient, http } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { base } from "viem/chains"

const COLLECTION = "0xYourDeployedCollection" as `0x${string}`
const QUANTITY = 1n
const PUBLIC_MINT_PRICE = 1000000000000000n  // 0.001 ETH per token

const buyer = privateKeyToAccount(BUYER_PK as `0x${string}`)
const client = createWalletClient({ account: buyer, chain: base, transport: http() })

const mintTxHash = await client.writeContract({
  address: COLLECTION,
  abi: [
    {
      type: "function",
      name: "mint",
      inputs: [
        { name: "quantity", type: "uint256" },
        { name: "allowlistProof", type: "bytes32[]" },
        { name: "allowlistLimit", type: "uint256" },
      ],
      outputs: [],
      stateMutability: "payable",
    },
  ],
  functionName: "mint",
  args: [
    QUANTITY,
    [] as `0x${string}`[],   // no allowlist proof for public mint
    0n,                       // no allowlist limit
  ],
  value: PUBLIC_MINT_PRICE * QUANTITY,
})
```

### Allowlist mint (with merkle proof)

```typescript
const PROOF = [
  "0x123...",  // sibling hashes from the allowlist tree
  "0x456...",
] as `0x${string}`[]
const ALLOWLIST_LIMIT = 3n   // the limit the buyer's leaf was hashed with

const mintTxHash = await client.writeContract({
  address: COLLECTION,
  abi: SHARED_MINT_ABI,  // same as above
  functionName: "mint",
  args: [QUANTITY, PROOF, ALLOWLIST_LIMIT],
  value: PUBLIC_MINT_PRICE * QUANTITY,
})
```

**Where to find a buyer's proof:** there's a public proof endpoint
at `GET /api/store/nft-minting/collections/{id}/allowlist/proof?address={buyer}`
that returns the merkle proof + per-leaf limit for that buyer.
Mirror with agent auth at `/api/store/agents/me/collections/{id}/allowlist/proof`
(catch-all proxy).

### USDC-priced mint (paymentToken ≠ address(0))

```typescript
// 1. Approve the collection to spend USDC
await client.writeContract({
  address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",  // USDC on Base
  abi: ERC20_ABI,
  functionName: "approve",
  args: [COLLECTION, PUBLIC_MINT_PRICE * QUANTITY],
})

// 2. Mint without value — the contract pulls USDC from msg.sender
await client.writeContract({
  address: COLLECTION,
  abi: SHARED_MINT_ABI,
  functionName: "mint",
  args: [QUANTITY, [], 0n],
  // no `value` — USDC pulled via transferFrom
})
```

---

## Post-deploy management

| Action | Method | Path |
|---|---|---|
| List the holders | GET | `/api/store/agents/me/collections/{id}/mints` |
| Add airdrop recipients | POST | `/api/store/agents/me/collections/{id}/airdrops` |
| Update allowlist merkle root | POST | `/api/store/agents/me/collections/{id}/allowlist` |
| Read collection stats | GET | `/api/store/agents/me/collections/{id}/stats` |
| Get deployment + chunk tx hashes | GET | `/api/store/agents/me/collections/{id}/deployment-steps` |

All of these proxy to the same routes humans use from the dashboard.
Authentication: Bearer agent API key.

### Rotating the merkle root post-deploy

If you didn't bake an allowlist into `initialMerkleRoot` at deploy,
or you want to switch to a different list later, the owner can call
`setMerkleRoot(bytes32 newRoot)` directly on the contract:

```typescript
const newTree = StandardMerkleTree.of(newEntries, ["address", "uint256"])

await ownerClient.writeContract({
  address: COLLECTION,
  abi: [
    {
      type: "function",
      name: "setMerkleRoot",
      inputs: [{ name: "newRoot", type: "bytes32" }],
      outputs: [],
      stateMutability: "nonpayable",
    },
  ],
  functionName: "setMerkleRoot",
  args: [newTree.root as `0x${string}`],
})
```

### Rotating the public mint window post-deploy

Same pattern — `setMintSettings(...)` is owner-only on the contract.
Used to start a new phase (e.g. after an allowlist window, open the
public window with a higher price).

---

## Read functions you'll need

| Function | Returns | Use for |
|---|---|---|
| `mintSettings()` | `(publicMintPrice, paymentToken, mintStart, mintEnd, maxPerAddress)` | Confirm the current mint config |
| `totalSupply()` | `uint256` | Show "X / maxSupply minted" |
| `maxSupply()` | `uint256` | Hard cap baked at deploy |
| `merkleRoot()` | `bytes32` | Check whether an allowlist is currently active (`0x000…000` = none) |
| `tokenURI(uint256)` | `string` | On-chain JSON metadata, image is a data URL pointing at the SSTORE2 artwork |
| `artworkFinalized()` | `bool` | True after the orchestrator's finalize. Mint is blocked until this is true. |
| `owner()` | `address` | Should be your agent's wallet |

## Events to watch

| Event | When | Notes |
|---|---|---|
| `Transfer(from, to, tokenId)` | Every mint, every transfer | `from == address(0)` = mint |
| `MintSettingsUpdated(...)` | `setMintSettings()` calls | Phase rotation, price changes |
| `ArtworkFinalized()` | Once, by orchestrator | Mint is unblocked from this block |

---

## Complete end-to-end example

A self-contained TypeScript script that takes a local image and
walks through all 5 steps. Drop it in [`./examples/full-deploy.ts`](./examples/full-deploy.ts)
to run.

```typescript
import { readFile } from "node:fs/promises"
import { CdpClient } from "@coinbase/cdp-sdk"

const API = "https://cc0.company/api"
const API_KEY = process.env.CC0_AGENT_API_KEY!
const headers = {
  "Content-Type": "application/json",
  "Authorization": `Bearer ${API_KEY}`,
}

async function main() {
  // 1. Create draft.
  const draft = await fetch(`${API}/store/agents/me/collections`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Cosmic Dreams",
      symbol: "COSMIC",
      description: "100 editions of a hand-drawn cosmic scene.",
      token_standard: "ERC721Shared",
      chain: "base",
      max_supply: 100,
      mint_price: "1000000000000000",
      payment_token: "0x0000000000000000000000000000000000000000",
      royalty_bps: 500,
    }),
  }).then((r) => r.json())
  const collectionId = draft.collection.id
  console.log("draft created:", collectionId)

  // 2. Upload artwork chunks.
  const bytes = await readFile("./cosmic-dreams.png")
  const dataUrl = `data:image/png;base64,${bytes.toString("base64")}`
  const CHUNK = 50_000
  const chunks = []
  for (let i = 0; i < dataUrl.length; i += CHUNK) {
    chunks.push(dataUrl.slice(i, i + CHUNK))
  }
  for (let i = 0; i < chunks.length; i++) {
    await fetch(
      `${API}/store/agents/me/collections/${collectionId}/artwork-chunk`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          chunk_index: i,
          total_chunks: chunks.length,
          data: chunks[i],
        }),
      },
    )
  }
  console.log(`uploaded ${chunks.length} chunks`)

  // 3. + 4. Quote → pay → retry.
  const cdp = new CdpClient({
    apiKeyId: process.env.CDP_API_KEY_ID!,
    apiKeySecret: process.env.CDP_API_KEY_SECRET!,
  })
  const account = await cdp.evm.getOrCreateAccount({ name: "my-agent" })

  const now = Math.floor(Date.now() / 1000)
  const deployParams = {
    name: "Cosmic Dreams",
    symbol: "COSMIC",
    description: "100 editions of a hand-drawn cosmic scene.",
    maxSupply: "100",
    mintSettings: {
      publicMintPrice: "1000000000000000",
      paymentToken: "0x0000000000000000000000000000000000000000",
      mintStart: now,
      mintEnd: now + 60 * 60 * 24 * 30,
      maxPerAddress: "5",
    },
    withdrawRecipients: [
      { recipient: account.address, percentage: 10000 },
    ],
    royaltyRecipient: account.address,
    royaltyBps: 500,
    owner: account.address,
    initialMerkleRoot:
      "0x0000000000000000000000000000000000000000000000000000000000000000",
  }

  const quote = await fetch(
    `${API}/store/agents/me/collections/${collectionId}/orchestrate-shared-deploy`,
    { method: "POST", headers, body: JSON.stringify({ deploy_params: deployParams }) },
  ).then((r) => r.json())
  console.log("quote:", quote)

  const { transactionHash: paymentTxHash } = await account.sendTransaction({
    network: "base",
    transaction: {
      to: quote.platformWallet,
      value: BigInt(quote.ethCostWei),
      data: "0x",
    },
  })
  console.log("paid:", paymentTxHash)

  const deployed = await fetch(
    `${API}/store/agents/me/collections/${collectionId}/orchestrate-shared-deploy`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        payment_tx_hash: paymentTxHash,
        deploy_params: deployParams,
      }),
    },
  ).then((r) => r.json())

  console.log("LIVE:", deployed.contract_address)
  console.log("OpenSea:", `https://opensea.io/assets/base/${deployed.contract_address}/1`)
}

main().catch(console.error)
```

---

## Error matrix

| Status | Error | Cause | Fix |
|---|---|---|---|
| 401 | "Invalid API key." | Bearer / X-Agent-API-Key missing or wrong | Auto-issued on first paid x402 invoke; check `agent.api_key` from that response |
| 403 | "This collection does not belong to your agent profile." | `collection.profile_id !== agent.profile_id` | Use a collection you created via Step 1 with the SAME API key |
| 400 | "Artwork chunks not yet complete. POST chunks to /artwork-chunk first" | You skipped Step 2 OR the 30-min idle TTL dropped your buffer | Re-run Step 2 immediately before Step 3 |
| 400 | "Collection already deployed." | `collection.contract_address` is set | Each draft can only be deployed once. Create a new draft. |
| 402 | "Payment Required" + `ethCostWei` | First POST without `payment_tx_hash` (intended) | Pay and retry per Step 4 |
| 402 | "Payment verification failed" | Tx hash doesn't exist on chain yet, or value is too low | Wait for inclusion; bump value if rejected for insufficient amount |
| 402 | "Payment already consumed" | Same `payment_tx_hash` was used for another collection | Send a fresh ETH payment for the new deploy |
| 503 | "Price oracle unavailable" | Price feed RPC blip | Retry in 10s |

---

## Platform addresses (Base mainnet)

| Address | Purpose |
|---|---|
| `0xB9585C09B6A78a16Bfb18D5b49D7F43431623065` | CC0 Collection Factory v9 — deploys CC0Store, CC0Collection1155, AND CC0CollectionShared |
| `0x5112A2Db56dA0E5c96fECAf5e11a3F4E6135c9B4` | CC0CollectionShared v3 reference deploy — Basescan "Similar Match" verification anchor |
| `0x2906bff63e65e95bd05442a995b0e151febbad67` | Inflater (DEFLATE decompression) — read by every Shared collection's tokenURI |
| `0x151a3443eC023dB682419C9e2d8004C75c6584c0` | Platform fee recipient — receives the on-chain 5% mint cut |
| `0xAabEc077428420333c45b6D84455d4EAE8Ee0625` | Platform wallet — receives ETH deploy payments, acts as uploader |
| `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | USDC on Base |

## Platform fee

5% platform fee on all mints, distributed to cc0.company treasury.
Baked into the contract — you can't disable it. Royalty (your
`royaltyBps`) is separate and goes to your `royaltyRecipient` on
secondary-market sales.

## See also

- [`../erc1155-mint/SKILL.md`](../erc1155-mint/SKILL.md) — multi-token
  art drops with auctions
- [`../x402-payments/SKILL.md`](../x402-payments/SKILL.md) — paying
  x402 endpoints (e.g. for AI image generation)
- [`https://cc0.company/skill.md`](https://cc0.company/skill.md) —
  flat HTTP-level API reference
