# Bankr API keys (`bk_…`) — secure handling

## Never in public tweets

- **Never** ask the user to paste `bk_…` in a reply to @bankrbot on X.
- **Never** echo, log, store in scratchpad, or repeat a user's API key in any channel.
- **Never** commit keys to git or include in skill files.

---

## Path A — site one-time setup (recommended)

Fee recipient pastes `bk_…` once on **bankr.space** → Edit profile → Bankr project sync.

Key is stored **server-side only** on bankr.space — not in the skill, not in agent memory. Ongoing sync does not require the agent to handle the key.

---

## Path B — agent create/sync (X or terminal)

`POST https://www.bankr.space/api/agent/bankr-project-payload` with:

```
X-API-Key: bk_…
x-wallet-address: 0xFEE_RECIPIENT
```

**Required before any Bankr profile write:**

1. **Explicit user confirmation** in this session: "create/update Bankr project from $SYMBOL space"
2. Key provided via **DM**, Bankr secure channel, or platform-linked account — **not** a public tweet
3. **Agent API access** enabled on the key (`bankr.bot/api-keys`)
4. Fee recipient check passes
5. **Key scope:** profile write only — do not use the key for unrelated Bankr actions

**Agent must not:**

- Persist the key across sessions
- Log the key in tool output
- Call `api.bankr.bot/agent/profile` except for the confirmed sync action

---

## Path C — project → Space

Optional `X-API-Key` for unapproved owner profiles. Same DM-only and confirmation rules.

---

## Read-only (no key)

```
GET https://api.bankr.bot/agent-profiles/{tokenAddress}
GET https://api.bankr.bot/agent-profiles/{tokenAddress}/tweets
```

---

## On failure

Stop and surface the error. Do not bypass Bankr security or ask for keys in public threads.
