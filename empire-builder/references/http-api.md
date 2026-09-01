# Empire Builder — HTTP API (skill-local reference)

**Base URL:** `https://empirebuilder.world`

**Production mainnet:** Hosts and chains are **live** (Base `8453`, Arbitrum `42161`). **`distribute-prepare`** and broadcasting **`executeBatch`** update on-chain balances. **`POST /api/store-distribution`** persists from **mined `transactionHashes`** (receipt-backed), so stored distributions align with **what executed on-chain**, not unconstrained re-submission of prepare JSON alone.

**Errors:** JSON `{ "error": "message" }` with usual HTTP codes (`400`, `401`, `403`, `404`, `429`, `500`).

---

## Authentication modes

| Mode | When |
|------|------|
| None | Many GET routes |
| **`x-api-key`** header (or `api_key` query) | Server-enforced partner/read/write routes — send unless the row says “—” |
| **`x-api-key` + EIP‑191 personal sign** | Body includes **`signature`**, **`message`**, plus **`signer`** or **`signerAddress`** depending on route |

API keys may also be validated via **`validateRequest`** (allowed origins + key). Assume **`Content-Type: application/json`** on POST/PATCH/DELETE bodies.

---

<a id="empire-id-base_token"></a>

## Empire ID (`base_token`)

Many parameters labeled **`tokenAddress`** or **`baseToken`** mean **Empire ID**, not always an ERC‑20:

| Kind | Example |
|------|---------|
| Token empire | `0x` + 40 hex |
| Farcaster tokenless | `fid` + digits |
| Custom tokenless slug | alphanumeric slug from product rules |

**SmartVault address** = **`empire_address`** from empire payloads — distinct from Empire ID.

Resolve empire rows via **`GET /api/empires/[empire_id]`** (`empire_id` path segment = Empire ID).

---

## Endpoint catalog

### Reads (typical)

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/top-empires` | — |
| GET | `/api/empires` | — |
| GET | `/api/empires/[empire_id]` | — |
| GET | `/api/empires/search?q=` | — |
| GET | `/api/empires/owner/[wallet]` | — |
| GET | `/api/empires/ranking` | — |
| GET | `/api/empires/check` | — |
| GET | `/api/leaderboards?tokenAddress=<empire_id>` | — |
| GET | `/api/leaderboards/[id]` | — |
| GET | `/api/leaderboards/consolidated?tokenAddress=` | — |
| GET | `/api/boosters/[address]` | — |
| GET | `/api/staking-boosters/[address]` | — |
| GET | `/api/empires/activate-staking?tokenAddress=` | — |
| GET | `/api/empire-rewards/[token]` | — |
| GET | `/api/empire-rewards/[token]/[type]` | — |
| GET | `/api/rewards/recipients/[txHash]` | — |
| GET | `/api/distribution-records/[empireAddress]` | — |
| GET | `/api/airdrops/[tokenAddress]` | API key |
| GET | `/api/empire-airdrop-total` | — |

### Writes — distributions & accounting

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/distribute-prepare` | API key + sig (**signer = vault `owner()`**) |
| POST | `/api/store-distribution` | API key |
| POST | `/api/store-burn` | API key |
| POST | `/api/store-airdrop` | API key |

### Writes — deploy & empire lifecycle

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/get-token-config` | API key |
| POST | `/api/deploy-empire` | API key + sig |
| POST | `/api/deploy-empire-tokenless` | API key + sig |

### Writes — leaderboards & boosters

| Method | Path | Auth |
|--------|------|------|
| PATCH | `/api/leaderboards/refresh/[type]` | API key |
| POST | `/api/leaderboards/[type]` | API key + sig |
| POST | `/api/leaderboards/delete` | API key |
| POST | `/api/boosters/[empire_id]` | API key + sig |
| DELETE | `/api/boosters/[empire_id]` | API key + sig |
| POST | `/api/staking-boosters/[empire_id]` | API key + sig |
| DELETE | `/api/staking-boosters/[empire_id]` | API key + sig |
| POST | `/api/empires/activate-staking` | API key + sig |

---

## Leaderboard create paths (`POST /api/leaderboards/...`)

Creation is **never** a generic POST to `/api/leaderboards` alone — always a **type suffix**:

| Type | Path suffix |
|------|-------------|
| Token holders | `tokenHoldersLeaderboards` |
| Stakers (StakingLocker on Base / Arbitrum) | `stakersLeaderboards` |
| NFT | `nftLeaderboards` |
| External JSON API | `apiLeaderboards` |
| CSV upload body | `csvLeaderboards` |
| FarToken | `farTokenLeaderboards` |
| Tipn | `tipnLeaderboards` |
| Farcaster cast | `farcasterCastLeaderboards` |
| Farcaster channel | `farcasterChannelLeaderboards` |
| Farcaster interaction | `farcasterInteractionLeaderboards` |
| Quotient | `quotientLeaderboards` |

Example: **`POST https://empirebuilder.world/api/leaderboards/csvLeaderboards`**

