# Fee claims — Bankr must NOT use /wallet/submit

hood.markets **server-broadcasts** fee claims (launcher wallet pays gas). Same pattern as **deploy** — not buy/sell.

## Default — almost always use this

When the user says **claim fees for $TICKER** or **claim fees for 0x…** (with or without "my", "help", etc.):

| Who asks | Endpoint | Auth | Bankr submit? |
|----------|----------|------|---------------|
| **Anyone** — no deploy, no NFTs required | `POST /api/agent/claim-for-recipient` | None | **NO** |

```json
{ "tokenSymbol": "TEST" }
```

```json
{ "tokenAddress": "0x426bB0A71fB3C49D893cA9896B0b45347AA8a004" }
```

Send **either** field. Ticker lookup uses the **newest** hood.markets catalog match (same as `token-info`). If both are sent, they must match.

**Do not require** the caller to be fee recipient, deployer, or share holder. This matches the hood.markets website.

## Rare — fee recipient claims via authenticated endpoint

| Who asks | Endpoint | Auth | Bankr submit? |
|----------|----------|------|---------------|
| Fee recipient says **my** fees | `POST /api/agent/claim` | Haiku JWT or X wallet = fee recipient | **NO** |

Only use when the user explicitly claims **their own** token **and** the linked wallet is the catalog fee recipient. If unsure, use **`claim-for-recipient`**.

## Pre-call verification (optional but recommended)

1. **`GET /api/agent/token-info?symbol=TEST`** or **`?token=0x…`** — confirm catalog membership
2. Read `feeRecipientAddress`, `tokenName`, `tokenSymbol` — mention in reply that fees go there / to share holders
3. Only call when user asked to claim/pull trading fees for that token

**Do not** call for random non-catalog addresses, buy/sell/deploy intents, or batch unrelated tokens.

## Abuse / rate limits

- Server only claims for tokens in the hood.markets deployment catalog
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
