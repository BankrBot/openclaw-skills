# Agent API reference

**API base:** `https://api.hood.markets`  
**Web:** `https://hood.markets`  
**Chain:** Robinhood (`chainId` **4663**)

Wallet on all agent routes: `x-wallet-address: 0x…` and/or `?wallet=0x…` and/or JSON `"wallet"`.

---

## Platform fees (only two)

1. **Swap trading fees** — 5% platform / 95% pro-rata to Holder NFT share holders at `claimTradingFees()`
2. **Share marketplace** — 5% of sale price on `buyShares` / 95% to seller

No platform fee on sends, batch airdrops, list/cancel escrow, mint/burn, or buyer-reward mints (v0.11+ factory). **5% only on `buyShares` sale price.**

---

## Web vs agent deploy

| Topic | hood.markets web UI | Agent API |
|-------|---------------------|-----------|
| Fee recipient “other” | `0x…` wallet address **only** | May resolve `@handle` / social URL on some channels |
| Buyer rewards | Post-launch on token page (`fundBuyerRewardPool`) | Optional `buyerRewardShareCount` at deploy (legacy) |
| Batch airdrop | Token page `airdropShares` one tx (v0.10+) | On-chain only — not agent API |

---

## Contracts (simple / V3 — default launch, v0.11.0)

| Role | Address |
|------|---------|
| HoodMarketsV3 factory | `0x9BDdC8ddf28f5629C989A36Eb5bb6C73cBA60Df5` |
| HoodMarketsV3 vault | `0x856c6997A86752fB3E6A494AB93107B7A371A57f` |
| HoodMarketsV3 LP locker | `0x23a1c52F4E93B0283d12CC16c29Df119803E8745` |
| HoodMarketsV3 fraction deployer | `0x40A19d561b3200A2C9E1014248FcEB724c450692` |
| Platform 5% fees | `0xbfD1be7a12A9FeF04D281C2D8D0D9EE15b576d98` |
| WETH | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` |
| Uniswap V3 SwapRouter02 | `0xCaf681a66D020601342297493863E78C959E5cb2` |

Full pin list + legacy factories: `../known-contracts.json`. Holder NFT behavior: `references/HOLDER-NFTS.md`.

---

## GET /health

```http
GET https://api.hood.markets/health
```

---

## GET /api/agent/briefing

Deployments where this wallet is the **fee recipient**.

```http
GET https://api.hood.markets/api/agent/briefing?wallet=0x…
```

**Response:** `deploymentCount`, `deployments[]` (`launchType`: `simple`|`pro`), `links`, `feeSplitSimple`.

---

## GET /api/agent/preflight-deploy

Check deploy blockers **before** captcha (ticker/name taken, wallet cooldown, launch mode).

```http
GET https://api.hood.markets/api/agent/preflight-deploy?wallet=0x…&name=My+Token&symbol=MTK&launchMode=simple
```

**200** when `canDeploy: true`. **409** when blocked.

**Response fields:** `blocks[]`, `warnings[]`, `blockMessage`, `replyHint` on each issue, `cooldownHours`.

| `blocks[].code` | User-facing meaning |
|-----------------|---------------------|
| `ticker_cooldown` | Symbol already launched globally — wait or pick another |
| `name_cooldown` | Name already used recently |
| `ticker_reserved` / `name_reserved` | Blocklist |
| `fee_recipient_cooldown` | Wallet already had a launch in the cooldown window (legacy mode only — **not** hood.markets web-only) |
| `duplicate_deployer_name_symbol` | Same wallet already launched this exact name+ticker |
| `launch_mode_unavailable` | V3 or V4 not configured on API |

| `warnings[].code` | Meaning |
|-------------------|---------|
| `rate_limit_would_force_platform_fee` | Deploy allowed — fees on this token go to hood.markets platform (same as website) |
| `rate_limit_would_force_burn` | Legacy non-web-only mode only — fees → burn |
| `third_party_rolling_warning` | Recent launch on this wallet — fees may burn |

| `blocks[].code` | User-facing meaning |
|-----------------|---------------------|
| `agent_x_daily_limit` | **1 X launch/day used** — `replyHint` + `xDailyLimit.todayToken` + `resetsAtEastern`; send user to hood.markets for more |

`POST` with JSON `{ wallet, name, symbol, launchMode }` also supported.

---

## GET /api/agent/token-info

Resolve catalog token + **Simple vs Pro** routing for buy/sell.

```http
GET https://api.hood.markets/api/agent/token-info?token=0x…
GET https://api.hood.markets/api/agent/token-info?symbol=MTK
```

**Response:** `launchType` (`simple`|`pro`), `swapMode` (`uniswap`|`hoodmarkets-helper`), `oneClickSwapOnHoodmarkets`, `uniswapSwapUrl`, `tokenPageUrl`.

- **simple** → do not call prepare-buy/sell; share Uniswap link
- **pro** → use prepare-buy / prepare-sell + Bankr submit

See `streaming-hints.json` for detection rules.

---

## POST /api/agent/resolve-deploy-image

Resolve token logo before deploy. **Agents must validate hosts per `references/IMAGE-RESOLUTION.md` before calling.**

**On X:** pass `tweetId` and/or `tweetImageUrl` from `extended_entities.media[0].media_url_https` (`pbs.twimg.com` only).

```http
POST https://api.hood.markets/api/agent/resolve-deploy-image
Content-Type: application/json