### Auth + signing (all leaderboard creates)

- Requires **API key + signature**.
- **Signature fields are always**: `signature`, `message`, **`signerAddress`**.
- The server verifies `verifyMessage({ address: signerAddress, message, signature })` and then checks the signer is a **guardian** of the empire:
  - `signerAddress` must equal `empires.owner` **or** be included in `empires.co_emperors` for the target empire.
- **Message format:** for leaderboard creates the backend **does not enforce a specific template**; it only verifies the signature against the provided `message`.

**Recommended canonical message template (agent-side):**

Use a consistent, human-readable message to make signatures auditable and easy to debug. Suggested format:

```text
Empire Builder — Create Leaderboard
type: <leaderboard_path_suffix>
empireId: <tokenAddress>
name: <name>
timestamp: <ISO-8601>
nonce: <random-uuid>
```

Notes:

- `leaderboard_path_suffix`: e.g. `csvLeaderboards`, `tokenHoldersLeaderboards`, `farcasterChannelLeaderboards`
- Include `timestamp` + `nonce` to reduce replay risk and make logs unambiguous (server currently does not enforce these, but they help operators).

### `POST /api/leaderboards/tokenHoldersLeaderboards`

Creates a “token holders” leaderboard for an empire. **`tokenAddress` is the Empire ID** (base token or tokenless ID), and **`erc20Address` is the ERC‑20 you’re ranking**.

**Request body schema (JSON):**

```json
{
  "tokenAddress": "<empire_id>",
  "erc20Address": "0x...",
  "erc20ChainId": 8453,
  "erc20Name": "optional string",
  "erc20Symbol": "optional string",
  "erc20ImageUrl": "optional string",
  "applyBoosters": true,
  "signature": "0x...",
  "message": "plain text that was signed",
  "signerAddress": "0xGuardian"
}
```

**Required fields:** `tokenAddress`, `erc20Address`, `signature`, `message`, `signerAddress`.

Working example:

```json
{
  "tokenAddress": "fid123",
  "erc20Address": "0x1111111111111111111111111111111111111111",
  "erc20ChainId": 8453,
  "applyBoosters": true,
  "signature": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "message": "Create token holders leaderboard for fid123 ranking 0x1111111111111111111111111111111111111111",
  "signerAddress": "0x2222222222222222222222222222222222222222"
}
```

### `POST /api/leaderboards/stakersLeaderboards`

Creates a "stakers" leaderboard ranked by on-chain stake in the immutable **StakingLocker** contract. **`tokenAddress` is the Empire ID**, and **`erc20Address` is the ERC‑20 you're ranking by stake**. Available on Base (`8453`) and Arbitrum (`42161`) only.

The empire's strip auto-creates this when a guardian calls `POST /api/empires/activate-staking`, but the route can be invoked directly for any ERC‑20 the contract has stakers for.

**Request body schema (JSON):**

```json
{
  "tokenAddress": "<empire_id>",
  "erc20Address": "0x...",
  "erc20ChainId": 8453,
  "erc20Name": "optional string",
  "erc20Symbol": "optional string",
  "erc20ImageUrl": "optional string",
  "applyBoosters": true,
  "applyReputationBoosters": true,
  "applyStakingBoosters": true,
  "signature": "0x...",
  "message": "plain text that was signed",
  "signerAddress": "0xGuardian"
}
```

**Required fields:** `tokenAddress`, `erc20Address`, `signature`, `message`, `signerAddress`.

Notes:

- Reads stakers + balances directly from the StakingLocker (paginated `getStakersPage`).
- Boosters apply additively on top of staked balance: token, reputation, and STAKING boosters (capped at +5x for the staking portion).
- Refresh via `PATCH /api/leaderboards/refresh/stakersLeaderboards`.

### `POST /api/leaderboards/csvLeaderboards`

Creates a custom leaderboard from an explicit list of address→score rows. **`tokenAddress` is the Empire ID** (supports tokenless).

**Request body schema (JSON):**

```json
{
  "tokenAddress": "<empire_id>",
  "name": "string (≤ 20 chars)",
  "description": "string (≤ 180 chars)",
  "csvEntries": [{ "address": "0x...", "score": 1.23 }],
  "applyBoosters": true,
  "apply_reputation_boosters": true,
  "icon": "optional string",
  "signature": "0x...",
  "message": "plain text that was signed",
  "signerAddress": "0xGuardian"
}
```

**Required fields:** `tokenAddress`, `name`, `description`, `signature`, `message`, `signerAddress`. (`csvEntries` is required for a useful leaderboard; invalid entries are rejected server-side.)

Working example:

