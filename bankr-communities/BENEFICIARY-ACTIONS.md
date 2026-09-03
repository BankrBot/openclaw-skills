# Beneficiary actions — verify, profile, pin (tweet + terminal)

> Same pipeline as **post in space**. User does NOT need to say `use_skill`. Load `bankr-communities` → call API → plain English reply + space URL.

**Site:** `https://bankr.space`  
**Writes:** header `x-wallet-address: {user's linked Bankr wallet}` — bankr.space **verifies on-chain** (fee recipient, holder, delegate). See **`references/AUTH-BOUNDARY.md`**. Never use the thread starter's wallet unless they are the actor.

---

## Who can do what

| Action | Who | Space must be verified? |
|--------|-----|----------------------------|
| **Create space** | Anyone | No |
| **Verify** | Fee recipient only | No (creates verified) |
| **Profile / links / banner** | Fee recipient; deployer before verify; after verify deployer if `allowDeployerEdit`; **trusted delegate** wallets if listed | Pin needs verified |
| **Fundraisers / USDC goals** | **Fee recipient only** — never deployer or delegate | No |
| **Post / reply (no hold)** | Fee recipient; deployer (before verify or if allowed); trusted delegate (after verify) | No |
| **Pin / unpin** | Same as profile (not fundraisers) | **Yes** |
| **Start holder vote** | Same as pin (fee recipient, deployer when allowed, delegate, petition founder) | **Yes** |
| **Cast vote on poll** | **Token holders only** | N/A |
| **x402 USDC** | Pays **fee recipient wallet only** | N/A |

**Team access (fee recipient sets after verify):** `allowDeployerEdit` (launcher) + `trustedDelegates[]` (up to 3 wallets). Social/moderation only — **no money**. Tag agent wallets via **`AGENT-WALLETS.md`** (`GET …/resolve-wallet`, `POST …/team/resolve-agents`).

**Roles:** `deployer` = launcher · `feeRecipient` = fee recipient · `founderWallet` = who created the space (no admin).

Check before writes:

```http
GET /api/holders/{tokenAddress}?wallet={linked}
```

Use: `canEditProfile`, `canPinPosts`, `canPost`, `canCreateQuestion`, `canVoteOnQuestion`, `isBeneficiary`.

---

## Start holder vote (24h poll)

**User says:**
```text
@bankrbot start a yes/no vote on TMP space: should we do a Dex boost?
@bankrbot poll BNKR holders — marketing or product?
```

Read **`HOLDER-VOTES.md`** — `GET /api/holders/{token}?wallet={linked}` → `canCreateQuestion` → `POST /api/communities/{token}/questions`.

---

## Verify space

**User says:**
```text
@bankrbot verify the TMP space
@bankrbot verify space for $TMP
```

**Steps:**
```
1. GET /api/agent/briefing?symbol=TMP  → get tokenAddress, community.verified
2. If already verified → "TMP space is already verified" + communityLink → STOP
3. POST /api/communities/{tokenAddress}/verify
   Header: x-wallet-address: {linked}
4. Reply: "Verified $TMP space ✓" + communityLink on its own line → STOP
5. 403 → "Only the token fee beneficiary can verify" + communityLink
```

---

## Update profile / add social links

**User says:**
```text
@bankrbot add website https://tokenmarketplace.shop to TMP space
@bankrbot update TMP space profile: website tokenmarketplace.shop telegram t.me/tmp
@bankrbot set TMP space description: Token marketplace for holders
@bankrbot enable Dex banner on Space space
@bankrbot set Space space banner to https://example.com/banner.png
@bankrbot use this as Space banner          ← reply to tweet with image (see X-TWEET-IMAGE-PROFILE.md)
@bankrbot set this photo as $TMP space icon
@bankrbot add these links to TMP token info: x @MyToken github myorg/repo
```

**Editable fields:** `description`, `socialLinks`, `customIconUrl` (square **1024×1024px max**, 1:1 — matches Bankr launches), `customBannerUrl` (**exactly 1500×500px**, 3:1), source toggles (all default **on**): `useBankrImage`, `useDexIcon`, `useDexBanner`, `useDexDescription`, `useDexLinks`