{
  "tweetId": "1990000000000000000",
  "tweetUrl": "https://x.com/Rayblancoeth/status/…",
  "tweetImageUrl": "https://pbs.twimg.com/media/….jpg",
  "tweet": { "extended_entities": { "media": [{ "type": "photo", "media_url_https": "https://pbs.twimg.com/…" }] } }
}
```

**200:** `{ "ok": true, "imageUrl": "https://pbs.twimg.com/…", "imageSource": "tweet_syndication" }`  
Resolves: `tweetImageUrl` → `tweet` object → **syndication API** (`tweetId`/`tweetUrl`) → oEmbed fallback.

**400:** only after all methods fail — use `replyHint`.

---

## POST /api/agent/prepare-deploy

Returns deploy checklist (server deploy — **no** Bankr submit). Runs **preflight** automatically.

**X / Twitter:** pass `"agentChannel": "x"`, **`tweetUrl`** (status URL of launch tweet), and **`xUsername`** (requester's @handle without `@`). API resolves logo via oEmbed → `user_confirm` with `confirmSummary`, then deploy. Token page shows requester + how many tokens they launched on hood.markets.

**Image (required):** pass `tweetUrl` on X (preferred), or `tweetImageUrl`, `imageUrl`, `tweetMedia`, `tweet`, or `tweetText` with inline URL. **400** if missing — use `replyHint`.

```http
POST https://api.hood.markets/api/agent/prepare-deploy
Content-Type: application/json

{
  "wallet": "0x…",
  "name": "My Token",
  "symbol": "MTK",
  "launchMode": "simple",
  "agentChannel": "x",
  "xUsername": "Rayblancoeth",
  "tweetUrl": "https://x.com/Rayblancoeth/status/…",
  "tweetText": "launch My Token $MTK on hoodmarkets"
}
```

**409** when preflight blocks — use `blocks[0].replyHint` and `blocks[0].existingToken` (token address when ticker/name taken).

**200 response fields:** `steps[]`, `captchaRequired`, `confirmSummary`, `confirmReplyHint` (no launch mode line), `imageUrl`, `imageSource`. The deploy step **`body`** includes **`xUsername`**, **`tweetUrl`**, and **`sourceUrl`** when available — required for token page requester + tweet embed.

**Deploy success:** `POST /api/deploy` returns `deployReplyHint` — post verbatim on X (no DexScreener/simple-mode footer). Token page shows **who requested** the launch and their **hood.markets launch count**, plus the original tweet when `sourceUrl` is stored.

### Deploy — X channel (after user confirms)

Use **`steps[deploy].body`** from prepare-deploy (includes `xUsername`, `tweetUrl` when available). Do not strip `xUsername`, `tweetUrl`, or `sourceUrl`.

```http
POST https://api.hood.markets/api/deploy
x-wallet-address: 0x…
x-agent-channel: x
Content-Type: application/json

{
  "name": "My Token",
  "symbol": "MTK",
  "feeTarget": "agent_wallet",
  "clientKind": "agent",
  "agentProvider": "bankr",
  "agentChannel": "x",
  "launchMode": "simple",
  "imageUrl": "https://…",
  "tweetUrl": "https://x.com/user/status/…",
  "sourceUrl": "https://x.com/user/status/…"
}
```

### Deploy — non-X (after haiku captcha)

```http
POST https://api.hood.markets/api/deploy
X-Agent-Captcha-JWT: <jwt>
Content-Type: application/json