```json
{
  "tokenAddress": "0x3333333333333333333333333333333333333333",
  "name": "Top 10",
  "description": "Manual scores.",
  "csvEntries": [
    { "address": "0x4444444444444444444444444444444444444444", "score": 10 },
    { "address": "0x5555555555555555555555555555555555555555", "score": 5.5 }
  ],
  "applyBoosters": true,
  "apply_reputation_boosters": true,
  "icon": "https://example.com/icon.png",
  "signature": "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "message": "Create CSV leaderboard Top 10 for 0x3333333333333333333333333333333333333333",
  "signerAddress": "0x2222222222222222222222222222222222222222"
}
```

### `POST /api/leaderboards/nftLeaderboards`

Creates a leaderboard based on NFT ownership checks.

- **`tokenAddress` must be an ERC‑20 address** (tokenless empires are not accepted for this type).
- **`nftAddress` is required**. `tokenId` is optional (used for ERC‑1155 / specific series).

**Request body schema (JSON):**

```json
{
  "tokenAddress": "0x...",
  "name": "string (≤ 20 chars)",
  "description": "string (≤ 180 chars)",
  "nftAddress": "0x...",
  "tokenId": "optional string|number",
  "chainId": 8453,
  "nftImage": "optional string",
  "applyBoosters": true,
  "apply_reputation_boosters": true,
  "signature": "0x...",
  "message": "plain text that was signed",
  "signerAddress": "0xGuardian"
}
```

**Required fields:** `tokenAddress`, `name`, `description`, `nftAddress`, `signature`, `message`, `signerAddress`.

Working example:

```json
{
  "tokenAddress": "0x3333333333333333333333333333333333333333",
  "name": "NFT Holders",
  "description": "Holders of the collection.",
  "nftAddress": "0x6666666666666666666666666666666666666666",
  "chainId": 8453,
  "applyBoosters": true,
  "apply_reputation_boosters": true,
  "signature": "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
  "message": "Create NFT leaderboard for 0x3333333333333333333333333333333333333333 using 0x6666666666666666666666666666666666666666",
  "signerAddress": "0x2222222222222222222222222222222222222222"
}
```

### `POST /api/leaderboards/apiLeaderboards`

Creates a leaderboard by fetching and parsing an external JSON API.

- **`tokenAddress` must be an ERC‑20 address** (tokenless empires are not accepted for this type).
- `apiEndpoint` must be a valid URL.
- `privateKey` exists in the request body but is **unused** server-side.

**Request body schema (JSON):**

```json
{
  "tokenAddress": "0x...",
  "name": "string (≤ 20 chars)",
  "description": "string (≤ 180 chars)",
  "apiEndpoint": "https://example.com/leaderboard.json",
  "applyBoosters": true,
  "apply_reputation_boosters": true,
  "icon": "optional string",
  "signature": "0x...",
  "message": "plain text that was signed",
  "signerAddress": "0xGuardian",
  "privateKey": "optional string (unused)"
}
```

**Required fields:** `tokenAddress`, `name`, `description`, `apiEndpoint`, `signature`, `message`, `signerAddress`.

Working example:

```json
{
  "tokenAddress": "0x3333333333333333333333333333333333333333",
  "name": "API Scores",
  "description": "Pulled from our API.",
  "apiEndpoint": "https://example.com/scores.json",
  "applyBoosters": true,
  "apply_reputation_boosters": true,
  "signature": "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
  "message": "Create API leaderboard for 0x3333333333333333333333333333333333333333 using https://example.com/scores.json",
  "signerAddress": "0x2222222222222222222222222222222222222222"
}
```

### `POST /api/leaderboards/farTokenLeaderboards`

Creates a FarToken leaderboard.

- **`tokenAddress` must be an ERC‑20 address** (tokenless empires are not accepted for this type).

**Request body schema (JSON):**

```json
{
  "tokenAddress": "0x...",
  "name": "string (≤ 20 chars)",
  "description": "string (≤ 180 chars)",
  "applyBoosters": true,
  "apply_reputation_boosters": true,
  "signature": "0x...",
  "message": "plain text that was signed",
  "signerAddress": "0xGuardian"
}
```

Working example:

```json
{
  "tokenAddress": "0x3333333333333333333333333333333333333333",
  "name": "FarToken",
  "description": "FarToken scores.",
  "applyBoosters": true,
  "apply_reputation_boosters": true,
  "signature": "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
  "message": "Create FarToken leaderboard for 0x3333333333333333333333333333333333333333",
  "signerAddress": "0x2222222222222222222222222222222222222222"
}
```

### `POST /api/leaderboards/tipnLeaderboards`

Creates a TIPN leaderboard (NFT-driven; similar payload to `nftLeaderboards`).

- **`tokenAddress` must be an ERC‑20 address** (tokenless empires are not accepted for this type).
- **`nftAddress` is required**.

**Request body schema (JSON):**

```json
{
  "tokenAddress": "0x...",
  "name": "string (≤ 20 chars)",
  "description": "string (≤ 180 chars)",
  "nftAddress": "0x...",
  "tokenId": "optional string|number",
  "chainId": 8453,
  "nftImage": "optional string",
  "applyBoosters": true,
  "apply_reputation_boosters": true,
  "signature": "0x...",
  "message": "plain text that was signed",
  "signerAddress": "0xGuardian"
}
```

