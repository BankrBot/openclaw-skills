---
name: cc0company-erc1155-mint
version: 1.0.0
description: Deploy and run an ERC1155 NFT collection on cc0.company as an AI agent — open editions, limited editions, 1/1 auctions, allowlists, airdrops. On-chain storage via SSTORE2 chunks. Platform handles createTokenWithAttributes after agent pays ETH gas.
homepage: https://cc0.company
api_base: https://cc0.company/api
chain: base
chain_id: 8453
factory: 0xB9585C09B6A78a16Bfb18D5b49D7F43431623065
---

# cc0.company ERC1155 Mint — Skill for AI Agents

Drop your own ERC1155 collection on Base. Same on-chain
infrastructure as the human NFT wizard (v9 factory at
`0xB9585C09B6A78a16Bfb18D5b49D7F43431623065`); same bytecode; same
event signatures. Every endpoint below is mirrored at
`/api/store/agents/me/...` with API-key auth + collection-ownership
checks.

## Mental model — 3 levels of objects

```
┌─ Collection (= one ERC1155 contract on chain) ──────────────────┐
│                                                                  │
│   ┌─ Token (one tokenId inside the contract) ────────────────┐  │
│   │   - Name, description, on-chain SVG/PNG artwork (SSTORE2) │  │
│   │   - Edition type: open_edition | limited_edition | auction │  │
│   │   - mint_price, max_supply, mint_start/end_time           │  │
│   │                                                            │  │
│   │   ┌─ Phase (mint window with rules) ──────────────────┐   │  │
│   │   │   - phase_type: public | allowlist | token_gated │   │  │
│   │   │   - start_time, end_time, max_per_wallet         │   │  │
│   │   │   - merkle_root (allowlist), gate_token (token-gated) │  │
│   │   └────────────────────────────────────────────────────┘   │  │
│   └────────────────────────────────────────────────────────────┘  │
│   (one collection → many tokens → many phases per token)         │
└──────────────────────────────────────────────────────────────────┘
```

A **collection** is one ERC1155 contract — deploy it ONCE. Inside it
you create **tokens** — every artwork drop is a new tokenId.
Optionally, gate each token's mint with **phases** (allowlist period
first, then public, with different per-wallet limits).

## Three edition types — choose one per token

| Type | `max_supply` | Use case |
|---|---|---|
| `open_edition` | `0` (= unlimited) | Time-bounded drop. Anyone can mint while open; closes at `mint_end_time`. Common for memes / free claims. |
| `limited_edition` | `N` (fixed) | Hard cap. Often paired with an allowlist phase. Common for curated drops. |
| `auction` | always `1` (1/1) | English auction with reserve price, bids stored on-chain, settle after duration. Common for high-value art. |

The platform won't let you mix: pick one type per token. A collection
can contain a mix of all three types (e.g. one auction + 10 open
editions).

## Who signs what

| Step | Signer | Auth | Cost |
|---|---|---|---|
| Deploy contract (one-time) | Agent (your wallet) | own pk | ~$0.05 gas |
| Create token + upload artwork | **Backend** (platform `uploader` wallet) | agent pays ETH up-front | quoted dynamically (~$0.01–0.10 for typical artwork) |
| Start auction | Agent (`onlyCreator` modifier) | own pk | ~$0.01 gas |
| Settle auction | Anyone (permissionless on-chain) | open | ~$0.01 gas |
| Buy / mint as buyer | Buyer | own pk | mint_price + gas |
| Airdrop (mint to a list) | Backend | agent pays ETH up-front | quoted dynamically |
| Update metadata (pre-freeze) | Backend | agent | no gas (DB only) |
| Freeze metadata | Backend | agent | ~$0.01 gas |

Anything the platform signs (token creation, airdrop, freeze, reveal)
is **gated on a verified ETH payment from the agent to the platform
wallet first**. The backend never touches the chain without
verifying on-chain that you've paid the gas estimate.

## Prerequisites

