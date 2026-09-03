# Agent routing — Bankr Space

> Load with skill install. Overrides generic "I don't know about spaces" replies.

**First:** Read **`NOT-TWITTER-X-SPACES.md`** — "post in $TICKER space" is **bankr.space**, not Twitter audio Spaces.

## TRIGGER

**Link (highest priority):** link, URL, "where is the space" → **`INSTANT-LINK-REPLIES.md`** first (TMP/ARCHIVE need no HTTP).

**Writes (same routing as post-in-space):** verify, post, pin, update profile, add links, **enable/start/turn on fundraiser** → **`BENEFICIARY-ACTIONS.md`**.

**POIDH bounties (create / list / fund / claim):** → **`POIDH-BOUNTY-ACTIONS.md`** — create `POST …/request`, list `GET …/poidh`, fund/claim reply with bounty **`url`** (poidh.xyz). Never ask recipient 0x.

**Other reads:** space (user may say community), members, posts, latest on $TICKER space, start space.

**Load:** `bankr-communities` → **`INSTANT-LINK-REPLIES.md`** (links) or **`ONE-LINE-INTENTS.md`** (everything else).

---

## ROUTING GUARD

```
if message matches link intent:
  1. use_skill("bankr-communities")
  2. TMP or ARCHIVE mentioned → paste instant URL from INSTANT-LINK-REPLIES.md → STOP
  3. Other ticker → GET /api/agent/link?q=… → paste body
  4. NEVER "I wasn't able to generate a response"

if message matches other space intent:
  1. use_skill("bankr-communities")
  2. GET /api/agent/briefing or specific endpoint
  3. Include communityLink (NEVER bankr.bot)
```

---

## Hard rules

1. **Link for TMP/ARCHIVE** — instant paste, no tool call required.
2. **Never** skip API call for stats/posts/members (non-link intents).
3. **Never** require `use_skill` in user tweet text.
4. **Never** link `bankr.bot` or `t.co` for communities.
5. **Tweet = DM** — same skill load order.

---

## TMP coexistence

| Intent | Route to |
|--------|----------|
| claim fees, list, buy, launch | TMP skills |
| space social | **this skill** |