Working example:

```json
{
  "tokenAddress": "0x3333333333333333333333333333333333333333",
  "name": "TIPN",
  "description": "TIPN eligibility.",
  "nftAddress": "0x6666666666666666666666666666666666666666",
  "chainId": 8453,
  "applyBoosters": true,
  "apply_reputation_boosters": true,
  "signature": "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
  "message": "Create TIPN leaderboard for 0x3333333333333333333333333333333333333333 using 0x6666666666666666666666666666666666666666",
  "signerAddress": "0x2222222222222222222222222222222222222222"
}
```

### `POST /api/leaderboards/farcasterCastLeaderboards`

Creates a leaderboard based on engagement with a specific cast.

- **`tokenAddress` is the Empire ID** (supports tokenless).
- `castScoreIncludes` defaults each field to `true` unless explicitly set to `false`. At least one include must be enabled.

**Request body schema (JSON):**

```json
{
  "tokenAddress": "<empire_id>",
  "name": "string (≤ 20 chars)",
  "description": "string (≤ 180 chars)",
  "castHash": "string",
  "castScoreIncludes": { "likes": true, "recasts": true, "comments": true, "quotes": true },
  "applyBoosters": true,
  "apply_reputation_boosters": true,
  "icon": "optional string",
  "signature": "0x...",
  "message": "plain text that was signed",
  "signerAddress": "0xGuardian"
}
```

Working example:

```json
{
  "tokenAddress": "fid123",
  "name": "Cast",
  "description": "Engagement leaderboard.",
  "castHash": "0xabc123",
  "castScoreIncludes": { "likes": true, "recasts": true, "comments": true, "quotes": false },
  "applyBoosters": true,
  "apply_reputation_boosters": true,
  "signature": "0x11111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111",
  "message": "Create cast leaderboard for fid123 cast 0xabc123",
  "signerAddress": "0x2222222222222222222222222222222222222222"
}
```

### `POST /api/leaderboards/farcasterChannelLeaderboards`

Creates a leaderboard from Farcaster channel activity.

- **`tokenAddress` is the Empire ID** (supports tokenless).
- `filterType`: `"images"` or `"all"` (defaults to `"all"`).
- `minNeynarScore`: clamped to \([0, 1]\) (defaults to `0`).
- `timeframeDays`: one of `7 | 14 | 30 | 90 | 180 | 365` (defaults to `30`).

**Request body schema (JSON):**

```json
{
  "tokenAddress": "<empire_id>",
  "name": "string (≤ 20 chars)",
  "description": "string (≤ 180 chars)",
  "channelId": "string",
  "filterType": "all",
  "minNeynarScore": 0,
  "timeframeDays": 30,
  "applyBoosters": true,
  "apply_reputation_boosters": true,
  "icon": "optional string",
  "signature": "0x...",
  "message": "plain text that was signed",
  "signerAddress": "0xGuardian"
}
```

Working example:

```json
{
  "tokenAddress": "fid123",
  "name": "Channel",
  "description": "Channel leaderboard.",
  "channelId": "base",
  "filterType": "images",
  "minNeynarScore": 0.2,
  "timeframeDays": 30,
  "applyBoosters": true,
  "apply_reputation_boosters": true,
  "signature": "0x22222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222",
  "message": "Create channel leaderboard for fid123 channel base",
  "signerAddress": "0x2222222222222222222222222222222222222222"
}
```

### `POST /api/leaderboards/farcasterInteractionLeaderboards`

Creates a leaderboard based on interactions by a Farcaster user (likes, recasts, replies) over a lookback window.

- **`tokenAddress` is the Empire ID** (supports tokenless).
- `farcasterInput` may be an `fid` (numeric string) or a username (optionally prefixed with `@`).
- `timeframeDays` allowed: `30 | 60 | 90 | 180 | 365` (defaults to `30` if omitted/invalid).

**Request body schema (JSON):**

```json
{
  "tokenAddress": "<empire_id>",
  "name": "string (≤ 20 chars)",
  "description": "string (≤ 180 chars)",
  "farcasterInput": "string",
  "timeframeDays": 30,
  "applyBoosters": true,
  "apply_reputation_boosters": true,
  "icon": "optional string",
  "signature": "0x...",
  "message": "plain text that was signed",
  "signerAddress": "0xGuardian"
}
```

Working example:

```json
{
  "tokenAddress": "fid123",
  "name": "Interactions",
  "description": "Interacted-with users.",
  "farcasterInput": "@vitalik",
  "timeframeDays": 90,
  "applyBoosters": true,
  "apply_reputation_boosters": true,
  "signature": "0x33333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333",
  "message": "Create interaction leaderboard for fid123 for @vitalik (90d)",
  "signerAddress": "0x2222222222222222222222222222222222222222"
}
```

