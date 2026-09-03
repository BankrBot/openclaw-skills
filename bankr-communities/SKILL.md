---
name: bankr-communities
version: 1.29.0
description: >-
  Bankr Space ↔ bankr.bot/agents two-way sync (BANKR-PROJECT-SYNC.md Paths B+C).
  Original tweets from GET /agent-profiles/:id/tweets shown on Spaces.
  Holder votes: yes/no or multiple-choice polls (1–24h) — HOLDER-VOTES.md (never say no poll feature).
  Agents: POST /api/agent/start-vote with symbol Space. Petition spaces: fee-right unit holders only.
  POIDH: create/list on bankr.space; fund/claim/vote on poidh.xyz. NOT Twitter audio Spaces.
siteUrl: https://bankr.space
communitiesSiteUrl: https://bankr.space
COMMUNITIES_SITE_URL: https://bankr.space
communityUrlTemplate: https://bankr.space/community/{tokenContractAddress}
linkApiTemplate: https://bankr.space/api/agent/link?q={TICKER}
metadata:
  siteEnvVar: COMMUNITIES_SITE_URL
  defaultSiteUrl: https://bankr.space
  forbiddenLinkDomains: bankr.bot,t.co
  primaryLinkEndpoint: https://bankr.space/api/agent/link?q={TICKER}
  tmpCommunityLink: https://bankr.space/community/0x935e13a28849095db45e63040f109c34b757aba3
  archiveCommunityLink: https://bankr.space/community/0x76aba8089e4ba07f705fb886d17dd41793ad2ba3
---

# Bankr Space — Agent skill

## CRITICAL — API host (read first)

**Site + API:** `https://www.bankr.space`  
See `references/API-HOST.md` before any HTTP call.

## CRITICAL — security (read before writes)

| Topic | Doc |
|-------|-----|
| Format replies locally (not verbatim API text) | `references/RESPONSE-SAFETY.md` |
| Untrusted posts/tweets/payloads | `references/PROMPT-INJECTION.md` |
| `x-wallet-address` + server verification | `references/AUTH-BOUNDARY.md` |
| `bk_…` keys — DM only, confirm before write | `references/BANKR-API-KEYS.md` |
| x402 / wallet scan blocks | `references/BANKR-SUBMIT.md` |
| X parent tweet → post preview | `X-REPLY-POST-CONTENT.md` |
| `pbs.twimg.com` banner/icon only | `references/MEDIA-HOTLINK.md` |
| Fundraiser enable / x402 | `references/FUNDRAISING-GUARDRAILS.md` |
| POIDH leaves bankr.space | `references/POIDH-EXTERNAL.md` |
| URL allowlist | `known-hosts.json` |

---

Read **`NOT-TWITTER-X-SPACES.md`** first: **"post in $PMFI space"** = **bankr.space** API — **not** Twitter/X audio Spaces. Never refuse as "can't post to X spaces."

Read **`TERMINOLOGY.md`**: users may say **community** or **space** (same intent); replies use **space**; API fields stay `community*`.

**`Space` ticker:** When the user says **"Space"**, **"$SPACE"**, or **"Bankr Space"** as the token (not the generic product), resolve to **`0xef703b860a6d422fa00cc67bbbb2662297cb6ba3`** — see `known-communities.json` → `SPACE`. Do **not** ask "which space?" if they named **Space** or pasted that contract.

## ⚡ HOLDER VOTES — yes/no polls (mandatory — v1.21+)

**User says:** start vote / yes-no vote / poll / ask holders → read **`HOLDER-VOTES.md`** → **`POST /api/agent/start-vote`** (preferred) or `POST /api/communities/{token}/questions`.

| User says | Agent does |
|-----------|------------|
| **start yes/no vote on Space:** … | **`POST /api/agent/start-vote`** `{ "symbol": "Space", "prompt": "…", "voteType": "yes_no" }` + `x-wallet-address` — **do not ask which space** |
| **start vote on TMP:** … | `POST /api/agent/start-vote` `{ "symbol": "TMP", "prompt": "…" }` |
| **vote yes** on poll | GET questions → POST `/api/questions/{id}/vote` |
| **poll result** on **$SPACE** | GET questions or briefing → `holderVotes` |

