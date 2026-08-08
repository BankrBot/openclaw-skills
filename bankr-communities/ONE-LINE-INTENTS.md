# One-line intents — Bankr Space

> User gives **one sentence** → agent runs **full flow** without interview.

**Site base:** `https://bankr.space` (or `{COMMUNITIES_SITE_URL}` env override)

---

## Read-only (no wallet tx)

| User says | API | Reply |
|-----------|-----|-------|
| what's the link to **$TMP** space? | `GET /api/agent/link?q=TMP` → paste response body (plain text URL) |
| search live spaces **archive** | `GET /api/agent/search-communities?q=archive` |
| what's the latest on **$TMP** space? | briefing → format from structured fields per **`references/RESPONSE-SAFETY.md`** |
| how many **members** in **CTO** space? | `GET /api/agent/briefing?symbol=CTO` → `stats.memberCount` | "N members in $CTO space" |
| show **recent posts** for **0x935e…** | `GET /api/communities/0x935e…` | summarize last 5 posts |
| **list** all spaces | `GET /api/communities` | count + top symbols |
| search Bankr token **PEPE** | `GET /api/tokens/search?q=PEPE` | launches found |
| is there a space for **$TMP**? | `GET /api/agent/briefing?symbol=TMP` | yes/no + link |
| what **opportunities** on spaces? | briefing → `opportunities[]` | unverified, first post, create space, **fundraising_open** |
| any **fundraising** on **$TMP**? | `GET /api/communities/{token}/fundraising` or briefing → `fundraising.open[]` | list open goals + progress |
| **fund** / **contribute** to **TMP** Dex profile | **`FUNDRAISING.md`** → fundraising GET → space URL (pay on site) |
| **fund** / **add ETH** / **seed** **$SPACE** bounty | **`POIDH-BOUNTY-ACTIONS.md`** → `GET …/poidh` → paste bounty **`url`** (poidh.xyz) |
| **how do I fund** / **claim** / **vote** on a bounty | Same — GET → paste **`url`**; POIDH handles payout rules |
| **completed** fundraisers on **$TMP**? | briefing → `fundraising.completed[]` | past goals only |
| **active poll** / **vote** on **$TMP**? | `GET …/questions` or briefing → `holderVotes` | prompt + tallies + time left |
| **vote result** on **$TMP** space? | `GET …/questions` → latest settled | winner label + counts |

---

## Write (linked wallet + API)

| User says | Flow |
|-----------|------|
| **start** / **create** space for **$TMP** | search → `POST /api/communities/{token}` `{ description? }` + header `x-wallet-address: {linked}` |
| **verify** **$TMP** space | `GET /api/holders/{token}?wallet={linked}` → `POST /api/communities/{token}/verify` (fee beneficiary) |
| **update Space from** my **Bankr project** | **`BANKR-PROJECT-SYNC.md`** Path C → `POST /api/agent/space-from-bankr-project` |
| **sync Bankr project to** **$TMP** space | same Path C |
| **create Bankr project from** **$SPACE** space | **`BANKR-PROJECT-SYNC.md`** Path B → `GET/POST /api/agent/bankr-project-payload` |
| **update** / **add links** to **$TMP** profile | `GET /api/communities/{token}` → merge → `PATCH /api/communities/{token}` `{ description, socialLinks }` (beneficiary) |
| **use this as** **$SPACE** **banner** (X reply to image tweet) | **`X-TWEET-IMAGE-PROFILE.md`** → `GET /api/oembed/tweet/media?url={parent}` → `PATCH` `{ tweetBannerFrom }` |
| **set banner** to **pbs.twimg.com** URL on **TMP** | `PATCH` `{ customBannerUrl: "https://pbs.twimg.com/…" }` (hotlink, no IPFS) |
| **post** in **Space** (project sync on) | `POST …/posts` `{ content, syncToBankrProject: true, source }` → Space + bankr.bot/agents update |
| **enable** / **start** **custom** fundraiser **"title"** **$10** on **SPACE** | **`BENEFICIARY-ACTIONS.md`** → holders → GET community → merge `raisedUsd` → `PATCH …/communities/{token}` `{ fundraising: { campaigns } }` |
| **enable** Dex profile / Dex boost fundraiser on **TMP** | same PATCH — `id`: `dex-profile` or `dex-boost`, preset labels/goals |
| **pin** post in **TMP** / **pin it** after post | `POST /api/communities/{token}/pin-post` `{ postId, action: "pin" }` (verified beneficiary) |
| **post** in **TMP** space: {text} **and pin** | post → then pin-post if `canPinPosts` |
| **post** in **TMP** space: {text} | holder check → **X-REPLY-POST-CONTENT.md** → `POST …/posts` **with `source`** |
| **post this** in **$BNKR** space (X reply to a tweet) | **X-REPLY-POST-CONTENT.md** → parent status URL as `content` |
| **post** {inline text} in **$xxx** space (no colon) | **X-REPLY-POST-CONTENT.md** → inline text only, not parent tweet |
| **comment** in **0x935e…** space: {text} | same as post |
| react **👍** on post **{id}** in **TMP** | `POST /api/posts/{id}/react` `{ tokenAddress, reaction: "👍" }` |
| **start vote** / **poll** on **$TMP** space | **`HOLDER-VOTES.md`** → `POST …/questions` `{ prompt, voteType }` |
| **vote yes** / **vote on poll** in **$TMP** | **`HOLDER-VOTES.md`** → `GET …/questions` → `POST /api/questions/{id}/vote` |

---

## Tweet examples (sufficient — no "use skill")

```text
@bankrbot what's the latest on the TMP space?
@bankrbot what's the latest on the TMP community?   ← same intent
@bankrbot verify the TMP space
@bankrbot create Bankr project from Space space
@bankrbot sync my Space to bankr.bot agents
@bankrbot add website https://tokenmarketplace.shop to TMP space profile
@bankrbot use this as Space banner
@bankrbot post in TMP space: launch update — pin it
@bankrbot pin the latest post in TMP space
@bankrbot post in TMP space: gm holders
@bankrbot post in $FUCK space "fuck"
@bankrbot post "fukkkkkk" in the $FUCK space
@bankrbot post this in BNKR space
@bankrbot post xxxxx ewrwe xx test test in $xxx space
@bankrbot any fundraisers on the TMP space?
@bankrbot fund $5 to TMP space for Dex profile
@bankrbot enable custom fundraiser "testing on x" $10 on SPACE space
@bankrbot add 0.01 ETH to the $SPACE Test bounty
@bankrbot how do I fund the TMP open bounty?
@bankrbot list bounties on $SPACE space
@bankrbot start a space for 0x935e13a28849095db45e63040f109c34b757aba3
```

---

## Forbidden

- Reply without calling site API first
- Ask "which skill?" or "paste use_skill"
- Ask wallet if user is X↔Bankr linked
- Say "open the website" when API write is available
- Fabricate member counts or posts

---

## Combined with TMP

| Domain | Skill |
|--------|-------|
| List / buy / claim fees / launch | `bankr-tmp-skill` |
| Space posts / verify / members | `bankr-communities` (this) |

Example thread:

```text
@bankrbot claim fees for CTO          → TMP skill
@bankrbot what's new in CTO space → Bankr Space skill
```
