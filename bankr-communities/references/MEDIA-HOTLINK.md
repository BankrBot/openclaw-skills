# Media hotlink — banner / icon from X (`pbs.twimg.com`)

Profile images may hotlink Twitter CDN URLs — **no IPFS re-upload** for X-sourced media.

---

## Allowed hosts (strict)

Only accept banner/icon URLs from:

| Source | Allowed |
|--------|---------|
| `GET /api/oembed/tweet/media` → `suggested.banner` / `suggested.icon` | Host **`pbs.twimg.com`** only |
| User-pasted URL | **`https://pbs.twimg.com/media/…`** only |
| **`customBannerUrl` / `customIconUrl`** | **Reject** unless host is `pbs.twimg.com` |

**Do not** accept arbitrary HTTPS URLs, IPFS, or other CDNs for X-sourced profile media in agent flows.

---

## Validation before PATCH

1. Resolve via **`/api/oembed/tweet/media?url={status_url}`** when using `tweetBannerFrom` / `tweetIconFrom`
2. Confirm returned media host is `pbs.twimg.com`
3. Prefer **`tweetBannerFrom` / `tweetIconFrom`** (status URL) over raw CDN paste
4. **Warn user:** hotlink depends on Twitter CDN availability; image may break if tweet is deleted; third-party tracking may apply

---

## User confirmation

Before PATCH:

- Show **preview description** (tweet author + which image index)
- User must have **explicitly requested** banner/icon change
- Fee recipient / `canEditProfile` required

---

## Forbidden

- `POST /api/upload/banner` for X-sourced images unless user explicitly asks for IPFS pin
- Accepting `customBannerUrl` from API response strings without allowlist check

See **`X-TWEET-IMAGE-PROFILE.md`** for command patterns.
