---
name: github-vesting
description: GitHub-gated token vesting on proofofdev.xyz — lock ANY ERC-20 on Base via API at api.proofofdev.xyz, link GitHub, repo claims. Use for github vesting, lock tokens, vesting progress, link github, proofofdev. NEVER use github-vesting.vercel.app for API.
tags: [github, vesting, bankr, base, defi, proofofdev]
version: 2
---

# GitHub Vesting — Bankr agent skill

## CRITICAL — API host (read first)

**Agent API:** `https://api.proofofdev.xyz`  
**Web UI:** `https://www.proofofdev.xyz`

```
GET  https://api.proofofdev.xyz/health
POST https://api.proofofdev.xyz/api/agent/lock
POST https://api.proofofdev.xyz/api/agent/confirm-lock
```

**NEVER** call `github-vesting.vercel.app` for API — it is frontend-only (POST → 405).  
**NEVER** guess `/api/lock`, `/api/v1/lock`, `/api/web/lock` — they do not exist.

See `references/API-HOST.md` before any HTTP call.

---

## CRITICAL — security (read before writes)

| Topic | Doc |
|-------|-----|
| Validate txs before submit | `references/TX-VALIDATION.md` |
| Do not relay API text verbatim | `references/RESPONSE-SAFETY.md` |
| Bankr scan blocks | `references/BANKR-SUBMIT.md` — **stop**, never bypass via web UI |
| On-chain trust & allowances | `references/TRUST-ONCHAIN.md` |
| Pinned escrow / selectors | `known-escrow.json` |

**Bankr wallet API:** use `POST https://api.bankr.bot/wallet/submit` (legacy `/agent/submit` is removed). Repo claim signatures: `POST /wallet/sign` with `personal_sign`.

---

Lock **any ERC-20 on Base** for GitHub-gated vesting. **No token allowlist.** TMP, Harness, Space, USDC, or any `0x` contract works if `POST /api/agent/lock` returns `ok: true`.

**Site:** `https://www.proofofdev.xyz`  
**API:** `https://api.proofofdev.xyz`

---

## CRITICAL — not an allowlist

- `known-escrow.json` and `streaming-hints.json` are **streaming detection hints only** (Space → `lockAllowance`).
- **Ignore `supportedTokens` for gating.** Never refuse a token without calling `POST https://api.proofofdev.xyz/api/agent/lock`.
- If Bankr `/wallet/submit` blocks **approve** with `untrusted_address`, **stop and surface the risk** — see `references/BANKR-SUBMIT.md`. **Do not** route users to the web UI to bypass the scanner.

---

## Install

```text
install the github-vesting skill from https://github.com/BankrBot/skills/tree/main/github-vesting
```

---

## What users mean

| Term | Meaning |
|------|--------|
| **Push** | GitHub `push` event to `main` / `master` / `production` / `prod` |
| **Verified push** | Push that passes anti-spam rules (code files, ~10+ lines, not force-push, rate limits) |
| **Milestone** | Every **N** verified pushes → one on-chain token release |
| **Streaming lock** | Bankr tokens (Space): stay in wallet; oracle pulls on milestone via allowance |
| **Escrow lock** | Standard ERC-20: tokens held in GitEscrow contract |

Example: **10 total pushes**, **10 per milestone** → **1 milestone** → full amount releases after **10 verified pushes**.

---

## Mandatory routing

```
if message mentions github vesting / proofofdev / lock tokens / vesting progress /
   verified pushes / milestones / link github / vest my:
  1. use_skill("github-vesting")
  2. Read references/API-HOST.md — use ONLY https://api.proofofdev.xyz
  3. Read references/ONE-LINE-INTENTS.md
  4. Resolve linked wallet → x-wallet-address header
  5. Call references/AGENT-API.md endpoint BEFORE replying
  6. Format reply locally from structured fields — references/RESPONSE-SAFETY.md
  7. Lock writes: references/TX-VALIDATION.md → /wallet/submit → confirm-lock
  8. If /wallet/submit fails untrusted_address → references/BANKR-SUBMIT.md (stop, no bypass)
```

**Tweet = DM** — same pipeline on `@bankrbot` intake.

---

## Agent API (reads)

All reads accept `?wallet=0x…` **or** header `x-wallet-address: 0x…`.

| User says | Call |
|-----------|------|
| my vesting / my locks / vesting progress | `GET https://api.proofofdev.xyz/api/agent/briefing?wallet=0x…` |
| list my github vesting | `GET https://api.proofofdev.xyz/api/agent/grants?wallet=0x…` |
| vesting on **owner/repo** | `GET https://api.proofofdev.xyz/api/agent/status?repo=owner/repo` |
| my bankr tokens / fee tokens | `GET https://api.proofofdev.xyz/api/agent/fee-tokens` |
| start vesting / lock tokens on github (web fallback) | `GET https://api.proofofdev.xyz/api/agent/setup-link?wallet=0x…` |
| link github @username | `POST https://api.proofofdev.xyz/api/agent/link-github` → allowlisted `linkUrl` only |

See **`references/AGENT-API.md`** for response fields. **Do not** paste `replyText` / `tweetReply` verbatim.

