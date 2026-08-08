# Bankr project sync — fallback when CLI sandbox is down

Use when `@bankrbot` cannot run shell/HTTP tools (sandbox hang, `echo hello` fails).

**Always spell full URLs** — never truncate `https://` links in tweet replies.

---

## Path B — create Bankr project from Space (manual)

**Who:** fee recipient on `$SPACE` (`0xef703b860a6d422fa00cc67bbbb2662297cb6ba3`).

1. **Holder check** (optional preview):
   ```http
   GET https://www.bankr.space/api/holders/0xef703b860a6d422fa00cc67bbbb2662297cb6ba3?wallet=0xLINKED
   ```

2. **Get project payload from Space:**
   ```http
   GET https://www.bankr.space/api/agent/bankr-project-payload?symbol=Space
   ```
   Response includes `bankrProfilePayload`.

3. **Post to Bankr** with user's API key (`bk_…` from https://bankr.bot/api-keys — never paste in a tweet):
   ```http
   POST https://api.bankr.bot/agent/profile
   X-API-Key: bk_…
   Content-Type: application/json

   { …bankrProfilePayload from step 2… }
   ```

**Or one-shot** (fee recipient + `bk_…` in DM, not public tweet):
```http
POST https://www.bankr.space/api/agent/bankr-project-payload?symbol=Space
X-API-Key: bk_…
x-wallet-address: 0xLINKED
```

---

## Path A — site auto-sync (easiest manual path)

1. Open https://www.bankr.space/community/0xef703b860a6d422fa00cc67bbbb2662297cb6ba3
2. Edit profile → **Bankr project sync**
3. Paste `bk_…` API key → enable
4. Future Space profile/post edits auto-push to https://bankr.bot/agents

---

## Tweet reply when sandbox is down (format locally)

Use **`references/RESPONSE-SAFETY.md`** templates — full URLs below:

```text
CLI sandbox is down on our side — here's the manual path for $SPACE:

1. Fee recipient check: you're the fee recipient on the Space
2. Payload: GET https://www.bankr.space/api/agent/bankr-project-payload?symbol=Space
3. Create project: POST https://api.bankr.bot/agent/profile with your bk_… key

Or enable auto-sync on site: https://www.bankr.space/community/0xef703b860a6d422fa00cc67bbbb2662297cb6ba3 → Edit profile → Bankr project sync

Space: https://www.bankr.space/community/0xef703b860a6d422fa00cc67bbbb2662297cb6ba3
```

---

## Re-install skill (after sandbox recovers)

```text
install Bankr Space skill at https://github.com/anondevv69/bankr-space/tree/main/skills/bankr-communities
```

Confirm skill version **≥ 1.27.0** and `BANKR-PROJECT-SYNC.md` + `BANKR-PROJECT-FALLBACK.md` are loaded.

See **BANKR-PROJECT-SYNC.md** for Path C (project → Space).
