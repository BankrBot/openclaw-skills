# Harness Management API Reference

Base URL: `https://tryharness.ai` — the ONLY host this skill talks to. Never send the management token or any request to another host.

Every request after pairing carries `Authorization: Bearer <management token>`. The token is management-scoped: Harness enforces server-side that it can never approve proposals, enable YOLO, change caps or side-effect classes, or directly move funds. It is still a secret: approved secret store only, never displayed, logged, or embedded in summaries, artifacts, or payloads. It rotates on re-pair and dies on revocation.

## Pair

```
POST /api/external-agent/owner/pair
{
  "pairingCode": "<code from the Harness app>",
  "address": "<this wallet's EVM address>",
  "chain": "evm",
  "signature": "<signature of the exact harness-pair v2 message below>",
  "replaceExisting": false
}
```

The signed message is domain-separated — exactly these six lines, with YOUR address lowercased:

```
harness-pair v2
domain: tryharness.ai
purpose: bankr-owner-pairing
chain: evm
address: <this wallet's EVM address, lowercase>
code: <the pairing code>
```

The code is the nonce (single-use, expires in 15 minutes, burned server-side on redemption); the domain, purpose, chain, and address lines prevent replay in any other context. EVM only for now; sign with `personal_sign` (your own `POST /wallet/sign`). Response `200`:

```json
{
  "managementToken": "<hmt_ bearer token, shown exactly once — straight into the secret store>",
  "provisionedWallet": { "evmAddress": "0x…", "solAddress": "…" },
  "pairedAddress": "0x…",
  "nextStep": "<the starter funding recipe to OFFER the user: ~$5 USDC + ~$1 ETH on Base to the provisioned address, then AI credits — never transferred without their confirmation>"
}
```

`provisionedWallet` can be `null` if the Harness wallet is not provisioned yet; re-read the summary later. `replaceExisting: true` is required when this wallet or the Harness account is already paired; it revokes the prior pairing (wherever it lives). Ask the user to confirm before sending it. Redeeming burns the code whether or not pairing succeeds; on failure ask the user for a fresh code.

## Summary

```
GET /api/external-agent/owner/summary
```

Returns `pairedAddress`, `provisionedWallet` (addresses and status), `portfolio` (the wallet's live portfolio, or `null` when unreadable), `sessions` (a count per status), and `withdrawalRequests` (the last 10 with status, provider reference, and failure reason).

## Fund (no Harness endpoint)

Deposits are plain onchain transfers from the user's own wallet to the provisioned wallet address from the summary. Nothing to call on Harness; the balance appears in the next summary read.

## Withdrawals

```
POST /api/external-agent/owner/withdrawals
{
  "tokenAddress": "0x…",        // ERC20 contract; any value with isNativeToken true
  "isNativeToken": false,
  "chain": "base",              // base (default) | mainnet | polygon | arbitrum | unichain | worldchain | bnb | robinhood
  "amount": "25",               // human-readable decimal string
  "assetLabel": "USDC",         // optional, for display
  "note": "<optional>"
}

GET  /api/external-agent/owner/withdrawals
```

The fields mirror Bankr's own `POST /wallet/transfer` body, so use the token contract address, not a symbol. Confirm with the user before POSTing — show the token contract (or native flag), chain, amount, and that the destination is this paired wallet. POST responds `{ "requestId": "…", "status": "pending_approval" }`. The destination is always the paired owner wallet; it cannot be set per-request. The user approves inside authenticated Harness, always, including during YOLO; on approval Harness executes the transfer and records the `txHash` as `providerRef`. Statuses you will see when polling: `pending_approval`, `completed`, `rejected`, `failed` (with `failureReason`), `submission_unknown` (the transfer's outcome is ambiguous; do NOT create another request for the same funds until the user has verified balances and transaction status in Harness — a repeat could double-move).

## Sessions

```
GET  /api/external-agent/owner/sessions
POST /api/external-agent/owner/sessions/{sessionId}/control   { "action": "pause" | "cancel" }
```

The list returns `sessionId`, `status`, `objective`, and timestamps for the latest 25 sessions. Pause and cancel only. Approvals, YOLO, and limit changes are not available on this surface by design.

## Credits (x402)

```
GET  /api/external-agent/owner/credits
POST /api/external-agent/owner/credits    { "packId": "pack_10" }
POST /api/external-agent/owner/credits    { "quoteToken": "…", "txHash": "0x…" }
```

GET returns `creditBalanceUsd`, the available `packs` (`pack_10`, `pack_20`, `pack_50`, `pack_100`), and `tokenRail: "available" | "unavailable"` (when unavailable, fiat inside Harness still works).

POST with `packId` responds **402 Payment Required**:

```json
{
  "x402Version": 1,
  "accepts": [{
    "scheme": "direct-transfer",
    "network": "base",
    "asset": "<$HARNESS contract address>",
    "amountToken": 1234.5,
    "payTo": "<treasury address>",
    "expiresAtMs": 1234567890
  }],
  "quote": { "creditUsd": 10, "tokenCharge": 1234.5, "…": "…" },
  "quoteToken": "<signed quote, pass back at settlement>"
}
```

Before paying, verify the terms against the pins: `asset` must be the $HARNESS contract `0xD3E592E728AE3461BD97c7A6B359E1043dd83bA3`, `network` must be `base`, `scheme` must be `direct-transfer`, `amountToken` must equal `quote.tokenCharge`, and `quote.creditUsd` must equal the chosen pack (packs top out at $100). On any mismatch: do not pay, tell the user, stop. `payTo` is trusted only from this authenticated 402 response; show it to the user in the payment preview with the amount and expiry, and get their go-ahead.

Then pay exactly `amountToken` $HARNESS to `payTo` on Base from this wallet, and POST `{ quoteToken, txHash }`. The response is `{ "ok": true, "status": "settled" | "review", "creditedUsd": … }`; `review` still granted the credits. Settlement is idempotent on the tx hash, so retries are safe. Quotes expire in minutes; if one expires before payment, request a fresh quote instead of paying it.

## Artifacts

```
GET /api/external-agent/owner/sessions/{sessionId}/artifacts
```

Metadata for what the Harness collaboration produced: `name`, `remotePath`, `kind`, `mimeType`, `auditRelevant`, `createdAt`.

## Revoke the trading wallet (emergency)

```
POST /api/external-agent/owner/wallet/revoke   { "confirm": true }
```

Requires explicit user agreement first; without `confirm: true` it refuses. Response: `{ "ok": true, "cancelledSessions": n, "remoteKeyRevoked": true|false }`. Cancels all live sessions, ends YOLO leases, revokes the wallet key. Funds stay in the wallet untouched. This is one-way from this surface: re-enabling happens only inside the Harness app (a new delegation mints a fresh key for the same wallet). `409` means there is no active provisioned wallet.

## Errors

- `401`: token missing, revoked, or replaced. Offer to re-pair.
- `409` on pairing: wallet or account already paired; needs `replaceExisting: true` after user confirmation.
- `409` on control: the session is in a state that does not allow that action.
