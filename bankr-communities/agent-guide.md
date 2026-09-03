# Bankr Space — agent guide

**Human site:** https://bankr.space (Vercel Next.js app in `web/`)

**Live mirror for humans and other bots:** `{YOUR_VERCEL_URL}/agent.md` (same content as `web/content/agent.md`)

When editing, update **`web/content/agent.md`** then redeploy. Keep this file in sync.

**Terminology:** Read **`TERMINOLOGY.md`** — users may say **community** or **space** (same intent); agent replies use **space**; API/JSON keeps `community`, `communityLink`, `/api/communities`.

---

## Golden rules

1. **One sentence → full flow** — no "open the website" if API works.
2. **Briefing first** — `GET /api/agent/briefing` for "latest / members / opportunities".
3. **Post / react gate** — `GET /api/holders/{token}?wallet=` → `canPost` for holders **or** owner.
4. **Owner verify** — only fee recipient / deployer.
5. **Reply with links** — format from `communityLink` per **`references/RESPONSE-SAFETY.md`**; full space URL on its own line.

---

## Intent → API

| User says (community or space) | First call |
|-----------|------------|
| Latest on $TMP | `/api/agent/briefing?symbol=TMP` |
| Member count | briefing → stats.memberCount |
| Post in space / community | holders check → POST posts **with `source`** (POST-SOURCE.md) |
| Verify space / community | POST verify |
| Start holder vote / poll | HOLDER-VOTES.md → POST …/questions |
| Vote on space poll | GET …/questions → POST /api/questions/{id}/vote |
| Create space / community | search → POST `/api/communities/{token}` |
| List all spaces | GET /api/communities |
| Space / community link | `GET /api/agent/link?q=TICKER` or INSTANT-LINK-REPLIES.md for TMP/ARCHIVE |
| Fundraising on a space | `GET /api/communities/{token}/fundraising` or briefing → `fundraising` |

Full table: **`ONE-LINE-INTENTS.md`**

---

## Install with TMP stack

```text
install TMP site agent at https://github.com/anondevv69/bankr-tmp-skill/tree/main/tmp-site-agent
install TMP skills at https://github.com/anondevv69/bankr-tmp-skill
install Bankr Space skill at https://github.com/anondevv69/bankr-space/tree/main/skills/bankr-communities
```

Set `COMMUNITIES_SITE_URL` on Bankr only if overriding the default `https://bankr.space`.

---

## Execution

| File | Purpose |
|------|---------|
| `TERMINOLOGY.md` | **community vs space** — read first |
| `ONE-LINE-INTENTS.md` | Intent → API table |
| `BENEFICIARY-ACTIONS.md` | Verify, profile, pin, post+pin |
| `X-TWEET-IMAGE-PROFILE.md` | Banner/icon from X tweet (hotlink) |
| `BANKR-PROJECT-SYNC.md` | Space ↔ bankr.bot/agents sync |
| `INSTANT-LINK-REPLIES.md` | TMP/ARCHIVE links — no HTTP |
| `FUNDRAISING.md` | Discover fundraisers, guide x402 contributions |
| `community-autopilot.md` | Step-by-step flows |
| `references/AGENT-ROUTING-COMMUNITIES.md` | Routing guard |
| `references/BANKR-PLATFORM-TWEET-INTAKE.md` | Tweet intake |
| `references/community-api-reference.md` | All endpoints |

Public guide (canonical): **`https://bankr.space/agent.md`**
