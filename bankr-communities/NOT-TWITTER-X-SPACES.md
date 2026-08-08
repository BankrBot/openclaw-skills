# NOT Twitter/X audio Spaces — Bankr Space only

**Read this when user says "post in $TICKER space" on X.**

---

## What "space" means here

| User says | Means | You do |
|-----------|-------|--------|
| post in **$PMFI space** | **Bankr Space** on `bankr.space` — token-gated holder feed | `use_skill("bankr-communities")` → `POST …/api/communities/{token}/posts` |
| post **this** in $TICKER space (X reply) | Same — content = parent tweet URL | **X-REPLY-POST-CONTENT.md** Mode A |
| "X Spaces" / "Twitter Spaces" / audio room | **Different product** — not this skill | Only if user explicitly asks about Twitter audio |

**Bankr Space ≠ Twitter/X audio Spaces.** Users say "space" for **bankr.space/community/0x…** — never refuse as "can't post to X spaces."

---

## Forbidden replies (never say these)

When user mentions `$TICKER space`, `post in … space`, `post this in … space`, or `community`:

- ❌ "I don't have the ability to post to **X spaces** or communities directly"
- ❌ "I can only reply within this thread"
- ❌ "You'll need to post it manually from your account"
- ❌ "I can't access communities"
- ❌ Confusing **bankr.space** with **Twitter Spaces** (audio)

**Correct:** load skill → resolve ticker (`GET /api/agent/link?q=PMFI`) → holder check → post via API → reply with confirmation + `https://bankr.space/community/0x…`

---

## Example (production failure → correct behavior)

**User** (replying to a tweet):

```text
@bankrbot post this in $pmfi space
```

**Wrong:** refuse as Twitter/X Spaces limitation.

**Right:**

1. `use_skill("bankr-communities")`
2. Resolve PMFI → `0xd77ce6d3137342bb5174673bdab5f51db16fcba3`
3. Parent tweet URL → `content` (Mode A — **X-REPLY-POST-CONTENT.md**)
4. `POST https://bankr.space/api/communities/0xd77ce6d3137342bb5174673bdab5f51db16fcba3/posts` with `source.trigger: x-reply`
5. Reply:

```text
Posted to $PMFI holder space.

https://bankr.space/community/0xd77ce6d3137342bb5174673bdab5f51db16fcba3
```

---

## Trigger phrases (always → this skill)

`post in`, `post this`, `share this`, `put that`, `comment in`, `verify`, `pin`, `latest on`, `members in`, `link to`, `space for`, `community for` + ticker or `0x…` address.

See **BANKR-PLATFORM-TWEET-INTAKE.md**, **ONE-LINE-INTENTS.md**, **AGENT-ROUTING-COMMUNITIES.md**.