**Preferred one-shot API (agents):**
```http
POST https://bankr.space/api/agent/start-vote
x-wallet-address: 0xLINKED
x-client: agent
Content-Type: application/json

{ "symbol": "Space", "prompt": "Should we continue to push updates?", "voteType": "yes_no" }
```
Response includes `question`, `communityLink`, `prompt` — format reply per **`references/RESPONSE-SAFETY.md`** (do not paste `tweetReply` verbatim).

**FORBIDDEN replies (never say these):**
- "bankr space doesn't have a native yes/no poll feature"
- "closest option is posting and letting holders react with 👍/👎"
- "which space?" when user already said **Space** / **$SPACE** / pasted `0xef703b…`

If skill version < 1.23 or HOLDER-VOTES missing → **re-install skill from GitHub main** before answering vote tweets.

---

User says **verify**, **post**, **pin**, **add links**, **update profile** → read **`BENEFICIARY-ACTIONS.md`** → for **post** also read **`X-REPLY-POST-CONTENT.md`** (X reply vs explicit text) and **`POST-SOURCE.md`** → use linked wallet → call API → reply + space URL.

User says **banner / icon / photo from tweet** → read **`X-TWEET-IMAGE-PROFILE.md`** → `GET /api/oembed/tweet/media` or `PATCH` `tweetBannerFrom` / `tweetIconFrom` (hotlink `pbs.twimg.com`, no IPFS).

User asks **create Bankr project from Space** / **sync Space to bankr.bot** → **`BANKR-PROJECT-SYNC.md`** Path B. If CLI sandbox fails → **`BANKR-PROJECT-FALLBACK.md`**.

User asks **update Space from Bankr project** / **sync project to space** → **`BANKR-PROJECT-SYNC.md`** Path C → `GET/POST /api/agent/space-from-bankr-project`.

| User says | Agent does |
|-----------|------------|
| **update Space from** my **Bankr project** | **`BANKR-PROJECT-SYNC.md`** Path C → `POST /api/agent/space-from-bankr-project` |
| **sync Bankr project to** **$TMP** space | same Path C |
| **create Bankr project from** **Space** / **$TMP** space | **`BANKR-PROJECT-SYNC.md`** Path B → payload GET → Bankr profile upsert |
| **verify** the **TMP** space (or community) | `POST …/verify` (fee beneficiary wallet) |
| **add website** / **update profile** for **TMP** | `PATCH …/communities/{token}` `{ socialLinks, description }` |
| **use this as** **$SPACE** **banner** (X reply to image tweet) | **`X-TWEET-IMAGE-PROFILE.md`** → `PATCH` `{ tweetBannerFrom: parent_status_url }` |
| **set this photo as** **TMP** **icon** | **`X-TWEET-IMAGE-PROFILE.md`** → `PATCH` `{ tweetIconFrom: parent_status_url }` |
| **post** in **TMP**: text **and pin it** | `POST …/posts` **with `source`** → `POST …/pin-post` if verified beneficiary |
| **pin** latest post in **TMP** | `POST …/pin-post` `{ postId, action: "pin" }` |
| **fund** / **contribute** to **TMP** space fundraiser | Read **`FUNDRAISING.md`** → `GET …/fundraising` or briefing → reply progress + space URL |
| **create bounty** / **open bounty** for **$SPACE** | Read **`POIDH-BOUNTY-ACTIONS.md`** → `POST …/poidh/request` |
| **add ETH** / **seed** / **fund** / **claim** / **vote** on bounty | **`POIDH-BOUNTY-ACTIONS.md`** → `GET …/poidh` → paste bounty **`url`** (poidh.xyz) |
| **list** bounties on **$SPACE** | **`POIDH-BOUNTY-ACTIONS.md`** → `GET …/poidh` |
| **start vote** / **poll** / **ask holders yes or no** on **$SPACE** | **`HOLDER-VOTES.md`** → `POST …/questions` |
| **vote yes** / **vote on poll** in **$SPACE** | **`HOLDER-VOTES.md`** → `GET …/questions` → `POST /api/questions/{id}/vote` |
| any **fundraising** on **$ARCHIVE**? | `GET …/fundraising` or briefing → `fundraising.open[]` |

**Post writes:** always send `source` (`client: agent`, `trigger: x-dm` | `x-mention` | `x-reply` | `terminal`, `viaAgent: true`, `agentId: bankrbot`). See **`POST-SOURCE.md`**.

Check permissions: `GET /api/holders/{token}?wallet={linked}` → `canEditProfile`, `canPinPosts`, `canPost`.

---

