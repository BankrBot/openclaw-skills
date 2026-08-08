# GET link — run exactly like terminal curl

> **Highest priority.** User asks for a space **link** (may say community), **URL**, or **where is** $TICKER space (or community).

## Do this (3 steps)

```
1. Extract ticker from user message (strip $ and "community" words)
   Example: "what's the link to the TMP space?" → TMP

2. HTTP GET (same as terminal curl):
   https://bankr.space/api/agent/link?q=TMP

   Bankr terminal equivalent:
   curl "https://bankr.space/api/agent/link?q=TMP"

   Bankr script equivalent:
   const body = await http.fetch('https://bankr.space/api/agent/link?q=TMP');

3. Tweet reply = allowlisted URL only (from `communityLink` or link API body). One line. Format per **`references/RESPONSE-SAFETY.md`**.
```

**The API returns plain text — not JSON.** The entire response body is what you paste in the tweet.

---

## Examples

| User says | GET URL | Tweet reply (response body) |
|-----------|---------|----------------------------|
| link to **TMP** space | `.../api/agent/link?q=TMP` | `https://bankr.space/community/0x935e13a28849095db45e63040f109c34b757aba3` |
| link to **ARCHIVE** | `.../api/agent/link?q=ARCHIVE` | `https://bankr.space/community/0x76aba8089e4ba07f705fb886d17dd41793ad2ba3` |
| token exists, no space yet | `.../api/agent/link?q=FOO` | `No $FOO space yet — TokenName is on Bankr. Would you like me to create the space?` |

Replace `TMP` with whatever ticker/name/address the user asked for.

---

## If HTTP GET fails — use fallback (never fail silently)

Read `known-communities.json`. Never reply "I wasn't able to generate a response."

| Symbol | communityLink |
|--------|---------------|
| TMP | `https://bankr.space/community/0x935e13a28849095db45e63040f109c34b757aba3` |
| ARCHIVE | `https://bankr.space/community/0x76aba8089e4ba07f705fb886d17dd41793ad2ba3` |

---

## JSON alternative (if you need fields)

```http
GET https://bankr.space/api/agent/resolve-community?q=TMP
```

Use field `communityLink` from JSON after allowlist check (`known-hosts.json`).

Plain text is preferred: `GET .../api/agent/link?q=TMP`

---

## FORBIDDEN

- `bankr.bot`, `t.co`, `/community/TMP` (symbol in path)
- Empty reply or "I wasn't able to generate a response"
- FAQ when user only asked for a link
- Inventing URLs without GET or known-communities fallback