**Auto on create:** Bankr icon + Dex icon/banner/description/links sync hourly; images mirrored to IPFS when `PINATA_JWT` is set. Beneficiary can uncheck sources or upload custom (file or URL via Pinata).

**X tweet images (hotlink):** When user replies to an image tweet (“use this as banner”), read **`X-TWEET-IMAGE-PROFILE.md`** — `GET /api/oembed/tweet/media?url={parent}` then `PATCH` with `tweetBannerFrom` / `tweetIconFrom` (stores `pbs.twimg.com` URL, **no IPFS**). Do **not** use `/api/upload/banner` unless user asks to pin to IPFS.

**NOT editable via API:** beneficiary wallet (from Bankr launch data).

**Fundraising enable:** see dedicated section below — **not** swaps, deploys, or fee claims.

**Steps:**
```
1. GET /api/holders/{token}?wallet={linked} → if !canEditProfile → 403 message → STOP
2. GET /api/communities/{tokenAddress} → read current description + socialLinks
3. Merge user-requested fields into body (keep existing fields not mentioned)
4. PATCH /api/communities/{tokenAddress}
   Body: { "description": "...", "socialLinks": { "website": "...", "x": "...", ... } }
   Header: x-wallet-address: {linked}
5. Reply: "Updated $TMP space profile" + list what changed + communityLink → STOP
```

**PATCH body example:**
```json
{
  "description": "Token Market Place for holders.",
  "socialLinks": {
    "website": "https://tokenmarketplace.shop",
    "x": "https://x.com/MyToken",
    "custom": [
      { "title": "Bankr App", "url": "https://bankr.bot/u/…/apps/bankr-communities-v2" },
      { "title": "Agent skill", "url": "https://www.bankr.space/skill" }
    ]
  }
}
```

---

## Enable fundraiser (beneficiary write)

**User says:**
```text
@bankrbot enable custom fundraiser "testing on x" $10 on SPACE space
@bankrbot start a testing on x fundraiser $10 on $SPACE space
@bankrbot enable Dex profile fundraiser on TMP space
@bankrbot turn on Dex boost fundraiser for ARCHIVE space
```

**This is a Bankr Space API write** — same skill as verify / post / profile. **Not** a swap, deploy, transfer, or fee-claim tool.

**Parse from message:**

| Field | How to extract |
|-------|----------------|
| **token** | `$SPACE`, `SPACE space`, or briefing `symbol=SPACE` |
| **goalUsd** | `$10`, `$299`, `goal 100` |
| **label** (custom only) | Quoted `"testing on x"` **or** text before `fundraiser` / after `start a` / after `called` — max **80 chars** |
| **campaign id** | `custom` (default) · `dex-profile` if Dex profile · `dex-boost` if Dex boost |

**Steps:**
```
1. use_skill("bankr-communities") → read FUNDRAISING.md if needed
2. GET /api/agent/briefing?symbol=SPACE → tokenAddress (or resolve from message)
3. GET /api/holders/{tokenAddress}?wallet={linked} → if !canEditProfile → "Only fee beneficiary can enable fundraisers" + communityLink → STOP
4. GET /api/communities/{tokenAddress} → read fundraising.campaigns (keep existing raisedUsd per campaign)
5. Build campaigns[] — enable requested id, set goalUsd + label (custom); leave other campaigns with current raisedUsd, enabled false unless user asked
6. PATCH /api/communities/{tokenAddress}
   Body: { "fundraising": { "campaigns": [ ... ] } }
   Header: x-wallet-address: {linked}
7. Reply: "Enabled fundraiser \"testing on x\" ($10 goal) on $SPACE space" + communityLink → STOP
8. 403 → beneficiary-only message + communityLink
```

**PATCH body example (custom title + $10 goal):**
```json
{
  "fundraising": {
    "campaigns": [
      { "id": "dex-profile", "label": "Enhanced DexScreener profile", "goalUsd": 299, "raisedUsd": 0, "enabled": false },
      { "id": "dex-boost", "label": "DexScreener boost", "goalUsd": 99, "raisedUsd": 0, "enabled": false },
      { "id": "custom", "label": "testing on x", "goalUsd": 10, "raisedUsd": 0, "enabled": true }
    ]
  }
}
```