### `POST /api/leaderboards/quotientLeaderboards`

Creates a Quotient leaderboard (requires a `leaderboardName` selector).

- **`tokenAddress` must be an ERC‑20 address** (tokenless empires are not accepted for this type).

**Request body schema (JSON):**

```json
{
  "tokenAddress": "0x...",
  "name": "string (≤ 20 chars)",
  "description": "string (≤ 180 chars)",
  "leaderboardName": "string",
  "applyBoosters": true,
  "apply_reputation_boosters": true,
  "icon": "optional string",
  "signature": "0x...",
  "message": "plain text that was signed",
  "signerAddress": "0xGuardian"
}
```

Working example:

```json
{
  "tokenAddress": "0x3333333333333333333333333333333333333333",
  "name": "Quotient",
  "description": "Quotient leaderboard.",
  "leaderboardName": "top_users",
  "applyBoosters": true,
  "apply_reputation_boosters": true,
  "signature": "0x44444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444",
  "message": "Create quotient leaderboard top_users for 0x3333333333333333333333333333333333333333",
  "signerAddress": "0x2222222222222222222222222222222222222222"
}
```

---

## Leaderboard refresh paths (`PATCH /api/leaderboards/refresh/...`)

| Leaderboard kind | `[type]` segment |
|-------------------|------------------|
| Token holders | `tokenHoldersLeaderboards` |
| Stakers | `stakersLeaderboards` |
| NFT | `nftLeaderboards` |
| API | `apiLeaderboards` |
| CSV | `csvLeaderboards` |
| Far token | `farTokenLeaderboards` |
| Tipn | `tipnLeaderboards` |
| Farcaster cast / channel / interaction | matching `farcaster*Leaderboards` |
| Quotient | `quotientLeaderboards` |
| Legacy holders slot | `holdersLeaderboards` |

Typical body (exact schema enforced server-side):

```json
{
  "leaderboardId": "<uuid>",
  "tokenAddress": "<empire_id>"
}
```

Cool-down (~30s) applies per leaderboard.

---

## `POST /api/distribute-prepare`

Builds payout batches: reads leaderboard (`leaderboardId`: **`"main"`** or custom UUID), splits **`selectedTokenAddresses`** balances across Base + Arbitrum, returns **`transactions[]`**. Returned calldata is meant for vault **`executeBatch`** once broadcast by **`owner()`** on the integration path (see [`contracts.md`](./contracts.md)).

**Auth:** API key + EIP‑191 fields — **`signer`** must be **`owner()`** on the vault. **Co-signers** cannot pass this check and must use the **product UI** (sponsored **`executeBatch`** UserOps) instead of self-broadcasting prepare output.

Representative body:

```json
{
  "treasuryAddress": "0xVault",
  "baseToken": "<empire_id>",
  "selectedTokenAddresses": ["0xTokenA"],
  "distributionMode": "even",
  "leaderboardId": "main",
  "distributePercentage": 100,
  "recipientCount": 100,
  "signature": "0x…",
  "message": "plain text that was signed",
  "signer": "0xOwner"
}
```

Modes: **`even`**, **`weighted`**, **`raffle`** (optional **`raffleWinnerCount`**).

**Response:** includes **`transactions`** — each item has **`chainId`**, vault **`contractAddress`**, **`calls`**, ABI-encoded **`data`** for **`executeBatch`**.

### Transaction submission expectations (agent-ready)

The response is intentionally redundant: you can submit each transaction using either:

- **`calls`**: ABI-encode `executeBatch(calls)` client-side.
- **`data`**: send the already-encoded calldata directly.

Both represent the same call. The server also includes `functionName: "executeBatch"` and `value: "0"` (native ETH to send).

**Required fields per transaction item:**

- `chainId`: chain to broadcast on (e.g. `8453` Base, `42161` Arbitrum)
- `batchIndex`: 0-based index within that chain’s batches
- `contractAddress`: the SmartVault address (same as `treasuryAddress`/`empireAddress`)
- `value`: `"0"` (string)
- `calls`: array of `{ target, value, data }` where `value` is a string integer (wei)
- `data`: full calldata for `executeBatch(calls)`

**Ordering rules:**

- Broadcast transactions **per chain** in ascending `batchIndex` order.
- Within a transaction’s `calls[]`, preserve the order exactly as returned.

**Detecting success/failure:**

- A batch is **successful** when the transaction is mined and the receipt has `status === 1`.
- A batch is **failed** if it reverts (receipt `status === 0`) or never gets mined.
- Only call `POST /api/store-distribution` after you have the mined hashes for the batches you consider “done” (typically: all batches across all chains).

Does **not** charge web “TX credits” — credits attach to sponsored **`executeBatch`** UserOp flows inside the product UI.

