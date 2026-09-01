# Ophis / CoW orderbook — API reference for the Bankr skill

All facts below are from `@ophis/sdk` (`packages/sdk/src/{orderbook,domain,partner-fee,flow,ethflow,referral}.ts`).

## Endpoints (base URL is per-chain — see chains-and-tokens.md)

| Purpose | Method + path |
|---|---|
| Quote | `POST {orderbook}/api/v1/quote` |
| Publish appData | `PUT {orderbook}/api/v1/app_data/{appDataHash}` body `{"fullAppData": "<json string>"}` |
| Submit order | `POST {orderbook}/api/v1/orders` → returns the order UID string |
| Order status | `GET {orderbook}/api/v1/orders/{uid}` |
| Enroll wallet | `GET https://rebates.ophis.fi/tier/{wallet}` (idempotent; call once before the first order) |

`{orderbook}` is `https://api.cow.fi/<slug>` for CoW-hosted chains, but **`https://optimism-mainnet.ophis.fi` (chain 10)** and **`https://unichain-mainnet.ophis.fi` (chain 130)** for the Ophis-sovereign chains. Hitting `api.cow.fi` on OP/Unichain silently bypasses the Ophis solver **and the fee**.

## The presign authorization flow (why this skill works from a Bankr wallet)

A CoW order is normally authorized with an **EIP-712 signature**. Bankr's Submit API is transaction-centric, so this skill uses the **`presign`** scheme instead:

1. `POST /api/v1/orders` with `signingScheme: "presign"`, `signature: "0x"` → the order is created **presignature-pending** and returns its **UID**.
2. Send an on-chain **`setPreSignature(orderUid, true)`** transaction to the **Settlement** contract (via `POST api.bankr.bot/wallet/submit`). Once mined, solvers may fill the order.

`presign` is a first-class `OphisSigningScheme` value in the SDK, but there is **no SDK helper that calls `setPreSignature`** — this skill encodes that call directly (`ophis_common.encode_set_presignature`). The alternative (EIP-712) would require Bankr's raw typed-data signing endpoint; presign avoids that dependency.

## appData (routes the fee to Ophis)

Built by `ophis_common.build_app_data`:

```json
{"appCode":"ophis","metadata":{"hooks":{},"partnerFee":{"recipient":"0x858f0F5eE954846D47155F5203c04aF1819eCeF8","volumeBps":5}},"version":"1.4.0"}
```

- **`appCode` MUST be the literal `"ophis"`** — a custom appCode makes the rebate indexer silently drop the order.
- **`partnerFee`** is the CIP-75 **VOLUME** policy `{volumeBps, recipient}` (NOT the price-improvement shape). Recipient is the Ophis Safe `0x858f0F5eE954846D47155F5203c04aF1819eCeF8` (CREATE2-deterministic across chains). Default **5 bps** (integrator rate); **1 bp** for stable↔stable pairs. NOTE: this scaffold always sends **5 bps** — `build_app_data` accepts `is_stable_pair` but the CLI never sets it. Wire a per-chain stablecoin lookup into `ophis-swap.py` to charge 1 bp on stable pairs (frontend parity).
- **Referral (optional):** `metadata.ophisReferrer.code` (`/^[a-z0-9_-]{3,64}$/`). Omitting it still yields a valid fee-bearing order; including a partner's own code is how the **integrator earns the rebate** — set it to monetize Bankr-routed volume.
- Signed with `appData = keccak256(fullAppData)`; **submitted** with `appData = full JSON string` + `appDataHash = the hash`. The backend checks `keccak256(appData) == appDataHash`.

## Bankr Submit API

`POST https://api.bankr.bot/wallet/submit` — header `X-API-Key: bk_...`, body:
```json
{"transaction": {"to": "0x..", "chainId": 8453, "value": "0", "data": "0x.."}, "description": "...", "waitForConfirmation": true}
```
Returns `{success, transactionHash, ...}`. Wallet address via `GET /wallet/me`.

**Chain support caveat:** the swap chain must be one Bankr's Submit API can transact on. The reliable overlap of *Bankr-native* wallets and *Ophis-supported* chains is **Base (8453), Unichain (130), Arbitrum (42161), Polygon (137), BNB (56), Ethereum (1)**. Unichain and Base are the sweet spot (Bankr-native **and** a live Ophis stack). Optimism (10) is Ophis-sovereign but was not in Bankr's advertised native wallet set — verify Bankr can submit on OP before relying on it.

## Native-token (ETH) sells — eth-flow (not implemented in this scaffold)

Native sells do NOT use the order path; they call `CoWSwapEthFlow.createOrder(...)` payable (`msg.value == sellAmount`), with the partner fee in appData and on-chain `feeAmount = 0`. eth-flow contracts: OP `0x764fE4aa1FF493cf39931c7923C8ff5837596504`, Unichain `0x38C03729153BCCF6a281DaF41D7C6a14C543F1D7`, CoW-hosted chains `0xba3cb449bd2b4adddbc894d8697f5170800eadec`. The full appData must be `PUT` to the orderbook before/with the tx. To *receive* native ETH, buy WETH and unwrap. (This scaffold sells ERC-20 → ERC-20; extend `ophis-swap.py` for eth-flow if needed.)

## Gotchas (will bite an executable integration)

1. Sign with `appData` = hash; submit with `appData` = full JSON string + `appDataHash` = hash.
2. On OP/Unichain use the **non-canonical** Settlement (signing domain) **and** VaultRelayer (approval) — canonical addresses fail silently.
3. `appCode` must be exactly `"ophis"` or the rebate is dropped.
4. Enroll the wallet (`GET rebates.ophis.fi/tier/{wallet}`) before the first order or trades aren't indexed.
5. Approve the **VaultRelayer** (not Settlement) for `sellAmount (+ feeAmount)`.
6. Signed `feeAmount` is `"0"` for modern market orders; a non-zero signed feeAmount is rejected.

## Scaffold status / to validate before production

- **presign order acceptance:** confirm the live orderbook accepts `signingScheme:"presign"` with `signature:"0x"` on the target chain (some deployments want the owner address as the signature). Adjust `post_order` if so.
- **appData exact bytes:** this scaffold builds a deterministic (sorted-key) appData that is self-consistent with its own hash and carries the correct partnerFee shape. For byte-exact parity with the audited path, consider generating appData + the order body via `@ophis/sdk` (`buildOphisOrderMetadata` / `buildOphisOrderCreation`) in a small Node helper and keeping Python only for the Bankr Submit orchestration.
- **Bankr `/wallet/me` address field:** `bankr_wallet_address` resolves the EVM address by FORMAT (a 0x-40-hex value), preferring wallet-named keys then falling back to a top-level scan. A Solana address is never 0x-40-hex, so it cannot be picked by mistake, and the resolution does not depend on the exact JSON key.
