# Bankr Agent Profile sync (Space ↔ bankr.bot/agents)

Two-way sync between **[Bankr Spaces](https://bankr.space)** and **[Agent Profiles](https://docs.bankr.bot/agent-profiles/overview)** at `bankr.bot/agents`.

| Direction | Path | On X |
|-----------|------|------|
| **Space → Bankr project** | B | ✅ `@bankrbot create/sync project from Space` |
| **Bankr project → Space** | C | ✅ `@bankrbot update Space from my Bankr project` |
| **Site auto-sync** | A | Optional `bk_…` on bankr.space |

Bankr also exposes linked **original tweets** on token pages — Spaces pull these via [`GET /agent-profiles/:id/tweets`](https://docs.bankr.bot/agent-profiles/rest-api#get-agent-profilestweets).

---

## Path A — Space site auto-sync (optional)

Fee recipient: Edit profile → **Bankr project sync** → `bk_…` → enable profile/post sync.  
**One-time setup on site** — after that, profile saves and posts auto-push to Bankr (hourly cron catches drift).  
`PATCH` / `POST` on bankr.space auto-push to Bankr API.

### X (@bankrbot) after site setup

Once the API key is saved on bankr.space, **X updates still sync automatically**:

```text
@bankrbot post in Space space: hello world        → Space post + Bankr project update
@bankrbot update Space space description: …       → PATCH space + Bankr profile sync
```

**Why the one-time `bk_…` step is on the site, not a public tweet:** API keys must never be posted on X. Path B (`create Bankr project from Space`) needs Bankr to hold your key in your linked account — or use site Path A once.

**Why Path B alone failed earlier:** Bankr CLI sandbox was down (platform-side), not bankr.space.

---

## Path B — Space → Bankr project (@bankrbot)

```text
@bankrbot create Bankr project from Space space
@bankrbot sync my Space to bankr.bot agents
```

```
1. GET https://www.bankr.space/api/holders/{token}?wallet={linked} → fee recipient
2. GET https://www.bankr.space/api/agent/bankr-project-payload?symbol=SPACE
3. POST https://www.bankr.space/api/agent/bankr-project-payload?symbol=SPACE
   Headers: X-API-Key: {user_bk_key}, x-wallet-address: {linked}
```

If Bankr CLI sandbox is down → read **`BANKR-PROJECT-FALLBACK.md`** (full URLs + site auto-sync path).

Or call `POST/PUT https://api.bankr.bot/agent/profile` directly with `bankrProfilePayload`.

---

## Path C — Bankr project → Space (@bankrbot) ← NEW

```text
@bankrbot update my Space from my Bankr project
@bankrbot use my Bankr project to update Space space
@bankrbot sync Bankr project to $TMP space
```

```
1. use_skill("bankr-communities")
2. Resolve token
3. GET /api/holders/{token}?wallet={linked} → fee recipient
4. GET /api/agent/space-from-bankr-project?symbol=SPACE
   Optional header X-API-Key (owner profile if unapproved)
   → spacePatch, originalTweet, tweets[]
5. POST /api/agent/space-from-bankr-project?symbol=SPACE
   Headers: X-API-Key: {user_bk_key}, x-wallet-address: {linked}
   Body (optional): { "importOriginalTweetAsPost": true }
6. Format reply from `communityLink`, `bankrProfileUrl` per **`references/RESPONSE-SAFETY.md`**
```

### Profile → Space field mapping

| Bankr project | Space |
|---------------|--------|
| `description` | `description` (`useDexDescription: false`) |
| `website` | `socialLinks.website` |
| `twitterUsername` | `socialLinks.x` |
| `profileImageUrl` | `customIconUrl` (HTTPS hotlink) |

Token **name/symbol** stay from Bankr launch — not overwritten.

`importOriginalTweetAsPost: true` — posts the **oldest** linked tweet (launch tweet) to the Space feed as a tweet card URL.

---

## Original tweets on Space UI

Public: `GET https://api.bankr.bot/agent-profiles/{token}/tweets`  
Spaces show **Original tweet** on the community page (same source as [Bankr discover](https://bankr.bot/terminal/discover/{token})).

bankr.space `GET /api/communities/{token}` includes:

- `bankrProfileTweets[]`
- `bankrOriginalTweet` — oldest tweet by `createdAt`

---

## Two-way workflow examples

**Project first, then Space:**

```text
@bankrbot create Bankr project from CLI/site
@bankrbot update Space space from my Bankr project
```

**Space first, then project:**

```text
@bankrbot set Space space description: …
@bankrbot create Bankr project from Space space
```

**Keep both in sync:**

- Edit Space on X → Path B refresh project  
- Edit project on Bankr → Path C refresh Space  
- Or enable Path A on site for automatic Space → project on every save

---

## API reference (bankr.space)

```http
GET  /api/agent/bankr-project-payload?symbol=SPACE      # Space → project preview
POST /api/agent/bankr-project-payload?symbol=SPACE        # Space → project upsert

GET  /api/agent/space-from-bankr-project?symbol=SPACE     # project → Space preview
POST /api/agent/space-from-bankr-project?symbol=SPACE     # project → Space apply
```

[Bankr Agent Profiles REST API](https://docs.bankr.bot/agent-profiles/rest-api)

---

## Fail rules

- **Never** paste `bk_…` in a tweet.
- Fee recipient only for Path B/C writes.
- Profile token must match Space token.
- Path C does **not** re-push to Bankr (no ping-pong).
- `approved: false` profiles: use `X-API-Key` on GET for owner's unapproved profile.

See also: **BENEFICIARY-ACTIONS.md**, **X-TWEET-IMAGE-PROFILE.md**