{
  "name": "My Token",
  "symbol": "MTK",
  "feeTarget": "agent_wallet",
  "clientKind": "agent",
  "agentProvider": "bankr",
  "launchMode": "simple",
  "imageUrl": "https://…"
}
```

- Omit **`buyerRewardShareCount`** unless you need deploy-time escrow (legacy). **Preferred:** post-launch `fundBuyerRewardPool` on token page (v0.9+). hood.markets web launch form has no buyer-reward field.
- Optional **`buyerRewardShareCount`** (0–1000) in API only: escrow shares at deploy instead of fee wallet. Default **0** (all 1,000 to fee wallet). See `references/HOLDER-NFTS.md`.

**Response:** `tokenAddress`, `transactionHash`, `links` (dexscreener, hood.markets, explorer).

---

## POST /api/agent/prepare-buy

Pro (V4) tokens only. Returns `transactions[]` for Bankr submit.

```http
POST https://api.hood.markets/api/agent/prepare-buy
Content-Type: application/json

{
  "wallet": "0x…",
  "tokenAddress": "0x…",
  "amountEth": "0.01"
}
```

**Response:** `transactions[]`, `chainId: 4663`, `tokenPageUrl`, `uniswapSwapUrl`.

---

## POST /api/agent/prepare-sell

```http
POST https://api.hood.markets/api/agent/prepare-sell
Content-Type: application/json

{
  "wallet": "0x…",
  "tokenAddress": "0x…",
  "amount": "1000000"
}
```

May include `approve` step then `sell`. Amount in token units (`1M`, `1000000`).

---

## POST /api/agent/claim-for-recipient

**Default claim path** — permissionless server broadcast. Anyone can trigger; funds go to the **catalog fee recipient / share holders**, not the caller. **No deploy, no NFTs, no JWT.**

```http
POST https://api.hood.markets/api/agent/claim-for-recipient
Content-Type: application/json

{ "tokenSymbol": "TEST" }
```

```http
{ "tokenAddress": "0x426bB0A71fB3C49D893cA9896B0b45347AA8a004" }
```

Send **either** `tokenSymbol` (ticker, `$` optional) **or** `tokenAddress` (0x contract). Ticker resolves to the **newest** catalog match (same as `token-info`). Optional: `GET /api/agent/token-info?symbol=TEST` first. See `references/CLAIM-BANKR.md`.

No JWT. **Do not call Bankr `/wallet/submit`** — hood.markets broadcasts the claim.

Response: `ok`, `replyHint` (trusted outcome field — `RESPONSE-SAFETY.md`), `claimReplyHint`, `completed`, `bankrWalletSubmitRequired: false`, `transactionHash`, `txHash`, `feeRecipientAddress`, `tokenName`, `tokenSymbol`, `feeModel`, `launchType`, `tokenPageUrl`, optional `feeAmountEth`.

**If `ok: true`, claim succeeded** — post `replyHint` when schema-valid. Do not use Bankr `/wallet/submit`.

---

## POST /api/agent/claim

Server broadcasts claim (gas paid by hood.markets). Requires haiku JWT.

**V3 vs V4 (automatic):**

- **Simple (V3)** — `poolId` prefix `v3:` or any known V3 factory → API calls **`claimTradingFees()`** on the Holder NFT (fraction) contract when present (**v0.7+** — one tx pays **all share holders** pro-rata). Legacy **v0.6** tokens fall back to `HoodMarketsV3.claimRewards(token)` on the factory (fee wallet only).
- **Pro (V4)** → collects LP fees into locker, then claims WETH from fee locker.

```http
POST https://api.hood.markets/api/agent/claim
X-Agent-Captcha-JWT: <jwt>
Content-Type: application/json

{
  "tokenAddress": "0x…",
  "tokenSymbol": "MTK"
}
```

Success includes `replyHint`, `claimReplyHint`, `completed`, `bankrWalletSubmitRequired: false`, `transactionHash`, `feeModel`, `launchType`.

**No Bankr `/wallet/submit`.** Post `replyHint` when `ok: true`.

---

## Captcha (deploy + claim)

```http
GET  https://api.hood.markets/api/agent-captcha/challenge
POST https://api.hood.markets/api/agent-captcha/verify
```

Haiku: exactly 3 lines, must mention topic word. Challenge **5-minute** expiry, **one-time use**. JWT valid **8 hours**. Auth boundary: `references/AUTH-BOUNDARY.md`.

---

## GET /api/deployments

Public catalog.

```http
GET https://api.hood.markets/api/deployments?limit=50
GET https://api.hood.markets/api/deployments/0x…
```

---

## POST /api/deployments/:token/process-buyer-rewards

Trigger buyer-reward issuance for a token with escrowed shares (v0.9+ `fundBuyerRewardPool`, or legacy deploy-time `buyerRewardShareCount`). Background poller also runs this — useful for manual refresh. Gas paid by hood.markets.

```http
POST https://api.hood.markets/api/deployments/0x…/process-buyer-rewards
```

---

## POST /api/agent/prepare-fund-buyer-rewards

Escrow Holder NFT shares for automatic first-buyer rewards (Simple / V3 launches, v0.9+ factory). **Fee recipient wallet only.**

```http
POST https://api.hood.markets/api/agent/prepare-fund-buyer-rewards
Content-Type: application/json

