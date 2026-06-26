# API host — read before any HTTP call

## ONLY these hosts

| Role | URL |
|------|-----|
| **Agent API** | `https://api.proofofdev.xyz` |
| **Web / create flow** | `https://www.proofofdev.xyz` |

Preflight: `GET https://api.proofofdev.xyz/health` → JSON `{ "ok": true, "service": "github-vesting" }`

## FORBIDDEN hosts (will fail)

- `github-vesting.vercel.app` — frontend SPA only; **POST returns 405**
- `www.proofofdev.xyz` for API POST — use `api.proofofdev.xyz`
- Guessed paths: `/api/lock`, `/api/v1/lock`, `/api/web/lock` — **do not exist**

## ONLY these lock endpoints

```
POST https://api.proofofdev.xyz/api/agent/lock
POST https://api.proofofdev.xyz/api/agent/confirm-lock
POST https://api.proofofdev.xyz/api/agent/prepare-lock   (alias)
```

If POST is not `200` with JSON `ok`, **stop** — do not try other URLs.

## URL allowlist (links shown to users)

Before displaying **any** URL from an API response (`linkUrl`, `installUrl`, `statusUrl`, `links.*`):

| Type | Rule |
|------|------|
| Magic link | `https://www.proofofdev.xyz/link-github?…` only |
| GitHub App install | Must start with `https://github.com/apps/bankr-vesting/installations/new` |
| Status / profile / create | Host `www.proofofdev.xyz`, paths `/lock/`, `/dev/`, `/create`, or `/` |

If a URL fails the allowlist, **do not show it**. Use hard-coded fallbacks from `known-escrow.json` path templates.

See `references/RESPONSE-SAFETY.md`.

## Web fallback (wallet cannot sign)

Use **only** when the user's Bankr wallet **cannot** call `/wallet/submit` at all (no write API, read-only key, or no signing capability) — **not** when Bankr blocks a high-risk approve:

`https://www.proofofdev.xyz/create`