**Broadcasting:** The EOA that sends each **`executeBatch`** tx to the vault must be able to authorize it on-chain — only **`owner()`** for direct calls. Co-signer EOAs reverts **`Unauthorized`** if they try the same calldata as a normal transaction. Confirm **`chainId`**, vault **`contractAddress`**, and that **`calls`/`data`** match the prepare response before sending.

---

<a id="post-apistore-distribution"></a>

## `POST /api/store-distribution`

Record confirmed **`executeBatch`** txs after prepare. The server **anchors** this record to **mined** transactions you supply in **`transactionHashes`** (with **`chainId`**): distribution accounting is **derived from on-chain execution** (receipts), not from re-trusting the prepare response as the ground truth for token movements. You still supply **`empireAddress`**, **`baseToken`** (Empire ID), and leaderboard discriminator fields so the event **attributes** correctly; wrong metadata can mis-label an otherwise valid chain tx. Wrong **`executeBatch`** remains irreversible on-chain regardless of store.

```json
{
  "transactionHashes": [{ "hash": "0x…", "chainId": 8453 }],
  "empireAddress": "0xVault",
  "baseToken": "<empire_id>",
  "distributionMode": "weighted",
  "leaderboardType": "main",
  "leaderboardNumber": 0,
  "empireDisplayName": "optional"
}
```

**`baseToken`** here is Empire ID, **not** vault address. Duplicate hashes / stale txs may be skipped — exact behavior enforced server-side.

---

## `POST /api/store-burn`

After a mined transaction whose receipt includes the empire base (or attached base) ERC‑20 **Transfer** to **`0x0`** / **`0x…dEaD`** — from any holder wallet, from the vault via **`owner()`** **`execute`**, or from a **UserOp** **`executeBatch`** in the web app:

```json
{
  "transactionHash": "0x…",
  "empireAddress": "0xVault",
  "chainId": 8453
}
```

---

## `POST /api/get-token-config`

Generates a Clanker v4 `tokenConfig` object server-side (including optional airdrop tree dump) for client-side deployment.

**Auth:** API key (via `x-api-key` header or `api_key` query). No wallet signature is required by this route handler.

**Request body schema (JSON):**

```json
{
  "name": "string",
  "symbol": "string",
  "imageUrl": "string",
  "creatorAddress": "0x...",

  "vaultPercentage": 10,
  "vaultDays": 180,

  "poolType": "standard",
  "feeType": "dynamic",
  "initialMarketCap": 10,

  "staticClankerFee": 1,
  "staticPairedFee": 1,
  "dynamicBaseFee": 1,
  "dynamicMaxLpFee": 2.2,

  "enableDevBuy": false,
  "devBuyAmount": 0,

  "enableAirdrop": false,
  "airdropEntries": [{ "address": "0x...", "amount": 123 }],
  "airdropLockupDays": 30,
  "airdropVestingDays": 0,

  "enableSniperFees": false,
  "sniperFeeDuration": 15,

  "tokenDescription": "string",
  "socialTwitter": "string",
  "socialFarcaster": "string",
  "socialWebsite": "string",
  "socialTelegram": "string"
}
```

**Required fields:** `name`, `symbol`, `imageUrl`, `creatorAddress`.

**Response (JSON):**

```json
{
  "success": true,
  "tokenConfig": { "name": "…", "symbol": "…", "tokenAdmin": "0x…", "image": "…", "pool": {}, "fees": {}, "rewards": {} },
  "airdropTree": null
}
```

Notes:
- If `enableAirdrop` is `true`, `airdropLockupDays` must be `>= 1` or the server returns `400`.
- When an airdrop is enabled and entries exist, the route returns `airdropTree` as `tree.dump()` separately from `tokenConfig`.

---

## `POST /api/deploy-empire`

Registers an empire (deploys SmartVaults on Base + Arbitrum and stores the empire row).

**Auth:** API key (via `validateRequest`). Wallet signature is required **only** for the “existing token” attach flow (no `txHash`).

### Request body — Clanker “fresh deploy” flow (recommended)

If `txHash` is provided, the server validates the transaction receipt (successful, creator match via `tx.from` or ERC-4337 log topic match) and enforces that the token deployment allocated 2000 bps LP rewards to the Empire reward wallet.

```json
{
  "baseToken": "0xDeployedToken",
  "name": "Empire display name",
  "owner": "0xCreatorWallet",
  "txHash": "0xDeployTxHash",
  "chainId": 8453,
  "clankerVersion": "clanker_v4",
  "tokenInfo": { "symbol": "SYMB", "name": "Token Name", "logoURI": "https://..." },
  "empireMetadata": {
    "bio": "optional",
    "website_url": "optional",
    "twitter_url": "optional",
    "warpcast_url": "optional",
    "telegram_url": "optional"
  }
}
```

### Request body — “attach to existing token” flow (signature required)

If `txHash` is **omitted**, `signature` and `message` are required and verified against `owner` on Base then Arbitrum.
The backend auto-classifies token ownership using a clanker → zora → top-holder heuristic.

