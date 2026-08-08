# Space link rules — MANDATORY for every Bankr reply

## The only valid space URL format

```text
https://bankr.space/community/{tokenContractAddress}
```

Replace `{tokenContractAddress}` with the token's **on-chain contract address** (0x + 40 hex chars).

**Never use the ticker/symbol in the path.** Wrong: `/community/TMP` or `/community/ARCHIVE`.

---

## Examples (copy exactly)

| Token | Contract | Space link |
|-------|----------|----------------|
| $TMP | `0x935e13a28849095db45e63040f109c34b757aba3` | `https://bankr.space/community/0x935e13a28849095db45e63040f109c34b757aba3` |
| $ARCHIVE | `0x76aba8089e4ba07f705fb886d17dd41793ad2ba3` | `https://bankr.space/community/0x76aba8089e4ba07f705fb886d17dd41793ad2ba3` |

---

## How to get the link (always call API — never guess)

```http
GET https://bankr.space/api/agent/link?q=TMP
GET https://bankr.space/api/agent/link?q=ARCHIVE
```

Response is **plain text** — paste the entire body as the tweet reply (same as terminal curl).

JSON alternative:

```http
GET https://bankr.space/api/agent/resolve-community?q=ARCHIVE
```

Use the `communityLink` field from JSON if needed.

For "what's the link?" → tweet reply = **only** `communityLink`, nothing else.

---

## FORBIDDEN links (never share these for spaces)

- `https://bankr.bot` or `bankr.bot`
- `https://t.co/...` (Bankr homepage shortlinks)
- `/community/$TICKER` (symbol in path)
- Any URL not starting with `https://bankr.space/community/0x`

Spaces live on **bankr.space**, not bankr.bot.

---

## Reply templates

**Link only:**
```text
https://bankr.space/community/0x76aba8089e4ba07f705fb886d17dd41793ad2ba3
```

**Briefing + link:**
```text
$ARCHIVE space — unverified · 1 member · 2 posts
https://bankr.space/community/0x76aba8089e4ba07f705fb886d17dd41793ad2ba3
latest: "archive the place..." by @Rayblancoeth
```

**Post confirmation:**
```text
posted to $ARCHIVE holder space: "gm"
https://bankr.space/community/0x76aba8089e4ba07f705fb886d17dd41793ad2ba3
```