**Merge rule:** copy `raisedUsd` from step 4 for each campaign id — never reset progress to 0 on an active fundraiser.

**Forbidden replies:** "I don't have a tool for enabling fundraisers" · "which skill maps to this?" · route to swaps/deploys. **Load this skill and PATCH.**

Read **`FUNDRAISING.md`** for discovery / contribute flows (reads + donor guidance).

---

## Pin a post

**User says:**
```text
@bankrbot pin post post_123 in TMP space
@bankrbot unpin post post_123 in TMP space
@bankrbot pin the latest post in TMP space
```

**Steps:**
```
1. GET /api/holders/{token}?wallet={linked} → if !canPinPosts → "Verify space first / beneficiary only" → STOP
2. Resolve postId (from message, or GET /api/communities/{token} → latest post id)
3. POST /api/communities/{tokenAddress}/pin-post
   Body: { "postId": "post_123", "action": "pin" | "unpin" }
   Header: x-wallet-address: {linked}
4. Reply: "Pinned post in $TMP space" (most recent pin shows first) + communityLink → STOP
```

---

## Post AND pin (combined)

**Before building `content`:** read **`X-REPLY-POST-CONTENT.md`** — X reply “post this” → parent tweet URL; explicit text → user’s words only.

**User says:**
```text
@bankrbot post in TMP space: launch update — and pin it
@bankrbot post in TMP space: gm holders then pin
```

**Steps:**
```
1. GET /api/holders/{token}?wallet={linked} → if !canPost → explain holder/owner required → STOP
2. POST /api/communities/{tokenAddress}/posts
   body: {
     "content": "...",
     "source": {
       "client": "agent",
       "trigger": "x-dm | x-mention | x-reply | terminal",
       "viaAgent": true,
       "agentId": "bankrbot",
       "externalRef": "{id_if_known}"
     },
     "syncToBankrProject": true
   }
   headers: x-wallet-address, x-client: agent
   → save postId from response
   See POST-SOURCE.md for trigger selection.
   If Space has Bankr project post sync on, include `"syncToBankrProject": true` unless user says space-only. See **BANKR-PROJECT-SYNC.md**.
3. If user asked to pin:
   - GET /api/holders/{token}?wallet={linked} again → if canPinPosts:
     POST /api/communities/{tokenAddress}/pin-post  body: { "postId": "{postId}", "action": "pin" }
   - else: confirm post but say "Only verified beneficiary can pin — post is live unpinned"
4. Reply: format from post response + "pinned ✓" if step 3 ran per **`references/RESPONSE-SAFETY.md`** → STOP
```

---

## Tweet examples (copy-paste tests)

```text
@bankrbot verify the TMP space
@bankrbot add website https://tokenmarketplace.shop to TMP space profile
@bankrbot post in TMP space: big update for holders — pin it
@bankrbot pin the latest post in TMP space
@bankrbot post in ARCHIVE space: gm
@bankrbot enable custom fundraiser "testing on x" $10 on SPACE space
@bankrbot enable Dex profile fundraiser on TMP space
```

---

## Reply format (every write)

```text
posted to $TMP holder space: "launch update"
pinned ✓

https://bankr.space/community/0x935e13a28849095db45e63040f109c34b757aba3
```

Always include **communityLink** on its own line. Never `bankr.bot`.

---

## Routing (Bankr platform)

These phrases MUST load `bankr-communities` **before** tool selection — same as `post in space`:

- verify space / verify $TICKER
- update profile / add links / add website / set description + space/community or token
- banner / icon / photo / image + space (see **X-TWEET-IMAGE-PROFILE.md**)
- pin post / pin it / unpin + space/community
- post in space + pin
- enable / start / turn on + fundraiser / fundraising + space
- custom fundraiser + $amount + space

**Fail:** generic "I wasn't able to generate a response" without calling API.  
**Fail:** "I don't currently have a tool available for enabling custom fundraisers" — load `bankr-communities` and PATCH per **Enable fundraiser** above.