## ⚡ LINK QUESTIONS — instant reply (no tools needed)

User asks **"what's the link to the TMP space?"** → read **`INSTANT-LINK-REPLIES.md`** → paste URL from table. **Do not call HTTP first.** **Never** reply empty.

| Token | Tweet reply (one line only) |
|-------|----------------------------|
| **TMP** | `https://bankr.space/community/0x935e13a28849095db45e63040f109c34b757aba3` |
| **ARCHIVE** | `https://bankr.space/community/0x76aba8089e4ba07f705fb886d17dd41793ad2ba3` |

For **other** tickers → `GET https://bankr.space/api/agent/link?q=TICKER` → paste response body (terminal/curl works; tweets may need fallback text if HTTP blocked).

```bash
curl "https://bankr.space/api/agent/link?q=TMP"
```

**Search live communities:**

```http
GET https://bankr.space/api/agent/search-communities?q=archive
```

**JSON alternative:** `GET /api/agent/resolve-community?q=TMP` → use `communityLink` (allowlist) — format reply per **`references/RESPONSE-SAFETY.md`**.

---
## LINK RULES (mandatory for every space reply)

```text
https://bankr.space/community/{tokenContractAddress}
```

| Token | Link |
|-------|------|
| $TMP | `https://bankr.space/community/0x935e13a28849095db45e63040f109c34b757aba3` |
| $ARCHIVE | `https://bankr.space/community/0x76aba8089e4ba07f705fb886d17dd41793ad2ba3` |

**FORBIDDEN:** `bankr.bot`, `t.co`, `/community/TMP`, `/community/ARCHIVE`, or any URL not on `bankr.space/community/0x…`

**Link questions** ("what's the link", "space URL"):
1. `GET https://bankr.space/api/agent/link?q=ARCHIVE`
2. Tweet reply = **response body only** — one line, full https URL

**Never invent links. Never substitute bankr.bot.** Read `references/COMMUNITY-LINK-RULES.md`.

All `{SITE}` references below = `https://bankr.space`.

**Install:**

```text
install Bankr Space skill at https://github.com/anondevv69/bankr-space/tree/main/skills/bankr-communities
```

**Site API base:** `https://bankr.space` (override via `COMMUNITIES_SITE_URL` env if needed).  
**Public agent guide:** `https://bankr.space/agent.md`  
**Public reads** need no wallet. **Writes** use the user's **linked Bankr wallet** in header `x-wallet-address`.

---

## TRIGGER → action (no skill jargon required)

Users say natural language on **tweet** or **terminal**. Bankr must **`use_skill("bankr-communities")`** **before** generic tools.