```json
{
  "baseToken": "0xExistingToken",
  "name": "Empire display name",
  "owner": "0xGuardianWallet",
  "signature": "0x...",
  "message": "plain text to sign",
  "tokenInfo": { "symbol": "SYMB", "name": "Token Name", "logoURI": "https://..." },
  "chainId": 8453
}
```

**Important:**
- Never send `tokenType` in the body — requests containing `tokenType` are rejected (`400`).
- `message` format is **not** server-enforced for this route; it only verifies `verifyMessage({ address: owner, message, signature })`.

**Response:** includes `empireAddress`/`treasuryAddress`, per-chain deploy hashes, and an `empire` object.

---

## `POST /api/deploy-empire-tokenless`

Creates a SmartVault-backed empire without an ERC-20 base token.

**Auth:** API key + EIP-191 signature by `owner`.

**Signature enforcement:** `message` must match **exactly** the template implemented in `src/utils/tokenless-deploy-message.ts`:

- Farcaster mode:
  - `I am deploying a tokenless Farcaster Empire with Farcaster ID {fid} and name {nameTrimmed}`
- Custom mode:
  - `I am deploying a custom tokenless Empire named {nameTrimmed}`

**Request body schema (JSON):**

```json
{
  "mode": "farcaster",
  "owner": "0x...",
  "name": "Display name (<=100 chars)",
  "logoUri": "https://... (optional)",
  "signature": "0x...",
  "message": "exact template text",

  "fid": 12345,
  "farcasterUsername": "optional",
  "bio": "optional (<=2000 chars)",

  "website_url": "optional (custom mode only)",
  "warpcast_url": "optional (custom mode only)",
  "twitter_url": "optional (custom mode only)",
  "telegram_url": "optional (custom mode only)"
}
```

Notes:
- `fid` is required when `mode === "farcaster"` and must match Neynar’s FID for `owner`.
- Signature verification tries Base then Arbitrum.

---

## `POST /api/store-airdrop`

Registers a Clanker launch airdrop (Merkle-claim style) after on-chain deployment.

**Auth:** API key.

**Request body schema (JSON):**

```json
{
  "tokenAddress": "0x...",
  "tokenName": "string",
  "tokenSymbol": "string",
  "creatorAddress": "0x...",
  "airdropEntries": [{ "address": "0x...", "amount": 1000 }],
  "lockupDays": 30,
  "vestingDays": 0,
  "totalAmount": 1500,
  "deploymentTxHash": "0x...",
  "merkleRoot": "0x... (optional)",
  "airdropContractAddress": "0x... (optional)"
}
```

Notes:
- `tokenAddress`, `tokenName`, `creatorAddress`, `airdropEntries`, and `deploymentTxHash` are required.
- The backend **rounds** entry amounts for storage: `amount > 0.1 → 1`, otherwise `0` (and zero-amount entries are not stored).

---

## Boosters

### `GET /api/boosters/[empire_id]`

Returns `{ boosters: Booster[] }` (and injects a default Quotient booster if missing).

### `POST /api/boosters/[empire_id]` (add booster)

**Auth:** API key + one of:
- **Signature auth**: include `signature` + `message` + `signer`, and `signer` must be an empire guardian (owner or co-emperor), or
- **Transaction auth**: include `txHash` (mint.club create flow). Server verifies the tx is recent (<= 2 minutes), successful, and the sender is a guardian.

**Request body schema (JSON):**

```json
{
  "booster": {
    "type": "ERC20",
    "contractAddress": "0x...",
    "multiplier": 1.5,
    "requirement": { "minAmount": "1" },
    "tokenId": "1",
    "chainId": 8453,
    "custom_link": "https://..."
  },
  "signer": "0xGuardian",
  "signature": "0x... (signature auth)",
  "message": "plain text to sign (signature auth)",
  "txHash": "0x... (tx auth; optional alternative)",
  "tokenInfo": { "symbol": "optional", "name": "optional", "logoURI": "optional" }
}
```

Validation notes:
- `multiplier` must be between `1.1` and `5.0` and have **max one decimal place**.
- For `booster.type === "NFT"`, ERC-1155 requires `tokenId` (except OG-dickbutt special case).

### `DELETE /api/boosters/[empire_id]` (remove booster)

**Auth:** API key + signature.

```json
{
  "boosterId": "uuid",
  "signature": "0x...",
  "message": "plain text to sign",
  "signer": "0xGuardian"
}
```

**Note:** This route only manages ERC‑20 / NFT / QUOTIENT boosters. STAKING boosters use the dedicated `/api/staking-boosters/[empire_id]` route below — you cannot create or delete them through this endpoint.

---

## Native staking

Native staking is opt-in per empire. Once activated, it's available on Base (`8453`) and Arbitrum (`42161`) and uses the immutable **StakingLocker** contract (read its address from `NEXT_PUBLIC_STAKING_LOCKER_<chainId>` envs / the `getStakingLockerAddress` helper).

