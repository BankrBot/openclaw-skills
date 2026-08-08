---
name: hoodmarkets
description: Launch, buy, sell, and claim fees for hood.markets tokens on Robinhood Chain (4663) via api.hood.markets. Use for hoodmarkets, hood.markets, $hood, launch token, deploy token, buy token, sell token, claim fees, Bankr Robinhood. NEVER use hood.markets for API POST — use api.hood.markets.
tags: [hoodmarkets, hood, bankr, robinhood, defi, token-launcher, uniswap]
version: 18
---

# hood.markets — Bankr agent skill

Launch and trade tokens on **[hood.markets](https://hood.markets)** (Robinhood Chain, chain ID **4663**). Bankr supports Robinhood — users can deploy, swap, and claim through `@bankrbot` when this skill is installed.

**Human / integrator docs:** [hood.markets/sdk.md](https://hood.markets/sdk.md) · [hood.markets/agent.md](https://hood.markets/agent.md) · [hood.markets/Dev](https://hood.markets/Dev)

## Platform fees (only two)

| Fee | Split |
|-----|--------|
| Swap trading fees | 5% platform / 95% pro-rata to Holder NFT share holders |
| Share marketplace sales | 5% of listed price / 95% to seller |

No fee on sends, airdrops, or other share moves (v0.11 factory `0x9BDd…0Df5`).

## CRITICAL — API host (read first)

| Role | URL |
|------|-----|
| **Agent API** | `https://api.hood.markets` |
| **Web UI** | `https://hood.markets` |

```
GET  https://api.hood.markets/health
GET  https://api.hood.markets/api/agent/briefing?wallet=0x…
GET  https://api.hood.markets/api/agent/preflight-deploy?wallet=0x…&name=…&symbol=…
GET  https://api.hood.markets/api/agent/token-info?token=0x…
POST https://api.hood.markets/api/agent/prepare-deploy
POST https://api.hood.markets/api/agent/resolve-deploy-image
POST https://api.hood.markets/api/agent/prepare-buy
POST https://api.hood.markets/api/agent/prepare-sell
POST https://api.hood.markets/api/deploy          (after haiku JWT)
POST https://api.hood.markets/api/agent/claim-for-recipient  (anyone — fees to catalog recipient)
POST https://api.hood.markets/api/agent/claim      (fee recipient wallet only)
```

**NEVER** call `https://hood.markets/api/...` for agent POST — the website is frontend-only.

See `references/API-HOST.md` before any HTTP call.

---

## Install

```text
install the hoodmarkets skill from https://github.com/BankrBot/skills/tree/main/hoodmarkets
```

---

## What users mean

| Term | Meaning |
|------|---------|
| **Launch / deploy** | Create a new token + liquidity pool on Robinhood |
| **Simple launch** | Uniswap V3 via HoodMarketsV3 factory `0x9BDd…0Df5` (v0.11.0) — DexScreener-friendly; **5%** platform / **95%** trading fees to Holder NFT holders pro-rata; **1,000-share** Holder NFT vault embedded |
| **Holder NFTs** | 1,000 shares. Platform fees **only**: (1) swap fees 5%/95% via locker + `claimTradingFees`, (2) share listings 5% of sale price. See `references/HOLDER-NFTS.md` |
| **Pro launch** | Uniswap V4 hooks — one-click buy/sell on hood.markets |
| **Buy / sell** | Swap ETH ↔ token on Uniswap (Simple/V3). Pro tokens use swap helper + Bankr submit. **No “fund LP” on hood.markets** — launch LP is locked |
| **Claim fees** | Pull swap trading fees — **95% pro-rata to all Holder NFT share holders** (launcher pays gas) |

---

## Mandatory routing

```
if message mentions hoodmarkets / hood.markets / launch token on robinhood /
   buy $TICKER / sell token / claim fees / deploy on hood:
  1. use_skill("hoodmarkets")
  2. Read references/API-HOST.md — use ONLY https://api.hood.markets
  3. **Chain:** abort if Bankr wallet does not support 4663 — references/CHAIN-4663.md (no fallback)
  4. Resolve linked wallet → x-wallet-address header
  5. **Deploy:** `preflight-deploy` first — **409 + `blocks[]` only** = do not deploy. **`warnings[]` with `canDeploy: true`** = warn, then deploy after user confirms yes
  6. Call references/AGENT-API.md endpoint BEFORE replying
  7. Replies: references/RESPONSE-SAFETY.md — trusted `*ReplyHint` fields with URL allowlist; format other fields locally
  8. Deploy (X): validate image per IMAGE-RESOLUTION.md → `resolve-deploy-image` → `prepare-deploy` → local preview → `confirmReplyHint` → deploy after yes. references/PROMPT-INJECTION.md
  9. Buy/sell: `token-info` → Simple: Uniswap link only. Pro: prepare-buy|prepare-sell → TX-VALIDATION.md → user preview → Bankr /wallet/submit chain 4663
  10. Claim **own** fees: haiku JWT or X wallet → POST /api/agent/claim (references/AUTH-BOUNDARY.md)
  11. Claim **for someone else**: token-info verify first → POST /api/agent/claim-for-recipient — references/CLAIM-BANKR.md
  12. **Claim success:** `ok: true` → post `replyHint` if schema-valid. **Never** `/wallet/submit`. **Never** say "I didn't submit a transaction"
  13. **Holder NFTs:** claim fees via API only — no airdrop/list/buyShares/rewards via agent — references/HOLDER-NFTS.md
```

**Tweet = DM** — same pipeline on `@bankrbot` intake.

---

## X — token logo (CRITICAL for @bankrbot)

Bankr receives the **full Tweet object** from X. The logo is in the media fields — extract it **before** calling the API.

### Step A — read media from Bankr's X payload (preferred)

| X API | Where the image lives |
|-------|----------------------|
| **v1.1** | `tweet.extended_entities.media[0].media_url_https` |
| **v2** | `includes.media[0].url` (request `expansions=attachments.media_keys&media.fields=url`) |
| **Syndication shape** | `tweet.photos[0].url` or `tweet.mediaDetails[0].media_url_https` |

Pass to the API as **`tweetImageUrl`** or the full **`tweet`** object.

### Step B — always pass tweet id / URL

Every launch tweet has an id. Pass **`tweetId`** (numeric string) or **`tweetUrl`**:

```json
{
  "wallet": "0x…",
  "name": "dontfukinbuy",
  "symbol": "TEST",
  "agentChannel": "x",
  "tweetId": "1990000000000000000",
  "tweetUrl": "https://x.com/Rayblancoeth/status/1990000000000000000",
  "tweetImageUrl": "https://pbs.twimg.com/media/….jpg",
  "tweet": { "extended_entities": { "media": [{ "type": "photo", "media_url_https": "https://pbs.twimg.com/…" }] } }
}
```

API resolves via **syndication** (`cdn.syndication.twimg.com`) when only `tweetId` / `tweetUrl` is passed — no Selenium needed.

### Step C — validate + call API before saying "no image"

1. Validate hosts per **`references/IMAGE-RESOLUTION.md`** — `pbs.twimg.com` / tweet syndication only; reject arbitrary URLs
2. `POST /api/agent/resolve-deploy-image` with fields above
3. If `ok: true` → use `imageUrl` in `prepare-deploy`
4. **Only** ask the user for a logo if API returns `imageRequired: true` **after** `tweetId` + `tweetImageUrl` / `tweet` were sent

**Never** tell the user "no attached image" without passing `tweetId` and `tweetImageUrl` (from `media_url_https`) to the API first.

---

## Agent API (reads)

Pass wallet via `?wallet=0x…` or header `x-wallet-address: 0x…`.

| User says | Call |
|-----------|------|
| my tokens / my launches / briefing | `GET https://api.hood.markets/api/agent/briefing?wallet=0x…` |
| launch / deploy token | `GET preflight-deploy` → if ok, `POST prepare-deploy` with `agentChannel: "x"` on X, else haiku flow |
| is $TICKER simple or pro / how to swap | `GET https://api.hood.markets/api/agent/token-info?symbol=TICKER` |
| buy TOKEN / buy 0x… with ETH | `token-info` → if Pro: `POST prepare-buy` |
| sell TOKEN / sell amount | `token-info` → if Pro: `POST prepare-sell` |
| list all tokens (public) | `GET https://api.hood.markets/api/deployments?limit=50` |
| token swap config | `GET https://api.hood.markets/api/tokens/0x…/swap-config` |

See **`references/AGENT-API.md`** for bodies and response fields.

---

## Deploy flow (server-side — no Bankr submit)

Deploy is **gasless for the user** — hood.markets launcher wallet pays gas + launch seed.

### X daily limit (1 launch / day on @bankrbot)

Each Bankr wallet gets **1 subsidized launch per Eastern calendar day** on X (`agentChannel: "x"`). A second attempt the same day returns **409** with:

- `replyHint` — short copy for the tweet reply (use as-is)
- `xDailyLimit.todayToken` — name, symbol, address, `tokenPageUrl` of today's launch
- `xDailyLimit.resetsAtEastern` — when the X limit resets (midnight Eastern)

**Do not retry deploy on X after 409.** Tell the user they already launched today, link `todayToken.tokenPageUrl`, and send them to **https://hood.markets** to launch more (sign in + wallet pays gas).

### On X / Twitter (`agentChannel: "x"`)

1. Pass **`tweetUrl`** (full status URL of the launch tweet) — API pulls the attached photo via oEmbed even when Bankr cannot see media in context.
2. Pass **`xUsername`** (the X @handle of the user who asked to launch — without `@`) so the token page shows who requested it and their launch count. If omitted, API infers from `tweetUrl`.
3. Optionally also pass `tweetImageUrl`, `tweet`, `tweetMedia`, or `imageUrl` if available in Bankr's payload.
4. Call `POST /api/agent/prepare-deploy` with `agentChannel: "x"`, wallet, name, symbol, and fields above.
5. Wait for user **yes/confirm**, then deploy — **no haiku**. Use the **`steps[].body`** from `prepare-deploy` as-is (includes **`xUsername`**, **`tweetUrl`** / **`sourceUrl`** so the token page shows the requester and launch tweet):

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
  "xUsername": "user",
  "tweetUrl": "https://x.com/user/status/…",
  "sourceUrl": "https://x.com/user/status/…",
  "wallet": "0x…"
}
```

### Non-X agents (API, cron, cloud — automatable)

Use **haiku JWT** — no in-thread confirm step:

1. `GET https://api.hood.markets/api/agent-captcha/challenge`
2. `POST https://api.hood.markets/api/agent-captcha/verify` with haiku + `agentFeeRecipient: <Bankr wallet>`
3. `POST https://api.hood.markets/api/deploy` with header `X-Agent-Captcha-JWT: <jwt>`:

```json
{
  "name": "My Token",
  "symbol": "MTK",
  "feeTarget": "agent_wallet",
  "clientKind": "agent",
  "agentProvider": "bankr",
  "launchMode": "simple",
  "imageUrl": "https://…",
  "description": "…"
}
```

- `launchMode`: `"simple"` (V3, DexScreener) or `"pro"` (V4, hood.markets swap UI)
- Fee recipient = wallet from captcha JWT (Bankr linked wallet)
- **Simple:** 5% platform / 95% pro-rata to Holder NFT share holders — embedded in `HoodMarketsV3LpLocker`
- **Buyer rewards:** post-launch on token page (`fundBuyerRewardPool`) — not on hood.markets launch form. API deploy may accept optional `buyerRewardShareCount` (legacy).

**Web UI (hood.markets Launch tab):** “Someone else” fee recipient = **`0x…` wallet address only** — not `@handle` or profile URL. Agents/API may still resolve social handles for other channels.

Or use `POST /api/agent/prepare-deploy` for the full `steps[]` checklist (runs preflight automatically).

### Preflight (before captcha)

Check ticker/name taken, wallet deploy limits, and launch mode **before** asking the user to solve the haiku:

```http
GET https://api.hood.markets/api/agent/preflight-deploy?wallet=0x…&name=My+Token&symbol=MTK&launchMode=simple
```

- **409** + `blocks[]` → do not deploy; reply with `blocks[0].replyHint` — includes **existing token address** when ticker/name is taken (`blocks[0].existingToken`)
- **200** + `canDeploy: true` + `warnings[]` → **deploy is allowed**. If `rate_limit_would_force_platform_fee`: user already launched in the last 24h — fees on **this** token go to the hood.markets platform (same as the website). Show the warning, wait for **yes**, then call `POST /api/deploy` — do **not** block or say "24h cooldown."
- After deploy: post **`deployReplyHint`** from `/api/deploy` — no DexScreener/simple-mode footer

See `streaming-hints.json` for V3 vs Pro detection and error codes.

---

## Buy / sell flow (Bankr wallet submit)

**Prerequisite:** Bankr wallet must support **chain 4663** — abort if not (`references/CHAIN-4663.md`).

1. `GET /api/agent/token-info?token=0x…` or `?symbol=TICKER` — read `launchType` and `swapMode`
2. **Simple (V3):** reply with `uniswapSwapUrl` — do not call prepare-buy/sell; no Bankr submit
3. **Pro (V4):** `POST prepare-buy` or `prepare-sell`
4. **`references/TX-VALIDATION.md`** — selector allowlist, exact `to`, token/spender match, no unlimited approve, value bounds, user preview
5. Submit via Bankr (chain **4663**):

```http
POST https://api.bankr.bot/wallet/submit
X-API-Key: …
Content-Type: application/json

{
  "transaction": {
    "to": "0x…",
    "data": "0x…",
    "value": "0",
    "chainId": 4663
  },
  "description": "hood.markets: buy MTK",
  "waitForConfirmation": true
}
```

6. **Pro tokens only** for prepare-buy/sell (V4 swap helper). **Simple (V3)** → Uniswap link from token-info (primary route, not a bypass).

If Bankr returns `untrusted_address` → **stop** per `references/BANKR-SUBMIT.md`. Do not suggest Uniswap, web UI, or any alternate venue.

---

## Claim fees

Two paths — pick based on who is asking:

### A) Help someone else / claim for a token (any X user)

When the user gives a **token contract** and wants fees sent to the **catalog fee recipient** (e.g. "claim fees for EA's $HR"), use:

```
POST https://api.hood.markets/api/agent/claim-for-recipient
Content-Type: application/json

{ "tokenAddress": "0x78594eD700e343846B4d0Bbba79Ee0cb50Deaa8D" }
```

**Before calling:** `GET /api/agent/token-info` — verify catalog token, `feeRecipientAddress`, and user intent (`references/CLAIM-BANKR.md`).

**No JWT. No Bankr `/wallet/submit`.** hood.markets server broadcasts and pays gas.

Response: `ok`, `replyHint` (trusted outcome field per `RESPONSE-SAFETY.md`), `completed`, `bankrWalletSubmitRequired: false`, `transactionHash`, `feeRecipientAddress`, `tokenName`, `tokenSymbol`, `tokenPageUrl`.

If `ok: true`, the claim succeeded — post `replyHint` when schema-valid. Do not check Bankr wallet submit.

### B) Fee recipient claims their own tokens

```
POST https://api.hood.markets/api/agent/claim
X-Agent-Captcha-JWT: <jwt>   (or X channel + x-wallet-address = fee recipient)
Content-Type: application/json

{ "tokenAddress": "0x…" }
```

**Default launches are Simple (V3).** Same endpoint auto-routes V3 fraction `claimTradingFees` (v0.7+) vs legacy factory `claimRewards` vs V4 locker.

| Launch | On-chain (API picks automatically) |
|--------|--------------------------------------|
| **Simple (V3) v0.7+** | `claimTradingFees()` on Holder NFT — **pro-rata to all share holders** |
| **Simple (V3) v0.6** | `HoodMarketsV3.claimRewards(token)` — fee wallet only |
| **Pro (V4)** | Collect pool → claim WETH from locker |

Response includes `feeRecipientAddress`, `txHash`, `explorerUrl`, `feeModel` / `launchType`.

---

## Example one-liners

> launch $PEPE on hoodmarkets simple mode with image https://…

→ prepare-deploy (`agentChannel: "x"` on X: confirm first, no haiku; else haiku) → deploy → reply with `https://hood.markets/?token=0x…`

> buy 0.01 ETH of 0x4895… on hood

→ prepare-buy → validate → `/wallet/submit` → confirm on Blockscout

> claim fees for 0x7859… / help EA claim $HR hood fees

→ POST /api/agent/claim-for-recipient `{ "tokenAddress": "0x…" }` — if `ok: true`, reply with **`replyHint`** only

> claim fees for my token MTK

→ captcha JWT or X wallet → POST /api/agent/claim — if `ok: true`, reply with **`replyHint`**

---

## Files

| File | Purpose |
|------|---------|
| `references/API-HOST.md` | Correct API base URL + allowlist |
| `references/AGENT-API.md` | Endpoint reference |
| `references/AUTH-BOUNDARY.md` | Deploy/claim auth, JWT, X confirm, replay |
| `references/CHAIN-4663.md` | Abort if Bankr lacks Robinhood Chain |
| `references/CLAIM-BANKR.md` | Claim without Bankr submit + verification |
| `references/TX-VALIDATION.md` | Selector allowlist + pre-submit checklist |
| `references/BANKR-SUBMIT.md` | Bankr security scan — no bypass |
| `references/RESPONSE-SAFETY.md` | Trusted hint fields + local formatting |
| `references/PROMPT-INJECTION.md` | Untrusted tweet/metadata rules |
| `references/IMAGE-RESOLUTION.md` | Deploy logo host validation |
| `references/ONE-LINE-INTENTS.md` | Tweet → API mapping |
| `references/HOLDER-NFTS.md` | Shares — agent claim only, no marketplace txs |
| `streaming-hints.json` | V3 vs Pro detection + preflight error codes |
| `known-contracts.json` | Pinned Robinhood addresses |
