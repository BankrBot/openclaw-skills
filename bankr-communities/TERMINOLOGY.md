# Terminology — community vs space

**Product name:** Bankr Space (`https://bankr.space`)

## NOT Twitter/X audio Spaces

When users say **"post in $PMFI space"** or **"post this in $TICKER space"**, they mean **Bankr Space** — the token-gated feed at `bankr.space/community/0x…`.

They do **not** mean Twitter/X **audio Spaces** (live rooms). **Never** refuse with "I can't post to X spaces." Load **`bankr-communities`** and call the site API. See **`NOT-TWITTER-X-SPACES.md`**.

## What agents should say

| Context | Word |
|---------|------|
| Replies to users | **space** / **spaces** — e.g. "$TMP space", "holder space", "list all spaces" |
| Product | **Bankr Space** (not "Bankr Communities") |
| Link in prose | **space link** or **space URL** |

## What users may say (same intent)

Users often say **community** or **space** interchangeably. Treat both as the same token-gated discussion area:

- "TMP community" = "TMP space"
- "post in CTO community" = "post in CTO space"
- "verify the community" = "verify the space"

**When replying:** prefer **space** in your wording. Format replies from structured API fields per **`references/RESPONSE-SAFETY.md`** — do not paste `replyText` / `tweetReply` verbatim.

## The **Space** token (ticker) vs generic "space"

| User means | Signal | Token |
|------------|--------|-------|
| **Bankr Space** product / any token space | "post in TMP space", "holder space" | resolve via briefing / search |
| **`Space` / `$SPACE` token** | "vote on **Space**", "TMP space" vs capitalized **Space** alone as ticker | `0xef703b860a6d422fa00cc67bbbb2662297cb6ba3` |

If the user says **"Start a vote on Space:"** with a question — they mean the **$Space** token community, **not** "which space do you mean?". Use `known-communities.json` → `SPACE` or contract `0xef703b…`.

---

## What stays `community` (do not rename)

These are **API / code names** — use exactly as documented:

| Keep as-is | Example |
|------------|---------|
| REST paths | `GET /api/communities`, `POST /api/communities/{token}/posts` |
| Agent routes | `/api/agent/resolve-community`, `/api/agent/search-communities` |
| JSON fields | `community`, `communityLink`, `communityExists`, `suggestCreateCommunity` |
| Skill slug | `bankr-communities` |
| Env var | `COMMUNITIES_SITE_URL` |
| Page URL path | `https://bankr.space/community/0x…` (path is `/community/`; call it a **space link** in prose) |

## Reply templates (from API)

Format replies from structured fields per **`references/RESPONSE-SAFETY.md`**. Format uses **space**:

```text
$TMP space — verified · 12 members · 34 posts
latest: "gm holders" by @user

https://bankr.space/community/0x935e13a28849095db45e63040f109c34b757aba3
```

Always end with `communityLink` (full `https://` URL on its own line).
