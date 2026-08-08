# Instant link replies — NO HTTP, NO TOOLS

> **Tweet intake often cannot run http.fetch.** For known tokens, reply from this table **immediately**. Do not call tools first. Never reply "I wasn't able to generate a response."

## Match user message → paste this line only

| If message mentions | Reply (exactly one line) |
|---------------------|--------------------------|
| **TMP** + link / url / space | `https://bankr.space/community/0x935e13a28849095db45e63040f109c34b757aba3` |
| **ARCHIVE** + link / url / space | `https://bankr.space/community/0x76aba8089e4ba07f705fb886d17dd41793ad2ba3` |
| **PMFI** + link / url / space | `https://bankr.space/community/0xd77ce6d3137342bb5174673bdab5f51db16fcba3` |
| **SPACE** / **Space** token + link / url | `https://bankr.space/community/0xef703b860a6d422fa00cc67bbbb2662297cb6ba3` |

Examples that match TMP row:
- "what's the link to the TMP space?"
- "TMP community url"
- "where is $TMP space"

## Other tickers (HTTP only if instant table miss)

```http
GET https://bankr.space/api/agent/link?q=PEPE
```

Paste response body. If HTTP fails → say token not found or ask to create — **never** empty error.

## Why two paths

| Context | What works |
|---------|------------|
| Bankr **terminal** | `http.fetch` / curl → API works |
| Bankr **tweet** | Skill may not run HTTP → use **instant table** above for TMP/ARCHIVE |

**Terminal and tweet must give the same URL for TMP.**
