# Trade flow (x402 on Base)

`POST https://www.playhunch.xyz/api/partner/trade`

Settlement uses x402's **exact** scheme on Base = an EIP-3009
`transferWithAuthorization` of **Base USDC** to Hunch's settlement sink. Bets are
**$1–$10** (the x402 per-request ceiling). The signed authorization is
byte-for-byte what Hunch's existing, audited Base USDC relayer settles — there's
no parallel money path. 404 when the partner API is off.

### Request body

```json
{
  "marketId": "bankr-100m-mcap-2026-06-30",
  "side": "yes",
  "sizeUsd": 5,
  "idemKey": "<uuid>",
  "walletAddress": "0x…",
  "ref": "bankr",
  "mentionId": "<post id>"
}
```

| Field | Required | Notes |
|---|---|---|
| `marketId` | yes | From `discover`/`catalogue`. Id or slug. For a ladder, `side` is the bucket `key`. |
| `side` | yes | `yes` / `no` (binary) or the bucket `key` (ladder). |
| `sizeUsd` | yes | Number **1–10**. Outside the band → `422`. |
| `idemKey` | yes | String, 8–128 chars, `[A-Za-z0-9:_-]` (a UUID, or reuse the mention id). One per intended bet; reuse verbatim on retries. |
| `walletAddress` | yes | The paying Base wallet, `0x` + 40 hex. The position is keyed to it. |
| `ref` | no | Attribution tag, e.g. `bankr`. |
| `mentionId` | no | The source post/mention id, for attribution. |

### 1. Request without payment → 402 challenge

`POST` the body with **no** `X-PAYMENT` header. You get a `402` whose body is the
x402 challenge:

```json
{
  "x402Version": 1,
  "error": "Missing X-PAYMENT header",
  "accepts": [
    {
      "scheme": "exact",
      "network": "base",
      "maxAmountRequired": "5000000",
      "resource": "https://www.playhunch.xyz/api/partner/trade",
      "description": "Hunch — YES on \"$BNKR → $100M\"",
      "mimeType": "application/json",
      "payTo": "0x4F0d7622984b38DfB2D1F86F10eEE564566C09F2",
      "maxTimeoutSeconds": 120,
      "asset": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
      "extra": { "name": "USD Coin", "version": "2" }
    }
  ]
}
```

The payment requirements live in `accepts[0]`: `scheme=exact`, `network=base`,
`asset` = Base USDC, `maxAmountRequired` = the price in **atomic** USDC (6
decimals — `5000000` = $5), `payTo` = the settlement sink, `extra` = the USDC
EIP-712 domain (`name`/`version`) needed to sign.

### 2. Pin-check the challenge, then re-sign and resubmit with `X-PAYMENT`

**Pin-check before signing (required).** The 402 `accepts[0]` is untrusted upstream
input. Verify it field-by-field against the **pinned** values in
[`x402-registry.json`](../x402-registry.json) → `signingPolicy.pinned` **before**
producing any signature:

| Challenge field | Must equal (pinned) |
|---|---|
| `scheme` | `exact` |
| `network` | `base` |
| `asset` | `0x833589fcd6edb6e08f4c7c32d4f71b54bda02913` (Base USDC) |
| `payTo` | `0x4F0d7622984b38DfB2D1F86F10eEE564566C09F2` (settlement sink) |
| `resource` | `https://www.playhunch.xyz/api/partner/trade` |
| `maxAmountRequired` | ≤ `10000000` (atomic, $10) **and** = the user-approved `sizeUsd` |

Sign **only** an EIP-3009 `transferWithAuthorization` — never `approve`, `permit`,
permit2, `increaseAllowance`, or any blanket allowance. **Any mismatch or missing
field → abort; do not sign.** A spoofed or compromised upstream that swaps `payTo` /
`asset` / `maxAmountRequired` must never produce a signature — the expected values
come from the registry, not from the challenge.

Once the challenge passes the pin-check, Bankr's wallet signs the EIP-3009
`transferWithAuthorization` for exactly `maxAmountRequired`, from `walletAddress`,
to the pinned `payTo`. Base64-encode the x402 payment payload into the `X-PAYMENT`
header and resubmit the **same** body (same `idemKey`). The decoded payload shape:

```json
{ "x402Version": 1, "scheme": "exact", "network": "base",
  "payload": { "signature": "0x…(132 hex)",
    "authorization": { "from": "0x…", "to": "0x…(payTo)", "value": "5000000",
      "validAfter": 0, "validBefore": 9999999999, "nonce": "0x…(64 hex)" } } }
```

