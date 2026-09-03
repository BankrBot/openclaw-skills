# Fee claims — Bankr must NOT use /wallet/submit

hood.markets **server-broadcasts** fee claims (launcher wallet pays gas). Same pattern as **deploy** — not buy/sell.

## Endpoints

| Who asks | Endpoint | Auth | Bankr submit? |
|----------|----------|------|---------------|
| Anyone helping (e.g. claim for EA's token) | `POST /api/agent/claim-for-recipient` | None | **NO** |
| Fee recipient claiming own token | `POST /api/agent/claim` | Haiku JWT or X wallet | **NO** |

## Pre-call verification (claim-for-recipient)

This endpoint is **permissionless** — any caller can trigger an on-chain claim. Funds go to the **catalog fee recipient**, not the caller. Before calling:

1. **`GET /api/agent/token-info?token=0x…`** — confirm token exists in hood.markets catalog
2. Read `feeRecipientAddress`, `tokenName`, `tokenSymbol`, `launchType` — confirm they match user intent
3. Explain to user: fees will be sent to **catalog fee recipient** (show address), not the caller's wallet
4. Only call when user asked to claim/pull trading fees for that token

**Do not** call for random addresses, non-catalog tokens, or when user intent is buy/sell/deploy.

## Abuse / rate limits

- Server only claims for tokens in the hood.markets deployment catalog (`tokenAddress` must match a known launch)
- On-chain claim is **idempotent** when no fees accrued (API returns 400 with friendly error)
- Infrastructure may apply IP/request rate limits — if **429**, wait and retry once; do not spam
- Agents must not batch-claim unrelated tokens without per-token user intent

Auth-boundary for deploy/claim JWT and X confirm: `references/AUTH-BOUNDARY.md`.

## Success detection (CRITICAL)

When the API returns HTTP 200 and **`ok: true`**:

1. The claim **already succeeded** on Robinhood Chain
2. Post **`replyHint`** when it passes `RESPONSE-SAFETY.md` schema/URL rules (same as `claimReplyHint`)
3. `completed: true`, `bankrWalletSubmitRequired: false`
4. **Never** reply "I didn't submit a transaction" or "I wasn't able to complete"
5. **Never** call `POST https://api.bankr.bot/wallet/submit` for claims

## Example success response

```json
{
  "ok": true,
  "completed": true,
  "bankrWalletSubmitRequired": false,
  "transactionSubmitted": true,
  "replyHint": "Claim successful — Hoodrich ($HR) trading fees sent to fee wallet 0xDbe9…87a4. WETH should show up in that wallet shortly.",
  "transactionHash": "0x172c…",
  "feeRecipientAddress": "0xDbe9C973117C0A3a3886fD1eF92EEA33949C87a4",
  "tokenName": "Hoodrich",
  "tokenSymbol": "HR"
}
```

**Your tweet reply = `replyHint` when schema-valid.** Tx link optional.

## On-chain routing

- **V3 v0.7+:** `claimTradingFees()` on Holder NFT — **pro-rata to all share holders**
- **V3 v0.6 legacy:** `HoodMarketsV3.claimRewards(token)` — fee wallet only
- **Pro V4:** LP locker collect → fee locker claim

Funds always go to catalog fee recipients / share holders per on-chain rules — not the caller.

## Failure

HTTP 4xx or `ok: false` → use `error` field. Do not claim success.
