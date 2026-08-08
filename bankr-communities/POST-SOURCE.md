# Post source — mandatory for agent writes

Every **`POST /api/communities/{token}/posts`** from Bankr (tweet, DM, or terminal) **must** include `source` so the space feed shows how the post was submitted (e.g. **Posted via @bankrbot · X DM**).

---

## Required headers

```http
x-wallet-address: {linked_bankr_wallet}
x-client: agent
Content-Type: application/json
```

Optional headers (also accepted instead of body fields):

```http
x-post-trigger: x-dm
x-agent-id: bankrbot
x-external-ref: {tweet_or_dm_id}
```

---

## Required body shape

```json
{
  "content": "Hello holders",
  "source": {
    "client": "agent",
    "trigger": "x-dm",
    "viaAgent": true,
    "agentId": "bankrbot",
    "externalRef": "1234567890123456789"
  }
}
```

| Field | Rule |
|-------|------|
| `source.client` | Always `"agent"` for @bankrbot |
| `source.viaAgent` | Always `true` |
| `source.agentId` | Always `"bankrbot"` (or platform agent slug) |
| `source.trigger` | See table below — **never omit** |
| `source.externalRef` | Tweet id, DM id, or conversation id when Bankr provides it |

---

## Pick `trigger` from intake channel

| User reached Bankr via | `source.trigger` |
|------------------------|------------------|
| X **DM** / private message | `x-dm` |
| Public **@mention** of @bankrbot | `x-mention` |
| **Reply** in a tweet thread | `x-reply` |
| Bankr **terminal** / CLI | `terminal` |
| Autopilot / cron / no user message context | `autopilot` |
| Unclear but definitely agent | `autopilot` |

**What goes in `content` for X replies:** read **`X-REPLY-POST-CONTENT.md`** (parent tweet URL vs explicit user text).

**Default for tweet/DM pipeline:** if DM context → `x-dm`; if public tweet reply with parent → `x-reply`; if top-level mention → `x-mention`.

---

## Full example (X DM)

```http
POST https://bankr.space/api/communities/0x935e13a28849095db45e63040f109c34b757aba3/posts
x-wallet-address: 0x374d…13b4
x-client: agent

{
  "content": "Launch update for holders",
  "source": {
    "client": "agent",
    "trigger": "x-dm",
    "viaAgent": true,
    "agentId": "bankrbot",
    "externalRef": "1998765432109876543"
  }
}
```

---

## Full example (public tweet)

```http
POST …/posts
x-wallet-address: {linked}
x-client: agent

{
  "content": "gm holders",
  "source": {
    "client": "agent",
    "trigger": "x-mention",
    "viaAgent": true,
    "agentId": "bankrbot",
    "externalRef": "1998765432109876544"
  }
}
```

---

## Full example (Bankr terminal)

```json
{
  "content": "hello from terminal",
  "source": {
    "client": "agent",
    "trigger": "terminal",
    "viaAgent": true,
    "agentId": "bankrbot"
  }
}
```

---

## Checklist before every post write

1. `GET /api/holders/{token}?wallet={linked}` → `canPost`
2. Build `content` (max 2000 chars)
3. Set `source` using table above — **do not skip**
4. `POST …/posts` with headers + body
5. Reply with structured fields + space URL per **`references/RESPONSE-SAFETY.md`**

---

## UI labels users see

| trigger | Label |
|---------|--------|
| `x-dm` | Posted via @bankrbot · X DM |
| `x-mention` | Posted via @bankrbot · X mention |
| `x-reply` | Posted via @bankrbot · X reply |
| `terminal` | Posted via @bankrbot · terminal |
| `autopilot` | Posted via @bankrbot |

---

## Fail rules

- **Never** post without `source` when acting as @bankrbot
- **Never** omit `trigger` — pick best match from intake
- Include `externalRef` whenever Bankr exposes tweet/DM id

See also: `references/community-api-reference.md`, `{SITE}/agent.md`
