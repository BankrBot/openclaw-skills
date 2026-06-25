# One-line intents → agent API

Replace `{API}` with your deployed backend URL (`VESTING_API_URL` / `SERVER_URL`).

Linked Bankr wallet → header `x-wallet-address: 0x…` on every call.

| User says | Agent does |
|-----------|------------|
| **my vesting progress** | `GET {API}/api/agent/briefing?wallet=0x…` → paste `tweetReply` |
| **how many pushes until release?** | briefing or `GET {API}/api/agent/status?repo=owner/repo` |
| **list my github locks** | `GET {API}/api/agent/grants?wallet=0x…` |
| **my bankr tokens / fee tokens / what can I lock** | `GET {API}/api/agent/fee-tokens` → wallet holdings on Base |
| **verify repo owner/repo** | `POST /api/repo-claims/challenge` → sign → `prepare-file` → push `.proofofdev/claim.json` |
| **check repo claim** | `GET /api/repo-claims/status?repo=owner/repo&poll=1` |
| **lock 855M 0x935e… on owner/repo** | `POST {API}/api/agent/lock` with `token` = contract address |
| **vest Space on my repo** | Lock flow if wallet can sign; else `setup-link` → `/create` |
| **link github @username** | `POST {API}/api/agent/link-github` → paste `linkUrl` (DM only, 15 min) |
| **start github vesting** (web) | `GET {API}/api/agent/setup-link?wallet=0x…` → paste `{VESTING_SITE_URL}/create` |
| **vesting on anondevv69/github-vesting** | `GET {API}/api/agent/status?repo=anondevv69/github-vesting` |
| **what is a milestone?** | Explain: every N verified pushes → token release (no API) |

## Lock flow (terminal + X)

```
1. POST {API}/api/agent/lock
   Header: x-wallet-address: 0x…
   Body: { "repo": "owner/repo", "token": "Space", "amount": "3.49M", "totalPushes": 10 }

2. If installUrl in response → send user to install GitHub App, retry step 1

3. For each tx in transactions[] (approve then lock):
   POST https://api.bankr.bot/agent/submit
   { "to": "…", "data": "0x…", "value": "0x0", "chainId": 8453, "waitForConfirmation": true }

4. POST {API}/api/agent/confirm-lock
   Body: { "repo": "owner/repo", "lockTxHash": "0x…" }

5. Paste tweetReply from step 4 verbatim
```

**Recurring schedule:** add `"pushesPerMilestone": 2` (e.g. 10 pushes, release every 2).

## Repo claim flow (wallet ↔ repo bond)

```
1. POST /api/repo-claims/challenge  { "repo": "owner/repo" }  + x-wallet-address
2. Sign signMessage with wallet (personal_sign or Bankr agent/sign)
3. POST /api/repo-claims/prepare-file  { "claimId", "signature" }
4. Push fileContent to .proofofdev/claim.json on main (agent can commit + push)
5. GET /api/repo-claims/status?repo=owner/repo&poll=1
```

Claim pushes **do not** count toward vesting milestones. Then proceed with lock flow.

## Link GitHub to Bankr wallet (magic link)

```
1. POST {API}/api/agent/link-github
   Header: x-wallet-address: 0x…
   Body: { "githubLogin": "anondevv69" }

2. Paste linkUrl from response verbatim (DM only — expires in 15 min)

3. User opens link → Continue with GitHub → must sign in as that @username

4. Profile shows linked wallet: {VESTING_SITE_URL}/dev/anondevv69
```

**Security:** one-time token, GitHub login must match. Never share the link publicly.

## Forbidden replies

- "TMP isn't supported" / "only Space and TEST" **without** calling `POST /api/agent/lock` first
- Confusing GitHub vesting with a token contract's native `release()` vesting
- "I can't lock tokens for you" **without** trying the lock API or returning the setup link
- Empty reply when briefing returns `tweetReply`
- Paraphrasing stats **without** the lock/create URL on its own line
- Skipping `confirm-lock` after on-chain lock (grant won't track pushes)

## Example curl

```bash
curl -H "x-wallet-address: 0xbff8c6c34f1efacf6844350de907cca6f07c76b8" \
  "https://api.proofofdev.xyz/api/agent/briefing"
```

```bash
curl -X POST -H "Content-Type: application/json" \
  -H "x-wallet-address: 0xbff8c6c34f1efacf6844350de907cca6f07c76b8" \
  -d '{"repo":"owner/repo","token":"Space","amount":"3.49M","totalPushes":10}' \
  "https://api.proofofdev.xyz/api/agent/lock"
```

```bash
curl -X POST -H "Content-Type: application/json" \
  -H "x-wallet-address: 0xbff8c6c34f1efacf6844350de907cca6f07c76b8" \
  -d '{"githubLogin":"anondevv69"}' \
  "https://api.proofofdev.xyz/api/agent/link-github"
```

```bash
curl -X POST -H "Content-Type: application/json" \
  -H "x-wallet-address: 0xbff8c6c34f1efacf6844350de907cca6f07c76b8" \
  -d '{"repo":"owner/repo","lockTxHash":"0x…"}' \
  "https://api.proofofdev.xyz/api/agent/confirm-lock"
```