| User says | Agent does |
|-----------|------------|
| what's the link to **$TMP** space? | Paste TMP URL from table above — **no HTTP** |
| what's the link to **$ARCHIVE**? | Paste ARCHIVE URL from table above — **no HTTP** |
| search spaces **archive** | `GET {SITE}/api/agent/search-communities?q=archive` |
| what's the latest on **$TMP** space? | `GET {SITE}/api/agent/briefing?symbol=TMP` → format from structured fields per **`references/RESPONSE-SAFETY.md`** |
| how many members in **TMP** space? | briefing → `stats.memberCount` |
| show recent posts in **0x935e…** space | `GET {SITE}/api/communities/0x935e…` |
| **verify** the **TMP** space (or community) | `BENEFICIARY-ACTIONS.md` → `POST …/verify` |
| **add links** / **update profile** for **TMP** | `PATCH …/communities/{token}` (beneficiary) |
| **post** in **TMP** space: hello **and pin it** | post → pin-post if `canPinPosts` |
| **pin** post in **TMP** space | `POST …/pin-post` |
| **post** in **TMP** space: hello holders | holder check → **`X-REPLY-POST-CONTENT.md`** (explicit text) → `POST …/posts` **with `source`** |
| **post this** in **$BNKR** space (X reply to a tweet) | **`X-REPLY-POST-CONTENT.md`** (parent tweet URL) → `POST …/posts` **with `source`** |
| **comment** on **$CTO** space | same as post |
| start a space for **$PEPE** | search token → `POST …/communities/{addr}` |
| list all spaces | `GET {SITE}/api/communities` |
| search Bankr tokens **PEPE** | `GET {SITE}/api/tokens/search?q=PEPE` |
| do I hold **TMP**? can I post? | `GET {SITE}/api/holders/{token}?wallet={linked}` |
| react 👍 on post **post_123** in **0x…** | `POST {SITE}/api/posts/post_123/react` |
| any **fundraising** on **$TMP** space? | `GET {SITE}/api/communities/{token}/fundraising` or briefing → `fundraising.open[]` |
| **fund** **$5** to **TMP** space for **Dex** | **`FUNDRAISING.md`** → fundraising GET → reply progress + space URL (wallet pays on site) |
| **enable** custom fundraiser **"testing on x"** **$10** on **SPACE** space | **`BENEFICIARY-ACTIONS.md`** → `PATCH …/communities/{token}` `{ fundraising }` (beneficiary) |
| **enable** Dex profile fundraiser on **TMP** | same PATCH — `id`: `dex-profile` |
| **QRCoin** fundraiser for **SPACE** | **`SKILL-LINKED-FUNDRAISERS.md`** → custom fundraiser + [qrcoin skill](https://skills.bankr.bot/skills/qrcoin) |
| **0xWork** bagwork / bounties for **TMP** | **`SKILL-LINKED-FUNDRAISERS.md`** → custom fundraiser + [0xwork skill](https://skills.bankr.bot/skills/0xwork) |

**Forbidden:** ask user for skill name · ask wallet if X↔Bankr linked · invent space data without API call · say "can't post to X spaces" or "post manually" (see **NOT-TWITTER-X-SPACES.md**) · say **"I don't have a tool for enabling fundraisers"** without loading this skill and PATCHing (see **BENEFICIARY-ACTIONS.md**) · ask for recipient **0x** to fund a bounty — use **POIDH-BOUNTY-ACTIONS.md** → `GET …/poidh` → paste bounty **`url`** (poidh.xyz).

---

## Mandatory routing guard

```
if message contains "link" OR "url" OR "where is" + space or community/token:
  1. use_skill("bankr-communities")
  2. Read INSTANT-LINK-REPLIES.md
  3. If TMP or ARCHIVE → paste URL from table → STOP (no tools, no HTTP)
  4. Else try GET /api/agent/link?q={TICKER} → paste body
  5. If HTTP fails → known-communities.json → NEVER empty / "couldn't generate"
else if space intent (verify, post, pin, profile, update links, members, latest, fund, fundraiser, fundraising, contribute, enable fundraiser, start fundraiser, custom fundraiser, bounty, bounties, poidh, seed bounty, add eth to bounty):
  1. use_skill("bankr-communities")     ← BEFORE swaps/deploys/transfers
  2. add eth / seed / fund / claim / vote + bounty (not USDC fundraiser) → POIDH-BOUNTY-ACTIONS.md → GET poidh → paste bounty url (poidh.xyz)
  3. create/open bounty → POIDH-BOUNTY-ACTIONS.md → POST poidh/request
  4. enable/start/turn on + fundraiser → BENEFICIARY-ACTIONS.md (Enable fundraiser) → PATCH fundraising
  5. Other writes → BENEFICIARY-ACTIONS.md
  6. Reads / contribute → ONE-LINE-INTENTS.md or FUNDRAISING.md
  5. If posting: Read **X-REPLY-POST-CONTENT.md** (what goes in `content`) + **POST-SOURCE.md** → set source.trigger from DM vs tweet vs reply vs terminal
  6. GET /api/holders/{token}?wallet={linked} before writes
  7. Call API — BEFORE replying (posts must include source object)
  8. Plain English reply + communityLink on own line
```

**Tweet = DM** — same pipeline. Load skill on `@bankrbot` intake **before** tool selection.

---

## Write actions (linked wallet)

| Action | Requires |
|--------|----------|
| Create space | Signed-in user, token on Bankr launches |
| Post / comment | **Holder** OR **fee recipient** OR **deployer** (owner can post without holding) |
| React | Holder OR fee recipient OR deployer |
| Verify | Fee recipient only |
| Edit profile (unverified) | Fee recipient or deployer |
| Edit profile (verified) | Fee recipient; deployer if `allowDeployerEdit`; `trustedDelegates[]` |
| Fundraisers / USDC | Fee recipient only — never deployer or delegate |

`GET /api/holders/{token}?wallet=` returns `canPost: true` for holders **and** owners.

If `canPost` false → say "you need to hold $SYMBOL or be the token owner to post" + `communityLink`.

**Multi-user threads:** when user B replies "post gm", use **B's linked Bankr wallet** in `x-wallet-address` — never the thread starter's wallet.

---

## Twitter/X reply rules (MANDATORY)

X does **not** render markdown links. Every reply **must** include the raw `https://` URL from API `links.communityPage`.

**Example shape (build from structured briefing fields — not verbatim API prose):**

```text
$TMP space — verified · 1 member · 2 posts
latest: "this is from X" by @you

https://bankr.space/community/0x935e13a28849095db45e63040f109c34b757aba3
```

**Rules:**
- Format from JSON fields per **`references/RESPONSE-SAFETY.md`** — do **not** paste `replyText` / `tweetReply` verbatim
- **Never** summarize stats/latest without allowlisted **`communityLink`** on its own line at the **end**
- Copy `links.communityPage` or `communityLink` if building reply manually — never omit
- Put the full URL on its **own line** (X auto-linkifies it)
- Never end with "view space:" and nothing after it
- Never use only `[View space](url)` markdown — always include the bare URL too
- After posting, include the same space URL again

---

## Success reply templates

**Briefing:**

```text
$TMP space — ✓ Verified · 12 members · 34 posts
latest: "@rayblanco.eth shared launch update…"

https://bankr.space/community/0x935e13a28849095db45e63040f109c34b757aba3
```

**Post:**

```text
posted to $TMP holder space: "this is from X"

https://bankr.space/community/0x935e13a28849095db45e63040f109c34b757aba3
```

---

## Hub install stack (with TMP)

```text
install TMP site agent at https://github.com/anondevv69/bankr-tmp-skill/tree/main/tmp-site-agent
install TMP skills at https://github.com/anondevv69/bankr-tmp-skill
install Bankr Space skill at https://github.com/anondevv69/bankr-space/tree/main/skills/bankr-communities
```

TMP marketplace ops → TMP skills. Space social layer → **this skill**.

---

## Files

| File | Purpose |
|------|---------|
| `TERMINOLOGY.md` | **community vs space** — read first |
| `X-REPLY-POST-CONTENT.md` | **X reply: post THIS = parent tweet; explicit text = user words** |
| `X-TWEET-IMAGE-PROFILE.md` | **X reply: banner/icon from tweet → pbs.twimg.com hotlink (no IPFS)** |
| `BANKR-PROJECT-SYNC.md` | **Space ↔ bankr.bot/agents profile + project updates (auto after site setup)** |
| `POST-SOURCE.md` | **Mandatory `source` on every agent post** (X DM, mention, terminal) |
| `BENEFICIARY-ACTIONS.md` | **Verify, profile, pin, post+pin, enable fundraisers — tweet + terminal** |
| `FUNDRAISING.md` | **Discover open/completed fundraisers, guide USDC x402 contributions** |
| `AGENT-WALLETS.md` | **Tag agent wallets (bankrbot, hermes) for fee recipient & trusted delegates** |
| `SKILL-LINKED-FUNDRAISERS.md` | **Fundraiser → USDC → Bankr Skills (qrcoin, 0xwork) on [skills.bankr.bot](https://skills.bankr.bot/)** |
| `PLATFORM-AGENT.md` | **Opt-in Bankr Space Agent across all spaces — money rules** |
| `POIDH-BOUNTIES.md` | POIDH overview — ETH bounties vs x402 |
| `POIDH-BOUNTY-ACTIONS.md` | **Execute create/seed/list — GET poidh, POST seed/request (mandatory for add ETH tweets)** |
| `HOLDER-VOTES.md` | **24h yes/no or multiple-choice holder votes on a space** |
| `PLATFORM-AGENT-WORKER.md` | **Aeon / Hermes cron worker — platform-spaces loop, headers, internal APIs** |
| `INSTANT-LINK-REPLIES.md` | Link questions — paste URL, no HTTP (read first for links) |
| `GET-LINK.md` | GET /api/agent/link for unknown tickers |
| `LINK-INTENT-ONLY.md` | Pointer to GET-LINK.md |
| `ONE-LINE-INTENTS.md` | Full intent table |
| `community-autopilot.md` | Step-by-step execution |
| `references/COMMUNITY-LINK-RULES.md` | **Mandatory link format — never bankr.bot** |
| `references/AGENT-ROUTING-COMMUNITIES.md` | Routing guard |
| `references/BANKR-PLATFORM-TWEET-INTAKE.md` | Platform requirements |
| `references/community-api-reference.md` | All endpoints |
