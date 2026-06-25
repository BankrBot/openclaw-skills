# Agent API reference

**Production API base (required):** `https://api.proofofdev.xyz`  
**Web UI:** `https://www.proofofdev.xyz`  
**Do NOT use** `github-vesting.vercel.app` for POST — returns 405.

Base URL: `{API}` = `https://api.proofofdev.xyz` (or `http://localhost:3000` for local dev).

Site URLs in agent responses use `{VESTING_SITE_URL}` (e.g. `https://www.proofofdev.xyz`):

| Link | Path |
|------|------|
| Create lock | `/create` |
| Explore | `/` |
| Lock status | `/lock/{owner}/{repo}` |
| Dev profile | `/dev/{username}` |

## Authentication

Public read endpoints. Pass the user's linked wallet:

- Query: `?wallet=0x…`
- Header: `x-wallet-address: 0x…` (preferred for agents)

Optional: `x-client: agent`

---

## GET /api/agent/briefing

Summary of all vesting locks for a wallet. **Primary endpoint for @bankrbot.**

```http
GET {API}/api/agent/briefing?wallet=0x…
x-wallet-address: 0x…
x-client: agent
```

**Response (200):**

```json
{
  "ok": true,
  "wallet": "0x…",
  "grantCount": 1,
  "grants": [{ "repoFullName": "owner/repo", "status": "active", "progress": { … } }],
  "replyText": "GitHub vesting — 1 lock\n\nowner/repo — active …\n\nhttps://…/lock/owner/repo",
  "tweetReply": "…same as replyText…",
  "links": { "setup": "…/create", "dashboard": "…/", "primaryStatus": "…/lock/owner/repo" }
}
```

**Tweet:** paste `tweetReply` verbatim.

---

## GET /api/agent/grants

Detailed grant list (same wallet resolution as briefing).

```http
GET {API}/api/agent/grants?wallet=0x…
```

Returns `grants[]` with `progress`, `recentPushes`, formatted token amounts, URLs.

---

## GET /api/agent/status

Progress for a single repo.

```http
GET {API}/api/agent/status?repo=owner/repo
```

**Response:** `grant`, `progress`, `recentPushes`, `replyText`, `tweetReply`, `links.status` (lock page URL).

---

## GET /api/agent/setup-link

Link to start a new vesting lock (web wizard fallback).

```http
GET {API}/api/agent/setup-link?wallet=0x…
```

**Response:** `setupUrl`, `dashboardUrl`, `tweetReply`, `steps[]`.

---

## GET /api/agent/fee-tokens

Tokens the wallet can lock on Base — **wallet holdings** (same idea as Bankr portfolio) plus fee-recipient tokens.

```http
GET {API}/api/agent/fee-tokens
x-wallet-address: 0x…
```

**Response:** `tokens[]`, `walletHoldings[]`, `replyText`, `tweetReply`.

**Any ERC-20 on Base works** — pass a `0x` address to `POST /api/agent/lock` even if not listed here.

---

## POST /api/agent/lock

Prepare lock transactions + Bankr execution instructions (one-shot).

```http
POST {API}/api/agent/lock
Content-Type: application/json
x-wallet-address: 0x…

{
  "repo": "owner/repo",
  "token": "Space",
  "amount": "3.49M",
  "totalPushes": 10,
  "pushesPerMilestone": 10
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `repo` | yes | `owner/name` on GitHub |
| `token` | yes | Symbol from wallet (`TMP`, `Space`), or any `0x` ERC-20 on Base |
| `amount` | yes | Human units: `3490000`, `3.49M`, `1.5K` |
| `totalPushes` | no | Default `10` |
| `pushesPerMilestone` | no | Default = `totalPushes` (single release) |

**Response (200):**

```json
{
  "ok": true,
  "transactions": [
    { "step": "approve", "to": "0x…", "data": "0x…", "value": "0x0", "chainId": 8453 },
    { "step": "lock", "to": "0x76dd…", "data": "0x…", "value": "0x0", "chainId": 8453 }
  ],
  "bankrSubmitUrl": "https://api.bankr.bot/agent/submit",
  "confirmUrl": "https://api.proofofdev.xyz/api/agent/confirm-lock",
  "statusUrl": "https://www.proofofdev.xyz/lock/owner/repo",
  "tweetReply": "…",
  "steps": ["Submit each transaction…", "POST confirm-lock…"]
}
```

**Response (400, GitHub App missing):** `installUrl`, `tweetReply` with install link.

---

## POST /api/agent/prepare-lock

Same as `/api/agent/lock` without the extra `steps` wrapper. Use when you already know the Bankr submit flow.

---

## POST /api/agent/confirm-lock

Register the grant after the lock transaction confirms on Base.

```http
POST {API}/api/agent/confirm-lock
Content-Type: application/json
x-wallet-address: 0x…