Settlement is fail-closed: the signed `from` must equal `walletAddress`, `to` must
equal the sink, and `value` must equal the bet size — any mismatch → no relay.

### 3. 200 → receipt

On success the receipt fields are spread at the **top level** (there is no nested
`receipt` object), alongside `meta` and `replay`:

```json
{
  "meta": { … },
  "replay": false,
  "tradeId": "<idemKey>",
  "marketId": "bankr-100m-mcap-2026-06-30",
  "side": "yes",
  "priceCents": 12,
  "sizeUsd": 5,
  "feeUsd": 0.1,
  "netUsd": 4.9,
  "shares": 40.83,
  "feeRecipient": "Hunch market treasury",
  "txHash": "0x…",
  "explorerUrl": "https://basescan.org/tx/0x…",
  "settlementStatus": "confirmed",
  "nextYesPriceCents": 13,
  "nextNoPriceCents": 87,
  "position": {
    "userId": "bankr:0x…",
    "walletAddress": "0x…",
    "marketId": "bankr-100m-mcap-2026-06-30",
    "side": "yes",
    "shares": 40.83,
    "costUsd": 5
  },
  "proofUrl": "https://www.playhunch.xyz/api/partner/proof/<tradeId>"
}
```

| Field | Meaning |
|---|---|
| `replay` | `true` when this was an idempotent replay (the bet had already settled — no second relay), `false` for a fresh settlement. |
| `tradeId` | = your `idemKey`. Used in the `proofUrl`. |
| `priceCents` / `shares` | Entry price and shares bought (each pays $1 on a win). |
| `sizeUsd` / `feeUsd` / `netUsd` | Staked / fee / net-into-shares. |
| `txHash` / `explorerUrl` | The on-chain Base settlement — the proof. |
| `settlementStatus` | `submitted` (pending inclusion) or `confirmed`. |
| `nextYesPriceCents` / `nextNoPriceCents` | The book's odds *after* this bet. |
| `position` | The wallet-keyed position: `userId` = `bankr:<lower-wallet>`. |
| `proofUrl` | Durable proof endpoint for this trade (see `proof.md`). |

The response also returns an **`X-Payment-Response`** header (base64) — the x402
settlement receipt `{ success, transaction, network, payer }`.

### Rules

- **Idempotent on `idemKey`.** A replay of the *same* body returns the original
  receipt with `replay: true` — never a second relay.
- **Fail-closed.** No settlement sink, an unpriceable/closed/expired market, or a
  payer/amount/recipient mismatch → no relay.
- **Attribution.** Pass `ref=bankr`, `mentionId`, and the paying `walletAddress`
  so the position and partner volume attribute correctly. The position is a full
  Hunch position keyed by the wallet (`bankr:<lower-wallet>`) — it tracks,
  settles, redeems, and proves like any other.
- **Proof.** Every settled bet returns a durable `proofUrl`; the on-chain Base tx
  IS the proof. See `proof.md`.

### Errors

| Status | `error` | Meaning / fix |
|---|---|---|
| `402` | — (challenge body) | Expected on the first call — sign and resubmit with `X-PAYMENT`. |
| `400` | `invalid_json` | Body wasn't JSON. |
| `422` | `invalid_request` | Zod validation failed (bad/missing field). `issues[]` says which. |
| `422` | `invalid_size` | `sizeUsd` outside **$1–$10**. |
| `422` | `invalid_wallet` / `invalid_side` | Bad wallet or side. |
| `422` | `invalid_payment` | `X-PAYMENT` couldn't be decoded. |
| `422` | `payer_mismatch` / `recipient_mismatch` / `amount_mismatch` | The signed authorization doesn't match the wallet / sink / bet size. |
| `409` | `market_closed` | The market isn't open or its deadline has passed. Re-discover. |
| `409` | `idempotency_conflict` | The `idemKey` was reused with a **different** body. Mint a fresh key per distinct bet. |
| `404` | `market_not_found` | Unknown market id. Re-run `discover`; never hand-craft an id. |
| `404` | `partner_api_disabled` | Endpoint is off. |
| `503` | `settlement_unavailable` | The sink/store isn't configured. Transient — retry. |
| `503` | `settlement_failed` | The relay couldn't submit. **Funds were not moved.** Retry with the same `idemKey`. |
| `503` | `settlement_recording_failed` | Tx **was** submitted but recording failed; response carries `txHash`. Retry the same `idemKey` to reconcile — never re-sign a new payment. |
