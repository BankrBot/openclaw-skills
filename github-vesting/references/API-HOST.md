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

If POST is not `200` with JSON `ok`, **stop** — do not try other URLs. Return the error or web fallback.

## Web fallback (always valid)

`https://www.proofofdev.xyz/create`