{
  "repo": "owner/repo",
  "lockTxHash": "0x…"
}
```

Parses the `Locked` event from the tx, verifies recipient matches wallet, registers push tracking.

**Response:** `grant`, `statusUrl`, `tweetReply` (paste verbatim on X).

---

## Bankr wallet submit (after prepare/lock)

For each transaction in `transactions[]`, in order:

```http
POST https://api.bankr.bot/agent/submit
```

Use fields `to`, `data`, `value`, `chainId` from the prepare response. Set `waitForConfirmation: true` on the final lock tx.

Then call `confirm-lock` with the lock transaction hash.

---

## POST /api/agent/link-github

Create a one-time magic link to bind the Bankr wallet to a GitHub dev profile.

```http
POST {API}/api/agent/link-github
Content-Type: application/json
x-wallet-address: 0x…

{ "githubLogin": "anondevv69" }
```

**Response (200):**

```json
{
  "ok": true,
  "wallet": "0x…",
  "githubLogin": "anondevv69",
  "linkUrl": "https://www.proofofdev.xyz/link-github?t=…",
  "profileUrl": "https://www.proofofdev.xyz/dev/anondevv69",
  "expiresAt": "2026-06-24T…",
  "replyText": "Link GitHub @anondevv69…",
  "tweetReply": "…"
}
```

Paste `linkUrl` in DM only (expires in 15 minutes). User opens link → GitHub OAuth as that username → wallet appears on dev profile.

## GET /api/link-github/inspect

Landing page validation (not for agents — used by `/link-github` UI).

```http
GET {API}/api/link-github/inspect?t=…
```

---

## POST /api/repo-claims/challenge

Start repo ownership verification (wallet ↔ repo bond).

```http
POST {API}/api/repo-claims/challenge
x-wallet-address: 0x…

{ "repo": "owner/repo" }
```

Returns `signMessage`, `claimId`, `filePath`, `fileTemplate`.

## POST /api/repo-claims/prepare-file

After wallet signs `signMessage`:

```http
POST {API}/api/repo-claims/prepare-file

{ "claimId": "clm_…", "signature": "0x…" }
```

Returns `fileContent` to commit at `.proofofdev/claim.json` on `main`. Push via git or Bankr agent — **does not count as a vesting push**.

## GET /api/repo-claims/status

```http
GET {API}/api/repo-claims/status?repo=owner/repo&wallet=0x…&poll=1
```

Returns `verified`, `claim`, `tweetReply`.

---

## Web (non-agent) endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/vesting/register` | Activate after on-chain lock |
| GET | `/api/vesting/status?repo=owner/repo` | Grant progress (legacy JSON) |
| GET | `/api/vesting/lock/:owner/:repoName` | Lock page payload (status + token + pushes) |
| GET | `/api/vesting/search?q=…` | Unified search (dev / repo / token) |
| GET | `/api/vesting/recent-pushes` | Last 10 verified pushes (explore feed) |
| GET/PATCH | `/api/vesting/dev-profile/:login` | Dev profile fields |
| GET | `/api/github/repo?repo=owner/repo` | Repo validation (create flow) |
| GET | `/api/vesting/grants?recipient=0x…` | Wallet grants (JSON) |
| POST | `/api/webhook/github` | GitHub App push webhooks |

---

## Health

```http
GET {API}/health
```

Returns `{ "ok": true, "service": "github-vesting" }`.