**Lock-up on-chain:** Users stake via `stake(token, amount, lockDuration)` with `lockDuration` in **seconds**, any value **`0` … `315_360_000`** (`0` = flexible; max = 10 years). The contract does not use preset month tiers — only `duration <= MAX_LOCK_DURATION`. STAKING booster `minLockupSeconds` filters stakes by **committed** lock length per position (`unlockTime - startTime` ≥ threshold). Full ABI notes: [`references/contracts.md` → StakingLocker](./contracts.md#stakinglocker-native-staking).

### `POST /api/empires/activate-staking`

Flips the empire's `staking_activated` flag and auto-creates a `stakers` leaderboard. **No on-chain transaction** — guardian signature only.

**Auth:** API key + EIP‑191 signature. `signer` (request body) must be a guardian for the empire.

**Canonical signed message** (the server reconstructs and verifies this exact string):

```
Activate staking for empire <empire_id_lowercase> at <timestamp_ms>
```

**Request body schema (JSON):**

```json
{
  "tokenAddress": "<empire_id>",
  "signer": "0xGuardian",
  "signature": "0x...",
  "timestamp": 1759353600000
}
```

**Required fields:** `tokenAddress`, `signer`, `signature`, `timestamp`. `timestamp` must be within the last 5 minutes.

**Response:**

```json
{
  "success": true,
  "stakingToken": "0xDeployedErc20",
  "chainId": 8453,
  "leaderboardId": "uuid-of-auto-created-stakers-leaderboard"
}
```

If staking was already on: `{ "success": true, "alreadyActive": true }`.

### `GET /api/empires/activate-staking?tokenAddress=<empire_id>`

Returns `{ staking_activated, stakingToken, chainId }` — used by the front-end to decide between "Stake" and "Activate Staking" buttons.

### `GET /api/staking-boosters/[empire_id]`

Returns `{ stakingBoosters: Booster[] }` — the same Booster shape as `GET /api/boosters/[empire_id]`, filtered to `type === "STAKING"`.

### `POST /api/staking-boosters/[empire_id]` (add staking booster)

**Auth:** API key + signature. `signer` must be a guardian. The empire must already have `staking_activated = true` — otherwise this returns `403`.

**Request body schema (JSON):**

```json
{
  "minStake": "1000",
  "minLockupSeconds": 7776000,
  "multiplier": 1.5,
  "signer": "0xGuardian",
  "signature": "0x...",
  "message": "plain text to sign"
}
```

| Field | Type | Notes |
|-------|------|-------|
| `minStake` | string | Integer string in **wei** (18‑dec base units). Sums `amount` on stakes whose lock length ≥ `minLockupSeconds` (flexible → `0` sec; locked → `unlockTime - startTime`). Web app sends wei after converting whole-token input × `10^18`. |
| `minLockupSeconds` | number | Any integer in **`[0, 315360000]`** (matches StakingLocker `MAX_LOCK_DURATION`). `0` = any lock qualifies (including flexible stakes). |
| `multiplier` | number | `1.1` ≤ x ≤ `5.0`, **at most one decimal** |

A user qualifies for the booster when their staked balance — restricted to stakes whose lock duration ≥ `minLockupSeconds` — is ≥ `minStake`. Multiple staking boosters stack additively, capped at +5x total from staking.

Validation notes:

- Booster cap is shared with ERC‑20 / NFT / QUOTIENT boosters.
- Booster row stores `booster_type = "STAKING"`, `booster_address` = empire's deployed ERC‑20.

**Response:** `{ stakingBoosters: Booster[], boosters: Booster[] }`.

### `DELETE /api/staking-boosters/[empire_id]` (remove staking booster)

**Auth:** API key + signature. Same guardian + activated-empire check.

```json
{
  "boosterId": "uuid",
  "signer": "0xGuardian",
  "signature": "0x...",
  "message": "plain text to sign"
}
```

`boosterId` must reference a row with `booster_type = "STAKING"` for this empire — the route ignores other booster rows.

**Response:** `{ stakingBoosters: Booster[], boosters: Booster[] }`.

---

## Signing spec (agent-ready)

### Which field name?

- **Most guardian writes:** use `signature`, `message`, and **`signerAddress`** (leaderboard create routes).
- **Boosters:** uses `signer` (not `signerAddress`) in the handler.
- **`distribute-prepare`:** uses `signer` and additionally requires the signer to equal `SmartVault.owner()`.

### What is `message`?

- Unless an endpoint explicitly enforces an exact template (currently **only** `deploy-empire-tokenless`), `message` can be any plain text.
- Recommended pattern (to prevent replay confusion): include endpoint + empire id + a short nonce/timestamp, e.g.

```text
Empire Builder: create leaderboard for <empire_id> at 2026-04-30T00:00:00Z
```

### How to sign

Use EIP-191 personal-sign.

```ts
const message = "…";
const signature = await walletClient.signMessage({ message });
```
