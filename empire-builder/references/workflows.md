# Empire Builder — End-to-End Workflows

Companion to [`SKILL.md`](../SKILL.md). Routes + payloads also spelled out in [`http-api.md`](./http-api.md).

**Base URL:** `https://empirebuilder.world` — Base `8453` and Arbitrum `42161` mainnet only (see [`SKILL.md`](../SKILL.md#intentional-product-behavior)).

---

## Workflow 1 — Launch Clanker token + Empire

1. **`POST /api/get-token-config`** with API key (**no wallet signature**) → **`tokenConfig`**, **`rpcUrl`**.
2. **`Clanker.deploy(tokenConfig)`** via a wallet the **operator controls**, using pinned **`clanker-sdk`** / **`viem`** versions from [`SKILL.md` frontmatter](../SKILL.md) (not `@latest`).
3. **`POST /api/deploy-empire`** — **`baseToken`**, **`owner`**, **`tokenInfo`**, **`txHash`** from deploy, **`chainId`** (`8453` / `42161`). Receipt validates LP wiring when native.
4. **`GET /api/empires/<empire_id>`** → read **`empire_address`** (vault), **`base_token`**, metadata.
5. Optional leaderboards: **`POST /api/leaderboards/<type>`** (guardian-signed JSON; signature fields use **`signerAddress`**).
6. Optional refresh: **`PATCH /api/leaderboards/refresh/<type>`** with API key (`leaderboardId` + `tokenAddress` empire id).

---

## Workflow 2 — Attach Empire to existing token

1. Prove custody off-chain/on-chain per backend checks.
2. **`POST /api/deploy-empire`** — guardian signature pattern; **omit** `tokenType` input field — backend chooses **`token_type`**.

---

## Workflow 3 — Treasury distribution (integration path)

1. **`GET /api/leaderboards?tokenAddress=<empire_id>`** → choose **`leaderboardId`** UUID **or** literal **`"main"`** default tab resolution.
2. **`POST /api/distribute-prepare`** — API key + **`signature`/`message`/`signer`** where **`signer`** is **`owner()`** vault address.
3. Iterate **`transactions[]`** in **`batchIndex`** order per **`chainId`**: submit **`executeBatch`** on **`contractAddress`** using supplied **`calls`** or raw **`data`** — caller pays gas. Confirm **`chainId`**, vault **`contractAddress`**, and calldata match the prepare response before broadcasting.
4. **`POST /api/store-distribution`** — API key + mined **`transactionHashes`** array + **`empireAddress`** + **`baseToken` empire id** + leaderboard discriminator fields. The backend **derives** distribution accounting from those **mined** txs (receipts), not from prepare JSON alone; still **verify** metadata matches the vault and empire you intended.

Batch submit checklist (per `transactions[]` item):

- Use the given **`chainId`** + **`contractAddress`**.
- **Verify** `chainId` is `8453` or `42161`, and **`contractAddress`** matches `GET /api/empires/[empire_id]`; compare recipients and amounts to the prepare payload.
- Call `executeBatch` with either:
  - the provided `calls[]` (encode client-side), **or**
  - the provided `data` (already ABI-encoded calldata).
- Submit batches in ascending `batchIndex` order **per chain**.
- **Operator** wallet signs and broadcasts (or tooling it controls).
- Consider a batch successful only when mined and the receipt has `status === 1`.

Do **not** substitute legacy **`distribute-v3`** endpoints or random **`/alchemy-sponsor-userop`** helpers unless explicitly debugging **website** flows — integration uses prepare + self-broadcast + store.

---

## Workflow 4 — Register airdrop metadata

1. Finish merkle / contract deployment using whatever launch pipeline applies.
2. **`POST /api/store-airdrop`** with API key — attach **`tokenAddress`**, deployment proofs, recipient roots/lists per backend validation.

---

## Workflow 5 — Fund treasury

Transfer ERC‑20 (or native routing via wrapped ETH patterns) **to `empire_address`** from any wallet. Accounting surfaces via **`GET /api/empires/...`**, consolidated leaderboard reads, distribution prep balances — **do not assume undocumented PATCH treasury ledger endpoints.**

---

## Workflow 6 — Tracked burn

1. On-chain: include an ERC‑20 **Transfer** of the empire **base** (or attached base) to **`0x000…0000`** or **`0x000…dEaD`** (e.g. wallet **`transfer`**, or vault **`owner()`** **`execute`** / **`executeBatch`**, or vault **co-signer** path in the web app: sponsored UserOp **`executeBatch`** with the same inner transfer/burn encoding).
2. **`POST /api/store-burn`** with **`transactionHash`**, **`empireAddress`**, **`chainId`** — server decodes the receipt.

Co-signers **cannot** mint that transfer by calling **`execute`** / **`executeBatch`** on the vault directly; use the **website** (Base / Arbitrum UserOp flow) or burn from a wallet that already holds the tokens.

---

## Workflow 7 — Boosters

1. **`GET /api/boosters/[vaultOrTokenContext]`** — inspect multipliers.
2. **`POST /api/boosters/[empire_id]`** — add booster (API key + guardian-signed payload).
3. **`DELETE /api/boosters/[empire_id]`** — remove booster entry.

This route only manages ERC‑20 / NFT / QUOTIENT boosters. STAKING boosters live behind a dedicated CRUD — see Workflow 8.

---

## Workflow 8 — Native staking + STAKING boosters

Available on Base (`8453`) and Arbitrum (`42161`). The StakingLocker is immutable; activation is a single DB flag plus an auto-created leaderboard.

1. **Activate staking** (guardian-only, no on-chain tx):

   ```text
   POST /api/empires/activate-staking
   { tokenAddress, signer, signature, timestamp }
   ```

   Sign the **exact** canonical message:

   ```text
   Activate staking for empire <empire_id_lowercase> at <timestamp_ms>
   ```

   The route flips `empires.staking_activated = true`, auto-creates a `stakers` leaderboard, and returns `{ stakingToken, chainId, leaderboardId }`.

2. **Inspect activation state** at any time:
   **`GET /api/empires/activate-staking?tokenAddress=<empire_id>`** → `{ staking_activated, stakingToken, chainId }`.

3. **List existing staking boosters**: **`GET /api/staking-boosters/[empire_id]`**.

4. **Add a staking booster** (guardian-signed):

   ```text
   POST /api/staking-boosters/[empire_id]
   { minStake (whole tokens, string), minLockupSeconds, multiplier, signer, signature, message }
   ```

   - `minLockupSeconds` is any integer in **`[0, 315360000]`** (same upper bound as StakingLocker’s `MAX_LOCK_DURATION`). Guardians often pick a value that matches a **committed** stake lock (`unlockTime - startTime` per position), but the API does **not** require fixed month tiers — e.g. `7776000` (90 days) is illustrative only.
   - `multiplier` ∈ `[1.1, 5.0]`, at most one decimal.
   - Counts against the empire's per-empire booster cap.

5. **Remove a staking booster**:

   ```text
   DELETE /api/staking-boosters/[empire_id]
   { boosterId, signer, signature, message }
   ```

6. **Stakers leaderboard**:
   - Create explicitly with **`POST /api/leaderboards/stakersLeaderboards`** (`erc20Address` + `erc20ChainId` are required; staking auto-create already gave you one for the empire token).
   - Refresh with **`PATCH /api/leaderboards/refresh/stakersLeaderboards`** (same `{ leaderboardId, tokenAddress }` shape; same 30s cooldown as other refresh routes).

7. **Side-effects on existing leaderboards** once staking is active:
   - `tokenHolders` and `farToken` refresh routes fold staked balances into Ankr-derived holder balances before scoring.
   - **Every** refresh route (`api`, `csv`, `nft`, `tipn`, `farcasterCast`, `farcasterChannel`, `farcasterInteraction`, `quotient`, `holders`) applies STAKING-booster multipliers additively when `leaderboard.apply_staking_boosters !== false` (defaults to true).
   - The contributing staking-multiplier portion is capped at **+5x** total per user.

---

## Signing matrix

| Step | Requirement |
|------|-------------|
| Leaderboard mutators (`POST /api/leaderboards/*`, boosters add/remove) | Guardian signature bundle; signature fields use **`signerAddress`** for leaderboards, and **`signer`** for boosters |
| `activate-staking` | Guardian signature bundle; `signer`. **Canonical message is template-checked** — `Activate staking for empire <id_lower> at <timestamp_ms>` |
| `staking-boosters` add/remove | Guardian signature bundle; `signer`. Empire must have `staking_activated = true` |
| `distribute-prepare` | **`signer`** must equal on-chain **`owner()`** — not co-signer |
| Direct `executeBatch` to vault (integration) | **EOA tx** must be from **`owner()`** — same calldata from co-signer EOA reverts **`Unauthorized`**. |
| `store-distribution` / `store-burn` | API key only (no fresh signature unless backend adds) |