1. **A Base EVM wallet** with a few cents of ETH on Base for gas
   transfers, and enough USDC for x402 image-gen calls if you're
   generating the artwork too. Recommended: Coinbase CDP SDK or
   Base MCP. See [`../README.md`](../README.md) for the full options
   list.

2. **An agent API key**. Auto-issued on your first paid x402 invoke
   (e.g. buying a generation). Pass on every call as
   `Authorization: Bearer <key>` or `X-Agent-API-Key: <key>`.

## The full lifecycle in 6 steps

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Create collection (DB row)                                   │
│    POST https://cc0.company/api/store/agents/me/collections     │
│    → returns { collection: { id, ... }, status: "draft" }       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Prepare deploy tx (backend builds the v9 factory calldata)   │
│    POST https://cc0.company/api/store/agents/me/                │
│         collections/:id/prepare-deploy                          │
│    → returns { transaction: { to, data, value, chainId }, ... } │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Sign + send the tx FROM YOUR WALLET                          │
│    cdp.evm.sendTransaction({ network: "base", transaction })    │
│    → returns { transactionHash: "0x..." }                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Confirm deployment (backend reads receipt, persists address) │
│    POST https://cc0.company/api/store/agents/me/                │
│         collections/:id/confirm-deploy                          │
│    → returns { contract_address, collection: { ... status: "active" } } │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Create your first token                                      │
│                                                                  │
│   Endpoint: POST /api/store/agents/me/collections/:id/          │
│             tokens/create-and-upload                            │
│                                                                  │
│   5a. Quote: POST <endpoint> with NO `payment_tx_hash`          │
│       → 402 { required_payment: { ethCostWei } }                │
│                                                                  │
│   5b. Send plain ETH transfer to platform wallet                │
│       (0xAabEc077428420333c45b6D84455d4EAE8Ee0625)              │
│       cdp.evm.sendTransaction({ to, value: ethCostWei })        │
│                                                                  │
│   5c. POST <endpoint> WITH `payment_tx_hash` from step 5b       │
│       → backend verifies ETH on-chain, compresses artwork,      │
│         splits into SSTORE2 chunks, calls                       │
│         createTokenWithAttributes via platform uploader wallet   │
│       → 201 { token_id, contract_address }                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. (Optional) Configure phases, allowlists, airdrops, freeze    │
│    Sell the drop. Watch mints come in.                          │
└─────────────────────────────────────────────────────────────────┘
```

## Quick-start: open edition drop (the easiest path)

5 minutes, no allowlist, anyone can mint while open.

```bash
API_KEY="cc0_agent_..."   # your saved API key
COLLECTION_NAME="my memes"
SYMBOL="MYMEME"
PLATFORM_WALLET="0xAabEc077428420333c45b6D84455d4EAE8Ee0625"

# ── 1. Create the collection row ────────────────────────────────
COL=$(curl -s -X POST https://cc0.company/api/store/agents/me/collections \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"$COLLECTION_NAME\",
    \"symbol\": \"$SYMBOL\",
    \"description\": \"$DESC\",
    \"token_standard\": \"ERC1155\",
    \"chain\": \"base\",
    \"royalty_bps\": 500
  }")
COL_ID=$(echo "$COL" | jq -r '.collection.id')

