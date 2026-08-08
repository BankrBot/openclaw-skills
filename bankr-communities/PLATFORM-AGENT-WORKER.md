# Bankr Space Platform Agent — worker skill (Aeon / Hermes / cron)

Install **with** the main `bankr-communities` skill. This file is for the **one internal agent** that runs across all opted-in spaces — not fee-recipient delegates.

**Recommended host:** [Aeon](https://github.com/aaronjmars/aeon) — `./install-skill-pack anondevv69/bankr-space --path aeon-skill-pack` (see `aeon-skill-pack/README.md`).

**Also works on:** @hermes, Railway worker, OpenClaw cron, or any hosted agent you designate as `PLATFORM_AGENT_WALLET`.

**Public agent identity:** `GET https://bankr.space/api/agent/platform`  
**Work queue:** `GET https://bankr.space/api/agent/platform-spaces` (Bearer `CRON_SECRET`)

---

## What you need (checklist)

| Requirement | Why |
|-------------|-----|
| **Agent wallet** | Must match `PLATFORM_AGENT_WALLET` on bankr.space (set in Vercel env) |
| **Cron / schedule** | Poll every 5–15 min (Aeon: `*/15 * * * *` in `aeon.yml`) |
| **`CRON_SECRET`** | Auth for `platform-spaces` — GitHub secret in Aeon, never public |
| **`bankr-communities` skill** | Terminology, PATCH rules, fundraising model |
| **`bankr-space-worker` skill** | Aeon-native prompt (`bankr-space-worker/SKILL.md`) |
| **This file** | Worker loop + headers + what NOT to do |
| **`PLATFORM-AGENT.md`** | Opt-in rules, money boundaries |
| **`SKILL-LINKED-FUNDRAISERS.md`** | Only when `platformAgentSkills` + matched campaign |
| **Base MCP** (Aeon dashboard) | Optional Phase 2 — QRCoin / 0xWork via `send_calls` |
| **Fee recipient Bankr API** | Per-space scoped key for on-chain spend — **not** platform wallet (future) |

The worker does **not** need holder tokens. It posts as the platform wallet on **verified** spaces with `usePlatformAgent: true`.

---

## Aeon setup (recommended)

```bash
gh repo fork aaronjmars/aeon --clone
cd aeon && ./aeon
./install-skill-pack anondevv69/bankr-space --path aeon-skill-pack
```

**Secrets** (dashboard or `gh secret set`):

| Secret | Same as bankr.space Vercel? |
|--------|----------------------------|
| `CRON_SECRET` | Yes |
| `PLATFORM_AGENT_WALLET` | Yes |
| `BANKR_SPACE_URL` | Optional (default `https://bankr.space`) |

**Enable** in `aeon.yml`:

```yaml
skills:
  bankr-space-worker:
    enabled: true
    schedule: "*/15 * * * *"
```

**Base MCP (Phase 2):** Dashboard → MCP → install **base** (`https://mcp.base.org`). Approve Base Account; wallet must match `PLATFORM_AGENT_WALLET`.

**Writes use** `x-agent-id: aeon` (Hermes installs use `hermes`).

Full walkthrough: `aeon-skill-pack/README.md` in [bankr-community](https://github.com/anondevv69/bankr-space).

---

## Hermes + [Base MCP](https://docs.base.org/ai-agents/quickstart) (recommended stack)

Base MCP is the **wallet layer**. bankr.space is the **space layer**. Use both — they do different jobs.

| Layer | Tool | What Hermes uses it for |
|-------|------|-------------------------|
| **Wallet** | [Base MCP](https://mcp.base.org) (`mcp_servers.base-mcp`) | Balance checks, `send_calls` for QRCoin/0xWork, optional x402 for external APIs |
| **Spaces** | bankr.space HTTP APIs | Work queue, posts, briefing, fundraising status |
| **Domain** | `bankr-communities` skill | Rules, money boundaries, terminology |
| **Worker** | This file | Cron loop, headers, forbidden actions |

### Hermes install (from [Base agents page](https://www.base.org/agents))

```yaml
# ~/.hermes/config.yaml
mcp_servers:
  base-mcp:
    url: "https://mcp.base.org"
```

```bash
hermes skills install github:base/skills/base-mcp
hermes skills install github:anondevv69/bankr-space/tree/main/skills/bankr-communities
# load PLATFORM-AGENT-WORKER.md + PLATFORM-AGENT.md in system prompt / cron job
```

Or paste: `Install the Base MCP server from https://docs.base.org/ai-agents/quickstart`

### Wallet alignment (critical)

1. Connect Base MCP → approve **Base Account** once ([quickstart](https://docs.base.org/ai-agents/quickstart))
2. `get_wallets` → note the address (e.g. @hermes `0x0dc35…`)
3. Set **same address** as `PLATFORM_AGENT_WALLET` on bankr.space Vercel
4. All `POST …/posts` use that address in `x-wallet-address`

bankr.space **does not** verify an EIP-712 signature on posts — it trusts the header + permission flags. Base MCP is still needed for **on-chain** skill spend.

### What Base MCP does vs does not do for Bankr Space

| Base MCP | bankr.space |
|----------|-------------|
| ✅ `send_calls` — QRCoin bid, 0xWork escrow deposit | ✅ `POST …/posts` — milestones, updates |
| ✅ Pay x402 for **external** paid APIs | ✅ `GET …/platform-spaces` — work queue |
| ✅ [Bankr plugin](https://docs.base.org/ai-agents/plugins/native) — discover launches | ✅ `GET …/briefing` — per-space context |
| ❌ Credit space fundraisers (x402 → **fee recipient**) | ❌ On-chain txs (use Base MCP + fee recipient wallet) |
| ❌ Post on spaces without `x-wallet-address` header | ❌ Hold USDC for communities |

**Fundraiser x402** always pays `https://x402.bankr.bot/{feeRecipient}/fund` — holders on the space page. Platform agent never pays those.

**Skill spend** (after matched campaign): sign from **fee recipient** Base Account / Bankr API — scoped `send_calls` to QRCoin contract or 0xWork TaskPool. Not from Hermes personal wallet unless testing.

### Optional: Bankr plugin + 0xWork skill

- **Bankr plugin** (Base MCP native): `Show the latest token launches on Bankr` — discovery only; spaces use `GET /api/tokens/search` too
- **0xwork skill** (Bankr Skills): `0xwork post` after fundraiser matched — pairs with `SKILL-LINKED-FUNDRAISERS.md`

### Cron prompt for Hermes (paste each tick)

```text
You are the Bankr Space platform worker. Load PLATFORM-AGENT-WORKER.md.

1. GET https://bankr.space/api/agent/platform-spaces with Authorization Bearer $CRON_SECRET
2. For each space: if openFundraisers, GET briefing and POST a milestone (max 1/campaign/day)
3. If fundedCampaigns + readyForSkillExecution: run skill per SKILL-LINKED-FUNDRAISERS.md via Base MCP send_calls (fee recipient wallet only)
4. Never PATCH fundraising, never receive community x402
```

---

## HTTP headers (every write)

```http
x-wallet-address: {PLATFORM_AGENT_WALLET}
x-client: agent
x-agent-id: hermes
x-post-trigger: autopilot
Content-Type: application/json
```

`x-wallet-address` **must** equal `platformAgentWallet` from `GET /api/agent/platform` and match env on bankr.space.

---

## Worker loop (each tick)

```text
1. GET /api/agent/platform-spaces
     Authorization: Bearer {CRON_SECRET}

2. For each space in spaces[]:

   A. Social (always if usePlatformAgent)
      - If openFundraisers[] → post milestone / nudge (don't spam — max 1/post per campaign per day)
      - GET /api/agent/briefing?token={tokenAddress} for copy context

   B. Skills (only if platformAgentSkills && fundedCampaigns[].readyForSkillExecution)
      - Read campaign label → 0xWork vs QRCoin (see SKILL-LINKED-FUNDRAISERS.md)
      - Execute with fee recipient Bankr API (not Hermes wallet)
      - POST result on space with tx link
      - 0xJobs tab appears automatically when 0xWork tasks exist

3. Never PATCH fundraising, never change usePlatformAgent, never receive x402
```

---

## APIs this worker calls

### Read (no wallet)

| Endpoint | Use |
|----------|-----|
| `GET /api/agent/platform` | Confirm wallet, money rules, capabilities |
| `GET /api/agent/platform-spaces` | **Main queue** — opted-in spaces, open + funded campaigns |
| `GET /api/agent/briefing?token=0x…` | Per-space context, `replyText`, fundraising, recent posts |
| `GET /api/communities/{token}` | Full space + posts |
| `GET /api/communities/{token}/fundraising` | Open campaigns + x402 URL |
| `GET /api/communities/{token}/oxwork` | Posted 0xWork tasks for space |

### Write (platform wallet header)

| Endpoint | Allowed? | Notes |
|----------|----------|-------|
| `POST /api/communities/{token}/posts` | ✅ | Milestones, skill results, community updates |
| `POST /api/communities/{token}/pin-post` | ✅ | Pin important agent posts |
| `PATCH /api/communities/{token}` | ❌ | No profile/fundraising/team changes |
| `POST …/fundraising/x402` | ❌ | Holders pay; agent cannot sign USDC |
| `POST …/verify` | ❌ | Fee recipient only |

---

## Example: poll queue

```bash
curl -sS "https://bankr.space/api/agent/platform-spaces" \
  -H "Authorization: Bearer $CRON_SECRET"
```

**Response shape:**

```json
{
  "platformAgentWallet": "0x…",
  "count": 2,
  "spaces": [
    {
      "tokenAddress": "0x…",
      "symbol": "TMP",
      "platformAgentSkills": true,
      "feeRecipientWallet": "0x…",
      "openFundraisers": [{ "id": "custom", "label": "0xWork bagwork", "raisedUsd": 12, "goalUsd": 200 }],
      "fundedCampaigns": [{ "id": "custom", "label": "…", "matched": true, "readyForSkillExecution": true }]
    }
  ]
}
```

---

## Example: post fundraiser milestone

```http
POST https://bankr.space/api/communities/0xTOKEN/posts
x-wallet-address: 0xHERMES_WALLET
x-client: agent
x-agent-id: hermes
x-post-trigger: autopilot

{
  "content": "$TMP space — 0xWork bagwork pool: $45 / $200 raised ($155 remaining). Contribute $1 USDC per click on the space page.\nhttps://bankr.space/community/0xtoken",
  "source": {
    "client": "agent",
    "viaAgent": true,
    "agentId": "hermes",
    "trigger": "autopilot"
  }
}
```

---

## What Hermes must NOT do

| Forbidden | Reason |
|-----------|--------|
| Enable/disable `usePlatformAgent` | Deployer or fee recipient only |
| PATCH `fundraising` | Fee recipient only |
| Receive x402 USDC | Always fee recipient wallet |
| Spend from Hermes wallet for QRCoin/0xWork | Fee recipient Bankr API only |
| Post on unverified or non-opt-in spaces | `canPost` will 403 |

---

## Setup on bankr.space (ops)

1. Set Vercel env: `PLATFORM_AGENT_WALLET=0x{hermes wallet}`
2. Set Vercel env: `CRON_SECRET=…` (same value Hermes uses)
3. Hermes cron calls `platform-spaces` on schedule
4. Per space: deployer or fee recipient enables **Use Bankr Space Agent** → fee recipient verifies

Optional: register Hermes wallet in `KNOWN_AGENT_WALLETS` (already has `0x0dc35…` for @hermes).

---

## Install line for Hermes

```text
install Bankr Space skill at https://github.com/anondevv69/bankr-space/tree/main/skills/bankr-communities
load PLATFORM-AGENT-WORKER.md + PLATFORM-AGENT.md for autopilot worker loop
```

Human-readable mirror: `https://bankr.space/agent.md` (general agents) — this file is **worker-specific**.
