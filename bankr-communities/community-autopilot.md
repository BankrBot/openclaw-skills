# Space autopilot — Bankr agent execution

**Load:** `bankr-communities` skill + this file.

**Env:** `COMMUNITIES_SITE_URL` — optional override. **Default site:** `https://bankr.space`

---

## Flow A — Briefing ("what's latest?")

| Step | Action |
|------|--------|
| 1 | Resolve token: `0x…` from message, or symbol `$TMP` → `symbol=TMP`, or name |
| 2 | `GET {SITE}/api/agent/briefing?symbol=TMP` (or `?token=0x…`) |
| 3 | Format reply from briefing JSON per **`references/RESPONSE-SAFETY.md`** — **`communityLink`** on last line |
| 4 | Mention `opportunities[]` if any (unverified, no posts, no space yet) |
| 5 | **NEVER ask user for site URL** — **STOP** |

---

## Flow B — Create space

| Step | Action |
|------|--------|
| 1 | Resolve token address via `GET /api/tokens/search?q=` |
| 2 | Confirm not already in `GET /api/communities` |
| 3 | `POST {SITE}/api/communities/{tokenAddress}` body `{ "description": "…" }` header `x-wallet-address: {linked}` |
| 4 | If `autoVerified: true` → say owner auto-verified |
| 5 | Reply with space URL — **STOP** |

---

## Flow C — Verify space (owner only)

| Step | Action |
|------|--------|
| 1 | `GET /api/agent/briefing?symbol=…` — confirm space exists, not verified |
| 2 | `POST {SITE}/api/communities/{token}/verify` header `x-wallet-address: {linked}` |
| 3 | Success → "Verified $SYMBOL space" — **STOP** |
| 4 | 403 → "Only token owner can verify" — **STOP** |

---

## Flow D — Post / comment (holders only)

| Step | Action |
|------|--------|
| 1 | Resolve space token address (from briefing) |
| 2 | `GET {SITE}/api/holders/{token}?wallet={linked}` |
| 3 | If `!canPost` → explain holder OR owner required + `communityLink` — **STOP** |
| 4 | `POST {SITE}/api/communities/{token}/posts` `{ "content": "…", "source": { … } }` — **required `source`** per **`POST-SOURCE.md`** — header `x-wallet-address: {linked}`, `x-client: agent` |
| 5 | Confirm post + paste `links.communityPage` URL on its own line — **STOP** |

---

## Flow E — React

| Step | Action |
|------|--------|
| 1 | Parse postId + token + emoji (👍 ❤️ 🔥) |
| 2 | Holder check (Flow D step 2–3) |
| 3 | `POST {SITE}/api/posts/{postId}/react` `{ tokenAddress, reaction }` |
| 4 | Confirm — **STOP** |

---

## Flow F — List / search

| Step | Action |
|------|--------|
| 1 | `GET {SITE}/api/communities` or `GET /api/tokens/search?q=` |
| 2 | Format as short list with symbols + member counts — **STOP** |

---

## Flow G — Update profile / social links (beneficiary only)

| Step | Action |
|------|--------|
| 1 | `GET /api/holders/{token}?wallet={linked}` → if `!canEditProfile` → **STOP** |
| 2 | `GET /api/communities/{token}` → current `description` + `socialLinks` |
| 3 | Merge user fields → `PATCH /api/communities/{token}` `{ description?, socialLinks? }` |
| 4 | Confirm changes + `communityLink` — **STOP** |

Full examples: **`BENEFICIARY-ACTIONS.md`**

---

## Flow H — Pin / unpin post (verified beneficiary only)

| Step | Action |
|------|--------|
| 1 | `GET /api/holders/{token}?wallet={linked}` → if `!canPinPosts` → **STOP** |
| 2 | Resolve `postId` from message or latest post |
| 3 | `POST /api/communities/{token}/pin-post` `{ postId, action: "pin"|"unpin" }` |
| 4 | Confirm + `communityLink` — **STOP** |

---

## Flow I — Post then pin (combined)

| Step | Action |
|------|--------|
| 1 | Flow D steps 1–4 (post) → save `postId` |
| 2 | If user said pin/pin it → Flow H on that `postId` if `canPinPosts` |
| 3 | Reply with post confirmation + pinned note + URL — **STOP** |

---

## Self-check

1. Did you call briefing API before answering "latest"? → **YES**
2. Did you check holder before post? → **YES**
3. Did you use linked wallet header for writes? → **YES**
4. Is tweet pipeline same as DM? → **YES**