# ── 2. Prepare deploy ───────────────────────────────────────────
PREP=$(curl -s -X POST https://cc0.company/api/store/agents/me/collections/$COL_ID/prepare-deploy \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"collection_id\":\"$COL_ID\"}")
TX_TO=$(echo "$PREP" | jq -r '.transaction.to')
TX_DATA=$(echo "$PREP" | jq -r '.transaction.data')

# ── 3. Sign + send via your wallet ──────────────────────────────
# (CDP example — your runtime; see x402-payments/SKILL.md for variants)
TX_HASH=$(node -e "
  import('@coinbase/cdp-sdk').then(async ({ CdpClient }) => {
    const cdp = new CdpClient({ apiKeyId: process.env.CDP_API_KEY_ID, apiKeySecret: process.env.CDP_API_KEY_SECRET })
    const account = await cdp.evm.getOrCreateAccount({ name: 'my-agent' })
    const { transactionHash } = await account.sendTransaction({
      network: 'base',
      transaction: { to: '$TX_TO', data: '$TX_DATA', value: 0n },
    })
    console.log(transactionHash)
  })
")

# ── 4. Confirm deploy ────────────────────────────────────────────
DEPLOYED=$(curl -s -X POST https://cc0.company/api/store/agents/me/collections/$COL_ID/confirm-deploy \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"tx_hash\":\"$TX_HASH\"}")
CONTRACT=$(echo "$DEPLOYED" | jq -r '.contract_address')
echo "Deployed at $CONTRACT"

# ── 5a. Get the ETH cost quote for the artwork upload ───────────
ARTWORK_B64=$(base64 -w0 < my-meme.png)
QUOTE=$(curl -s -X POST https://cc0.company/api/store/agents/me/collections/$COL_ID/tokens/create-and-upload \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"My first drop\",
    \"description\": \"A meme for the ages\",
    \"max_supply\": \"0\",
    \"mint_price\": \"1000000000000000\",
    \"edition_type\": \"open_edition\",
    \"mint_end_time\": \"$(date -u -d '+7 days' +%Y-%m-%dT%H:%M:%SZ)\",
    \"artwork_data\": \"data:image/png;base64,$ARTWORK_B64\"
  }")
ETH_COST_WEI=$(echo "$QUOTE" | jq -r '.required_payment.ethCostWei')

# ── 5b. Send the ETH transfer ───────────────────────────────────
PAYMENT_TX=$(node -e "
  import('@coinbase/cdp-sdk').then(async ({ CdpClient }) => {
    const cdp = new CdpClient({ apiKeyId: process.env.CDP_API_KEY_ID, apiKeySecret: process.env.CDP_API_KEY_SECRET })
    const account = await cdp.evm.getOrCreateAccount({ name: 'my-agent' })
    const { transactionHash } = await account.sendTransaction({
      network: 'base',
      transaction: { to: '$PLATFORM_WALLET', value: ${ETH_COST_WEI}n },
    })
    console.log(transactionHash)
  })
")

# ── 5c. POST again with payment_tx_hash — backend creates token ─
TOKEN=$(curl -s -X POST https://cc0.company/api/store/agents/me/collections/$COL_ID/tokens/create-and-upload \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"My first drop\",
    \"description\": \"A meme for the ages\",
    \"max_supply\": \"0\",
    \"mint_price\": \"1000000000000000\",
    \"edition_type\": \"open_edition\",
    \"mint_end_time\": \"$(date -u -d '+7 days' +%Y-%m-%dT%H:%M:%SZ)\",
    \"artwork_data\": \"data:image/png;base64,$ARTWORK_B64\",
    \"payment_tx_hash\": \"$PAYMENT_TX\"
  }")
echo "Token created: $(echo "$TOKEN" | jq '.')"
```

That's it. Your collection is live, the token is mintable for 1
week at 0.001 ETH per copy, unlimited supply.

### Token page URL — use `view_url` from the response

The `create-and-upload` response surfaces these scalar fields at the
top level. Use them directly — don't reassemble paths by hand:

```json
{
  "success": true,
  "collection_id":    "01KT3NQJPXG0NWBFCPQFCF8T3W",
  "contract_address": "0x8067f1bf85a93CE792238874597B5bA29b03E644",
  "token_id":         "1",
  "onChainTokenId":   "1",
  "txHash":           "0x...",
  "view_url":         "https://cc0.company/mint/0x8067f1bf85a93CE792238874597B5bA29b03E644/1",
  "legacy_view_url":  "https://cc0.company/nft-collections/01KT3NQJPXG0NWBFCPQFCF8T3W/token/1",
  "basescan_url":     "https://basescan.org/tx/0x...",
  "token":            { ... full DB row ... }
}
```

The **canonical token page URL** is:

```
https://cc0.company/mint/{contract_address}/{token_id}
```

— same shape as most other NFT platforms (OpenSea, Zora, etc.), so it's
the address agents naturally guess. `{contract_address}` is the deployed
contract (you got it back from `confirm-deploy`) and `{token_id}` is
the on-chain token ID (a small integer, starting at `1`, returned in
`onChainTokenId`). Case-insensitive on the contract — both checksummed
and lowercased work.

The legacy `https://cc0.company/nft-collections/{collection_id}/token/{token_id}`
shape still works for backwards compatibility, and is returned as
`legacy_view_url` for tooling that already indexed it.

## Quick-start: limited edition with allowlist

For curated drops where you want to give early access to a specific
wallet list before opening to the public.

```bash
# After steps 1-5 above, with edition_type="limited_edition" and
# max_supply set to e.g. 100:

# Create an allowlist phase
PHASE=$(curl -s -X POST https://cc0.company/api/store/agents/me/collections/$COL_ID/phases \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"phase_type\": \"allowlist\",
    \"name\": \"Whitelist\",
    \"start_time\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
    \"end_time\":   \"$(date -u -d '+1 day' +%Y-%m-%dT%H:%M:%SZ)\",
    \"mint_price\": \"500000000000000\",
    \"max_per_wallet\": 2
  }")
PHASE_ID=$(echo "$PHASE" | jq -r '.phase.id')

# Add wallets to the allowlist (Merkle root regenerates automatically)
curl -s -X POST https://cc0.company/api/store/agents/me/collections/$COL_ID/allowlist \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"phase_id\": \"$PHASE_ID\",
    \"entries\": [
      { \"wallet_address\": \"0x111...\", \"max_mint_quantity\": 2 },
      { \"wallet_address\": \"0x222...\", \"max_mint_quantity\": 2 }
    ]
  }"

# Activate the phase (toggle-able without redeploying)
curl -s -X POST https://cc0.company/api/store/agents/me/collections/$COL_ID/phases/$PHASE_ID/activate \
  -H "Authorization: Bearer $API_KEY"

# Later — add a public phase that starts when the allowlist ends
curl -s -X POST https://cc0.company/api/store/agents/me/collections/$COL_ID/phases \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"phase_type\": \"public\",
    \"name\": \"Public\",
    \"start_time\": \"$(date -u -d '+1 day' +%Y-%m-%dT%H:%M:%SZ)\",
    \"end_time\":   \"$(date -u -d '+7 days' +%Y-%m-%dT%H:%M:%SZ)\",
    \"mint_price\": \"1000000000000000\",
    \"max_per_wallet\": 5
  }"
```

A buyer wallet on the allowlist fetches their Merkle proof via:

```bash
curl -X POST https://cc0.company/api/store/agents/me/collections/$COL_ID/allowlist/proof \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"phase_id\":\"$PHASE_ID\",\"wallet_address\":\"0x111...\"}"
# → { "proof": ["0xabc...", "0xdef..."] }
```

…then passes that proof into the mint call.

## Quick-start: 1/1 auction

```bash
# Step 5 with edition_type="auction":
#   "edition_type": "auction",
#   "auction_duration": 48,            // hours
#   "auction_reserve_price": "10000000000000000"  // 0.01 ETH

# After the token is created, START the auction. This is a tx the
# AGENT signs (onlyCreator on the contract). Use the prepare/confirm
# pattern (same as deploy):
PREP=$(curl -s -X POST \
  https://cc0.company/api/store/agents/me/collections/$COL_ID/tokens/$TOKEN_ID/prepare-start-auction \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json")
# … sign + send tx via your wallet …
curl -s -X POST \
  https://cc0.company/api/store/agents/me/collections/$COL_ID/tokens/$TOKEN_ID/confirm-start-auction \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"tx_hash\":\"$START_TX\"}"

# Poll auction state any time
curl -s https://cc0.company/api/store/agents/me/collections/$COL_ID/tokens/$TOKEN_ID/auction \
  -H "Authorization: Bearer $API_KEY"

# After end_time has passed, settle (anyone can call but here you do it)
curl -s -X POST \
  https://cc0.company/api/store/agents/me/collections/$COL_ID/tokens/$TOKEN_ID/auction/settle \
  -H "Authorization: Bearer $API_KEY"
```

## Complete agent endpoint reference

> **READ THIS BEFORE THE TABLES** — every Path in the tables below is
> RELATIVE. To get the full URL, prepend
> `https://cc0.company/api/store/agents/me`. So `/collections/:id/tokens/create-and-upload`
> in the table = `https://cc0.company/api/store/agents/me/collections/:id/tokens/create-and-upload`
> in a curl call.
>
> Auth: `Authorization: Bearer <key>` OR `X-Agent-API-Key: <key>` —
> both accepted on every endpoint below.
>
> If you're seeing 404 from one of these, check three things in order:
> (1) did you include the `/api/store/agents/me` prefix, (2) did you
> spell the path exactly (case-sensitive), (3) is your collection ID
> the cc0.company internal ID (e.g. `01KT3NQJPXG0NWBFCPQFCF8T3W`) and
> NOT the on-chain contract address.

### Collection lifecycle

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/collections` | Create draft collection (DB row) |
| `GET`  | `/collections/:id` | Read collection (via main agents API) |
| `POST` | `/collections/:id/prepare-deploy` | Build the deploy tx |
| `POST` | `/collections/:id/confirm-deploy` | Persist deployed contract address |
| `POST` | `/collections/:id/freeze` | Permanently freeze metadata |
| `POST` | `/collections/:id/reveal` | Reveal pre-revealed tokens |
| `GET/PUT/DELETE` | `/collections/:id/draft` | Server-side draft auto-save |
| `GET/PATCH/DELETE` | `/collections/:id/deployment-steps` | Resume an interrupted deploy wizard |

### Phases (gating)

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/collections/:id/phases` | List phases |
| `POST` | `/collections/:id/phases` | Create phase (public / allowlist / token_gated / dutch_auction) |
| `GET`  | `/collections/:id/phases/:phaseId` | Read phase |
| `PATCH` | `/collections/:id/phases/:phaseId` | Update phase config |
| `DELETE` | `/collections/:id/phases/:phaseId` | Delete phase |
| `POST` | `/collections/:id/phases/:phaseId/activate` | Toggle phase live |
| `DELETE` | `/collections/:id/phases/:phaseId/activate` | Toggle phase off |

### Allowlist

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/collections/:id/allowlist?phase_id=` | List wallets in phase |
| `POST` | `/collections/:id/allowlist` | Bulk add wallets, regenerates Merkle root |
| `DELETE` | `/collections/:id/allowlist` | Remove wallets |
| `POST` | `/collections/:id/allowlist/proof` | Get Merkle proof for a wallet |

### Tokens

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/collections/:id/tokens` | List tokens |
| `POST` | `/collections/:id/tokens` | Create token row (no artwork) |
| `GET`  | `/collections/:id/tokens/:tokenId` | Read token |
| `PATCH` | `/collections/:id/tokens/:tokenId` | Update token (pre-upload only) |
| `DELETE` | `/collections/:id/tokens/:tokenId` | Delete token (pre-upload only) |
| `POST` | `/collections/:id/tokens/create-and-upload` | One-step: create + upload artwork |
| `GET`  | `/collections/:id/tokens/:tokenId/upload` | Quote ETH cost for upload |
| `POST` | `/collections/:id/tokens/:tokenId/upload` | Upload artwork (with `payment_tx_hash`) |
| `POST` | `/collections/:id/tokens/:tokenId/artwork-chunk` | Append a single SSTORE2 chunk (for huge artwork) |

### Auctions

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/collections/:id/tokens/:tokenId/prepare-start-auction` | Build the startAuction tx |
| `POST` | `/collections/:id/tokens/:tokenId/confirm-start-auction` | Persist startAuction tx hash |
| `GET`  | `/collections/:id/tokens/:tokenId/auction` | Read live auction state |
| `POST` | `/collections/:id/tokens/:tokenId/auction/settle` | Settle finished auction |

### Airdrops

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/collections/:id/airdrops` | List airdrop jobs |
| `POST` | `/collections/:id/airdrops` | Create airdrop (recipients[] + token_id) |
| `GET`  | `/collections/:id/airdrops/:airdropId` | Read airdrop status |
| `PATCH` | `/collections/:id/airdrops/:airdropId` | Retry failed entries |

### Metadata

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/collections/:id/metadata` | List all token metadata |
| `POST` | `/collections/:id/metadata` | Batch set metadata for multiple tokens |
| `GET`  | `/collections/:id/metadata/:tokenId` | Read one token's metadata |
| `POST` | `/collections/:id/metadata/:tokenId` | Set one token's metadata |
| `PATCH` | `/collections/:id/metadata/:tokenId` | Partial update |

### Stats + history

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/collections/:id/stats` | Aggregate stats (minted, holders, revenue) |
| `GET`  | `/collections/:id/mints` | Paginated mint-event history |
| `GET`  | `/token/:contractAddress/:tokenId` | Global token lookup (no collection ID needed) |

### Buyer-side mint (agent buying NFTs from another creator)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/mint/:collectionId/verify` | Eligibility check (allowlist, supply, window) |
| `POST` | `/mint/:collectionId` | Mint token (returns tx data to sign + send) |
| `POST` | `/mint/:collectionId/confirm` | Record mint tx hash for stats reconciliation |

#### Allowlist mint signature (v12 — current)

`mint()` reverts `WrongMintEntrypoint` when the active phase has a
non-zero `merkleRoot`. Use `mintWithProof` instead. The selector
changed in v12 — there is a SECOND `uint256` arg for the
per-leaf cap.

```
mintWithProof(uint256 tokenId, uint256 quantity, uint256 maxQuantity, bytes32[] proof)
```

Leaf format: `keccak256(abi.encodePacked(msg.sender, maxQuantity))`,
sorted-pair tree, OpenZeppelin convention.

Per-wallet caps are encoded in the leaf, so different addresses on
the same allowlist phase can have different allowances. The phase's
global `maxPerAddress` is IGNORED on allowlist phases — `maxQuantity`
wins. Cumulative mints across multiple `mintWithProof` calls on the
same phase must stay ≤ `maxQuantity`. Passing a `maxQuantity` you
weren't added with → InvalidProof revert (the leaf hash mismatches).

`maxQuantity == 0` is rejected with `InvalidInput` — a zero-cap
leaf would defeat the point of an allowlist.

**Where to get the proof + cap**: the platform proof endpoint
returns both for any buyer.

```bash
curl https://cc0.company/api/store/nft-minting/collections/{COL_ID}/allowlist/proof?address={BUYER}
# → { "proof": ["0x...", ...], "maxQuantity": 3 }
```

— or build it off-chain from the creator's published list with
OpenZeppelin's `StandardMerkleTree.of(entries, ["address", "uint256"])`.

**Legacy v11 collections** (deployed before the v12 ref): signature
is the old 3-arg `mintWithProof(uint256, uint256, bytes32[])` with
address-only leaves `keccak256(abi.encodePacked(msg.sender))`. The
platform proof endpoint returns the appropriate shape based on the
collection's deploy block; agents that read `maxQuantity` from its
response are forward-compatible either way (v11 omits the field).

### Chunked upload jobs (huge artwork)

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/upload` | List your upload jobs |
| `POST` | `/upload` | Create job (declares total chunks + SHA256) |
| `GET`  | `/upload/:jobId` | Read job status |
| `DELETE` | `/upload/:jobId` | Cancel job |
| `POST` | `/upload/:jobId/batch` | Push a batch of chunks |
| `POST` | `/upload/:jobId/finalize` | Close job + create on-chain token |
| `POST` | `/upload/:jobId/hash-override` | Rewrite expected SHA256 mid-flight |

## Common errors

| Code | Cause | Fix |
|---|---|---|
| `401` | Missing or invalid API key | Send `Authorization: Bearer <key>` or `X-Agent-API-Key: <key>` |
| `403` | Collection belongs to another agent | Check `collection_id`; agents can only mutate their own |
| `400 contract_address null` | Calling token / freeze / etc before `confirm-deploy` succeeded | Finish deploy first |
| `402 payment required` | Missing `payment_tx_hash` (or invalid) | Send ETH to `0xAabEc077428420333c45b6D84455d4EAE8Ee0625`, retry with the resulting tx hash |
| `402 Payment already consumed` | Reusing a `payment_tx_hash` from a prior upload | Send a fresh ETH transfer for each new token / artwork |
| `409 Collection already deployed` | `prepare-deploy` after `confirm-deploy` already wrote the address | Check `collection.contract_address`; if set, skip the prepare/confirm cycle |
| `Generation refused — metadata frozen` | POST/PATCH to /metadata after /freeze | Freeze is irreversible; create a new collection if you need to update |

## Anti-patterns

- ❌ **Don't sign `createTokenWithAttributes` yourself.** The
  platform's uploader wallet has the `onlyUploader` role on the
  contract. You pay ETH gas; backend signs the actual contract
  call.

- ❌ **Don't hard-code the platform wallet address.** It's
  `0xAabEc077428420333c45b6D84455d4EAE8Ee0625` today, but read it
  from the quote response (`required_payment.payTo`) so future
  rotations don't break your agent.

- ❌ **Don't reuse a `payment_tx_hash` across tokens.** One ETH
  transfer = one upload. The backend rejects double-spends with
  `402 Payment already consumed`.

- ❌ **Don't call `freeze` until you're SURE.** It's irreversible.

- ❌ **Don't try to sign the deploy tx via Bankr's `/agent/submit`
  on a default-config key.** Bankr's "Disable arbitrary contract
  calls" toggle (default ON) blocks deploys. Either flip it off at
  [bankr.bot/security](https://bankr.bot/security) or use CDP /
  viem instead. See [`../x402-payments/SKILL.md`](../x402-payments/SKILL.md).

## Related skills

- [`../x402-payments/SKILL.md`](../x402-payments/SKILL.md) — every
  paid endpoint here uses x402 v2 for ETH/USDC settlement; the
  canonical signing patterns live there
- [`../agent-services/SKILL.md`](../agent-services/SKILL.md) — buy
  AI-generated artwork from cc0.company's 5 LoRA models, then use
  the output as the artwork for a token here

## Background

The on-chain stack: **CC0Collection1155 v12 bytecode** deployed via
the v9 factory at `0xB9585C09B6A78a16Bfb18D5b49D7F43431623065` (the
CC0CollectionFactory; bytecode-agnostic, no factory redeploy
needed for the v12 bump), with the **v12 shared renderer** at
`0xa94a19C76886e3809573b027bf7cfDA7788fe4dC` handling tokenURI
generation. SSTORE2 chunks hold the on-chain artwork (DEFLATE
compressed). Verified on Basescan via bytecode-similarity match
against the v12 reference at `0xb43B9A87ab88F00A01324E3865d8fc117be99dd6`.

Pre-v12 collections still on chain use the legacy v11 renderer
`0x439C31A2ff9B6Df7C77D53C73E3726F786c2658C` + v11 reference
`0xB0EDA98DD5fD8b14777fdcC743bfFbA57a2aBBeF`. The platform's
allowlist proof endpoint returns `contract_version: "v11" | "v12"`
so agents picking between the 3-arg and 4-arg mintWithProof
signatures don't have to derive that themselves.

Source: [github.com/cryptomfer/cc0-nft-contracts](https://github.com/cryptomfer/cc0-nft-contracts) (Solidity).

## License

This skill file is CC0. The on-chain contracts are MIT-licensed.
The artwork minted via this flow is whatever license you stamp on
the token — cc0.company doesn't enforce CC0 on third-party drops,
only on the platform's own collections.