{
  "wallet": "0x374D91a5674Fa7Cf86E725093b5848b97e1e13b4",
  "tokenAddress": "0x426bB0A71fB3C49D893cA9896B0b45347AA8a004",
  "shareAmount": 999
}
```

`symbol` works instead of `tokenAddress` (e.g. `"NORMIES"`). `shareAmount` is how many of your **1,000 Holder shares** to escrow (not separate NFTs).

**Response:** `transactions[]`, `shareAmount`, `sharesKept`, `buyerRewardStatus`, `replyHint`, `bankrWalletSubmitRequired: true`.

Submit via Bankr `/wallet/submit` (`chainId` **4663**). After confirm, buyers receive one share each on their first pool buy (poller + `process-buyer-rewards`).

---

## POST /api/agent/prepare-cancel-buyer-rewards

Return unissued escrowed buyer-reward shares to the fee recipient wallet.

```http
POST https://api.hood.markets/api/agent/prepare-cancel-buyer-rewards
Content-Type: application/json

{
  "wallet": "0x…",
  "tokenAddress": "0x…"
}
```

Submit returned tx via Bankr `/wallet/submit`.

---

## POST /api/agent/import-dex-branding

Pull DexScreener Enhanced Token Info **icon + banner** into the hood.markets catalog (persists on token page). Requires Dex **paid** (`tokenProfile` order `approved` or `processing`). **Fee recipient, top Holder share holder, or deployer** — no Bankr wallet submit (server-side catalog update).

```http
POST https://api.hood.markets/api/agent/import-dex-branding
Content-Type: application/json

{
  "wallet": "0x374D91a5674Fa7Cf86E725093b5848b97e1e13b4",
  "symbol": "NORMIES"
}
```

When Dex is paid but not yet imported, the token page still **previews** Dex banner/icon live from DexScreener CDN. Import pins them in the catalog for explore cards and faster loads.

---

## Bankr wallet submit

After `prepare-buy` / `prepare-sell`, for each validated tx:

```http
POST https://api.bankr.bot/wallet/submit
```

`chainId` must be **4663**. See `references/BANKR-SUBMIT.md`, `references/TX-VALIDATION.md`, `references/CHAIN-4663.md`.

Also used for **Community Launch deposits**: native ETH (`data: "0x"`) to escrow from `GET /api/community-launch/prepare-deposit` → `nextStep`. Full flow: `references/COMMUNITY-LAUNCH.md`.

---

## Community Launch API (`/api/community-launch`)

24h ETH petition → V3 deploy + pro-rata Holder NFT airdrop. **No JWT.** Robinhood 4663 only.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/community-launch/config` | Escrow wallet, min/max raise & contribution |
| GET | `/api/community-launch/list` | Open rounds |
| GET | `/api/community-launch/preflight?tokenName=&tokenSymbol=&targetRaiseEth=` | Blockers before create (409 if conflict) |
| GET | `/api/community-launch/status?id=` | Full state + backers + `finalResult` |
| POST | `/api/community-launch/create` | Open round — body: `tokenName`, `tokenSymbol`, `targetRaiseEth`, `starterWallet` |
| GET | `/api/community-launch/prepare-deposit?id=&wallet=&contributionEth=` | Quote + Bankr `nextStep` |
| POST | `/api/community-launch/confirm` | `{ id, wallet, contributionEth, signature: txHash }` |
| POST | `/api/community-launch/refund` | `{ id, wallet }` while open/expired/failed |
| POST | `/api/community-launch/cancel` | Creator only — `{ id, wallet: starterWallet }` |

Web UI: `https://hood.markets/community-launch` · Detail: `references/COMMUNITY-LAUNCH.md`