# DM / terminal — space intents

**Plain language:** see **`ONE-LINE-INTENTS.md`**.

---

## Read intents (no signing)

| User asks | Agent |
|-----------|-------|
| What's new in $TMP space? | briefing API |
| How many members? | briefing → memberCount |
| Show recent posts | GET `/api/communities/{token}` + posts |
| List spaces | GET /api/communities |
| Find token PEPE on Bankr | GET /api/tokens/search |

---

## Write intents (linked wallet)

| User asks | Agent |
|-----------|-------|
| Create space for $X | search → POST `/api/communities/{token}` |
| Verify $X space / community | POST verify (owner) |
| Post "…" in $X space / community | holder check → POST post **with `source`** (POST-SOURCE.md) |
| Start vote / poll on $X space | HOLDER-VOTES.md → POST `/api/communities/{token}/questions` |
| Vote yes / vote on $X poll | GET questions → POST `/api/questions/{id}/vote` |
| React 👍 to post | holder check → POST react |

---

## Portfolio-style questions

| Question | API |
|----------|-----|
| Which communities exist for tokens I launched? | GET communities + filter by ownerWallet |
| Can I post in $TMP? | GET holders?wallet={linked} |
| Is $TMP space verified? | briefing → community.verified |

---

## Multi-skill threads

User may combine TMP + communities in one session:

```text
claim fees for CTO
what's the latest in CTO space?
```

Run TMP skill for claim, then Bankr Space skill for briefing — same linked wallet.