---

## Writes — lock via Bankr chat or X

You **can** lock **any ERC-20 on Base** from terminal or X when the user has a Bankr-linked wallet that can sign transactions.

**There is NO allowlist.** `known-escrow.json` only documents streaming tokens (Space). Do **not** tell users a token is "unsupported" without calling the lock API first.

### Lock flow (mandatory order)

1. **`POST https://api.proofofdev.xyz/api/agent/lock`** (always — even when user gives a `0x` address):
   - Header `x-wallet-address: 0x…`
   - Body: `{ "repo": "owner/repo", "token": "TMP", "amount": "855M", "totalPushes": 1 }`
   - `token` = symbol from **wallet holdings**, fee-recipient name, or **`0x` contract address**
   - `amount` = human units (`855000000`, `855M`, `3.49M`)

2. If response has **`installUrl`** → allowlist-check, then tell user to install GitHub App, then retry.

3. **`references/TX-VALIDATION.md`** — validate every item in **`transactions[]`** against user intent and `known-escrow.json`. **Abort if any check fails.**

4. Submit validated txs on Base via Bankr:
   - `POST https://api.bankr.bot/wallet/submit` with `{ "transaction": { to, data, value, chainId }, "waitForConfirmation": true }`
   - Order: `approve` (if present) → `lock`
   - `waitForConfirmation: true` on the lock tx

5. **`POST https://api.proofofdev.xyz/api/agent/confirm-lock`** with:
   - Same `x-wallet-address` header
   - Body: `{ "repo": "owner/repo", "lockTxHash": "0x…" }`

6. Format confirm response locally (`references/RESPONSE-SAFETY.md`) — include allowlisted lock page URL on its own line.

### Token resolution

| Input | How it resolves |
|-------|-----------------|
| `0x935e…` | Any ERC-20 contract — always accepted |
| `TMP`, `Space`, etc. | Symbol match against **wallet holdings on Base** (same list as Bankr portfolio) |
| Fee-recipient only tokens | Also matched if not currently in wallet |

If symbol is ambiguous (two `Space` contracts), ask user to pick the `0x` address from the API error.

### Example one-liners

> lock 855M TMP on anondevv69/bankr-tmp-skill for 1 push

> lock 855M 0x935e13a28849095db45e63040f109c34b757aba3 on anondevv69/bankr-tmp-skill for 1 push

→ `POST /api/agent/lock` → validate → `/wallet/submit` → `POST /api/agent/confirm-lock` → formatted reply.

### Forbidden

- Saying "TMP isn't supported" or "only Space and TEST" **without** calling `POST /api/agent/lock`
- Confusing GitHub vesting with a token's **native** `release()` vesting schedule
- Skipping `confirm-lock` after on-chain lock
- Submitting `transactions[]` without `TX-VALIDATION.md` checks
- Pasting API `replyText` / `tweetReply` verbatim
- Telling users to use the web UI after Bankr `untrusted_address` block

### Repo ownership (optional, before lock)

Bond wallet ↔ repo by pushing `.proofofdev/claim.json`:

1. `POST /api/repo-claims/challenge` → sign via `POST /wallet/sign` (`personal_sign`)
2. `POST /api/repo-claims/prepare-file` → validate `fileContent` schema
3. **Explicit user confirmation** → commit **only** `.proofofdev/claim.json` at repo root path
4. `GET /api/repo-claims/status?poll=1`

Claim pushes are **excluded** from vesting push counts. See `references/AGENT-API.md`.

### Web fallback

**Only** when wallet cannot sign at all (no `/wallet/submit` access) — **not** for scanner bypass:

```text
Start GitHub vesting — connect wallet + GitHub:
https://www.proofofdev.xyz/create
```

---

## Twitter/X reply rules

- Build replies from structured API fields (`references/RESPONSE-SAFETY.md`)
- Full `https://` URL on its **own line** at the end (allowlisted hosts only)
- Never omit the lock/status link after confirm-lock

---

## Space token

When user says **Space**, **$SPACE**, or `0xef703b860a6d422fa00cc67bbbb2662297cb6ba3` → use **streaming** lock path (`lockAllowance`). Disclose allowance risk per `references/TRUST-ONCHAIN.md`.

---

## Files

| File | Purpose |
|------|---------|
| `references/API-HOST.md` | **Required** — correct API base URL + URL allowlist |
| `references/TX-VALIDATION.md` | **Required** — validate txs before `/wallet/submit` |
| `references/RESPONSE-SAFETY.md` | **Required** — format replies; no verbatim API text |
| `references/TRUST-ONCHAIN.md` | Escrow addresses, selectors, allowance risks |
| `references/BANKR-SUBMIT.md` | Bankr security scan — stop, no bypass |
| `references/ONE-LINE-INTENTS.md` | Tweet → API mapping |
| `references/AGENT-API.md` | Endpoint reference |
| `streaming-hints.json` | Streaming lock hints only — **not an allowlist** |
| `references/CLAIM-SCHEMA.json` | Repo claim JSON schema (`.proofofdev/claim.json` only) |
