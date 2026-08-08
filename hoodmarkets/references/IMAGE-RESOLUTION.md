# Deploy image resolution — validation rules

Token logos for deploy come from `POST /api/agent/resolve-deploy-image`. Agents must validate inputs **before** calling and reject unsafe URLs locally.

## Allowed image hosts

| Host | Source |
|------|--------|
| `pbs.twimg.com` | X/Twitter media (`media_url_https`, syndication, oEmbed) |
| `abs.twimg.com` | X thumbnails |
| `video.twimg.com` | X media variants (photos only — reject video) |

**Reject all other hosts** for `imageUrl`, `tweetImageUrl`, `mediaUrl`, and URLs extracted from `tweetText`.

Do **not** pass arbitrary user-supplied HTTPS URLs (personal sites, IPFS gateways, data URLs) unless the user explicitly attaches a photo on X and it resolves to `pbs.twimg.com`.

## Allowed input types

| Field | Validation |
|-------|------------|
| `tweetId` | Numeric string, 10–25 digits |
| `tweetUrl` | `https://x.com/…/status/…` or `https://twitter.com/…/status/…` only |
| `tweetImageUrl` | HTTPS, host in allowlist above, max 2048 chars |
| `tweet` object | Use only `extended_entities.media` / v2 `includes.media` — `type: photo` only |
| `tweetMedia[]` | Each entry: photo URL on allowlisted host |
| `imageUrl` | **Avoid** — prefer tweet media. If used: allowlisted host only |

## Reject

- `http://` (non-TLS)
- Private IPs, `localhost`, `127.0.0.1`, `169.254.*`, `10.*`, `192.168.*`
- Non-image paths when type is known (`.exe`, `.html`, `.php`)
- URLs longer than 2048 characters
- Video/GIF media types from tweet objects

## Resolution order (API)

1. Explicit `imageUrl` / `tweetImageUrl` / `mediaUrl` / `tweetMedia` / tweet object media
2. Syndication (`cdn.syndication.twimg.com`) when `tweetId` provided
3. oEmbed (`publish.twitter.com`) when `tweetUrl` provided

Agent: **always pass `tweetId` and `tweetImageUrl`** when Bankr provides tweet media — do not skip to arbitrary URLs.

## After resolution

- Use only `imageUrl` from API response (`ok: true`) in deploy body
- Include `imageSource` in mental model for debugging — do not show raw syndication JSON to users
- If `imageRequired: true` after valid tweet id + media were sent, ask user to attach a photo — do not accept a random URL

## SSRF / abuse note

The hood.markets API fetches only known Twitter syndication/oEmbed endpoints server-side. Agents must not ask the API to resolve non-allowlisted image URLs — that reduces SSRF and hotlink abuse risk.
