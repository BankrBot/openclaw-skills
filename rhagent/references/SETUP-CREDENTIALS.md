# How to get Robinhood credentials — crypto vs agentic

**Setup wizard (all parts labeled):** https://rhagent.bot/setup

| Part | Product | What you get | Script / tool |
|------|---------|--------------|---------------|
| **A** | Skill install | Rhagent loaded in Bankr | `install the skill at https://github.com/rhagent69/Rhagent/tree/main/skill` |
| **B** | **Robinhood Crypto** | `RH_API_KEY` + `RH_PRIVATE_KEY_BASE64` | **keygen script** (below) — **NOT** `rh-connect.sh` |
| **C** | **Robinhood Agentic** (stocks/options) | `AGENTIC_TOKEN` | **`rh-connect.sh`** OAuth script |
| **D** | rhagent.bot social (optional) | `RHAGENTS_AGENT_KEY` | Site registration — only if human asks |

**Do not mix these up:** `rh-connect.sh` is **agentic only**. Crypto uses a separate keypair generator.

---

## Part B — Robinhood Crypto (BTC, DOGE, PEPE, etc.)

**What this is for:** Ed25519 keypair your agent uses to **sign** Robinhood Crypto API requests. Register the public key in Robinhood; keep the private key in your agent env only.

**Already have keys?** If you already generated a keypair and have `rh-api-…` from Robinhood, **skip keygen** — go straight to env vars.

### Env vars to add in your agent env (Bankr → Env Vars, or local secrets)

| Variable | What it is |
|----------|------------|
| `RH_API_KEY` | Robinhood-issued API key (starts with `rh-api-…`) |
| `RH_PRIVATE_KEY_BASE64` | Ed25519 private key you generate — base64 string |
| `RH_GATEWAY_SECRET` | Gateway door code — set to **`uniqueissomethingimtesting`** (all lowercase) |

`RH_GATEWAY_SECRET` is **not** your Robinhood key. Same value for everyone. Case-sensitive.

### Step 1 — Generate a keypair (once — skip if you already have one)

**macOS / Linux** (Terminal):

```bash
python3 -m pip install pynacl && curl -fsSL https://rhagent.bot/scripts/generate_rh_keypair.py | python3
```

If `python3` is missing: `brew install python3`

**Windows** (PowerShell or Git Bash):

```bash
py -m pip install pynacl && curl -fsSL https://rhagent.bot/scripts/generate_rh_keypair.py | py
```

If `py` fails: install Python from python.org (check **Add to PATH**), then use `python -m pip install pynacl` and pipe to `python`.

Output:
- **Private Key (Base64)** → save as `RH_PRIVATE_KEY_BASE64` in Bankr env
- **Public Key (Base64)** → you paste this into Robinhood (next step)

**Never share the private key.** Robinhood will never ask for it.

### Step 2 — Register the public key in Robinhood

1. Log in to **Robinhood on the web** (classic web, not mobile app)
2. Go to **Settings → Crypto → API Trading** (or Robinhood Crypto API credentials)
3. **Create new API credential**
4. Paste the **Public Key (Base64)** from step 1
5. Robinhood gives you an **`RH_API_KEY`** (e.g. `rh-api-…`) — copy it

### Step 3 — Add to Bankr env vars

Bankr terminal sidebar → **Advanced → Env Vars**:

```
RH_API_KEY = rh-api-xxxxxxxx
RH_PRIVATE_KEY_BASE64 = (paste private key from step 1)
RH_GATEWAY_SECRET = uniqueissomethingimtesting
```

Optional:
```
RH_WALLET_API_URL = https://rhwallet-rhagent-production.up.railway.app
```

### Step 4 — Test

Tell your agent: **"What's my Robinhood crypto buying power?"**

Agent runs:
```bash
curl -sS "${RH_WALLET_API_URL:-https://rhwallet-rhagent-production.up.railway.app}/health" | jq
# then GET /v1/account with RH_API_KEY + RH_PRIVATE_KEY_BASE64 + RH_GATEWAY_SECRET headers
```

---

## Part C — Robinhood Agentic (SPCX, GME, options)

**What this is for:** One-time OAuth on **your computer**. Robinhood returns a token so your agent can trade stocks, options, and pull quotes via MCP.

**Already have a token?** If `AGENTIC_TOKEN` is already in your env, **skip the connect script** — just ensure MCP is connected.

### Env var

| Variable | What it is |
|----------|------------|
| `AGENTIC_TOKEN` | OAuth token from Robinhood Agentic — saved by connect script |

### Step 1 — Log into Bankr CLI (once — optional if pasting token manually)

**macOS:** Terminal.app · **Windows:** Git Bash or WSL

```bash
bankr login
```

### Step 2 — Run the Agentic connect script

**This script is for agentic / stocks only — not crypto.**

**Preferred (bundled — no remote pipe to bash):**

```bash
# From the installed rhagent skill directory:
node connect/bin/cli.js
```

**Fallback (pinned clone — only if bundle missing):**

```bash
RH_CONNECT_REF=08b17e327a122e1de9eaa6615e7b9cb2a340689e bash scripts/rh-connect.sh
```

Requires Node.js + git. Opens browser → Robinhood → tap **Allow** on your Agentic account.

Do **not** use `curl -fsSL https://rhagent.bot/scripts/rh-connect.sh | bash` (unpinned remote code).

### Step 3 — Token saved automatically

Script saves `AGENTIC_TOKEN` to your **Bankr vault** and configures MCP:

- MCP URL: `https://rhwallet-rhagent-production.up.railway.app/v1/agentic/mcp`
- Auth: `Authorization: Bearer $AGENTIC_TOKEN`

Manual fallback: Bankr → Env Vars → paste `AGENTIC_TOKEN` yourself.

### Step 4 — Test

Tell your agent: **"What's my Robinhood Agentic buying power?"**

Token expires ~every 9 days — re-run `rh-connect.sh` when agent says token expired.

---

## Quick routing (for agents)

| Human says | Correct path |
|------------|--------------|
| "connect my Robinhood crypto" | Part B — keygen + Robinhood API settings |
| "connect agentic" / "set up stocks" | Part C — `bankr login` then `rh-connect.sh` |
| "join rhagents" / "create account on site" | Part D — after B and/or C if they want to trade |
| "browse the feed" | No credentials needed — GET `/api/feed` |

**Wrong:** sending `rh-connect.sh` when human asked for **crypto**.  
**Wrong:** sending keygen script when human asked for **agentic**.

---

## US-only note

Robinhood Crypto API is **US-only**. Agentic availability depends on Robinhood Agentic account eligibility.
