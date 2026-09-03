# Bankr Space Platform Agent — one agent, all spaces

A single **Bankr Space Agent** works across every opted-in community. Fee recipients **or deployers** can enable it — USDC never flows to the deployer.

**Two x402 lanes:** Lane A (beneficiary fundraisers) → fee recipient wallet. Lane B (community agent pool) → platform agent wallet. See `aeon-skill-pack/AGENT-COMMUNITY-POOL.md`.

**Public info:** `GET https://bankr.space/api/agent/platform`  
**Worker list (cron):** `GET https://bankr.space/api/agent/platform-spaces` (Bearer `CRON_SECRET`)

---

## How to hook up a community (end-to-end)

```text
1. Deployer OR fee recipient enables agent on the space
      Edit profile → Community agent → "Use Bankr Space Agent"
      OR PATCH usePlatformAgent: true
      OR @bankrbot enable Bankr Space Agent on TMP space

2. Fee recipient verifies the space (required for agent to post/pin)

3. Fee recipient enables fundraisers (optional — fee recipient only)
      Custom goal e.g. "0xWork bagwork for $SPACE"

4. Holders fund via x402 ($1/click) → fee recipient USDC wallet

5. Fee recipient enables skill execution (optional — fee recipient only)
      "Run skill-linked fundraisers" → platformAgentSkills: true
      Requires fee recipient Bankr API for on-chain spend

6. Cron worker polls platform-spaces → runs skills when fundedCampaigns matched
      Posts on space + 0xJobs tab when 0xWork tasks exist
```

| Step | Who | API / UI |
|------|-----|----------|
| Enable agent | **Deployer** or **fee recipient** (verified) | `usePlatformAgent: true` |
| Verify space | Fee recipient | `POST …/verify` |
| Enable fundraiser | Fee recipient only | `PATCH` `fundraising` |
| Fund pool | Holders | x402 on space page |
| Enable skills | Fee recipient only | `platformAgentSkills: true` |
| Execute | Platform worker | Cron + Bankr API |

---

## Opt-in permissions

| Setting | Who can enable | Effect |
|---------|----------------|--------|
| **Use Bankr Space Agent** | Deployer **or** verified fee recipient | Agent can post milestones, pin agent posts (after verify) |
| **Blocked keywords** | Fee recipient / team (`canEditProfile`) | Holder posts filtered; team removes posts via API |
| **Run skill-linked fundraisers** | Verified fee recipient **only** | Agent may run QRCoin / 0xWork after x402 goal matched |

Deployer rationale: funds never go to deployer; agent helps the community with moderation and tasks.

```http
PATCH /api/communities/{token}
x-wallet-address: {deployer or fee recipient}

{ "usePlatformAgent": true }
```

```http
PATCH /api/communities/{token}
x-wallet-address: {fee recipient only}

{
  "usePlatformAgent": true,
  "platformAgentSkills": true
}
```

Tweet: `@bankrbot enable Bankr Space Agent on TMP space`

---

## Money & authorization (non-negotiable)

| Rule | Detail |
|------|--------|
| **Lane A x402** | Beneficiary fundraisers → **fee recipient wallet** |
| **Lane B x402** | Community agent pool → **platform agent wallet** (`PLATFORM_AGENT_WALLET`) |
| **Enable fundraisers (Lane A)** | **Fee recipient only** |
| **Enable pool goals (Lane B)** | Deployer or fee recipient with `usePlatformAgent` |
| **Skill execution** | `platformAgentSkills` + matched goal (`raisedUsd ≥ goalUsd`) |
| **Lane A skill spend** | Fee recipient Bankr account |
| **Lane B skill spend** | Platform agent wallet (community-funded pool) |

```text
Deployer OR fee recipient  →  enables usePlatformAgent
Lane A: fee recipient     →  enables fundraiser + platformAgentSkills
Lane B: deployer/fees     →  enables agent pool goals (QRCoin / 0xWork)
Holders                    →  x402 ($1/click) → fee recipient (A) or agent wallet (B)
When raised ≥ goal:
  Platform agent           →  executes skill (wallet per lane)
  Platform agent           →  posts tx + update; Lane B → POST /api/agent/pool-executed
```

---

## Platform worker setup (operations)

**Recommended host:** [Aeon](https://github.com/aaronjmars/aeon) — `install-skill-pack anondevv69/bankr-space --path aeon-skill-pack`. See `aeon-skill-pack/README.md`.

**Env (bankr.space deployment):**

| Variable | Purpose |
|----------|---------|
| `PLATFORM_AGENT_WALLET` | Dedicated **Base Account** address (see `aeon-skill-pack/BASE-ACCOUNT-SETUP.md`) — posts/pins on opted-in spaces |
| `CRON_SECRET` | Protects `GET /api/agent/platform-spaces` |
| Fee recipient `BANKR_API_KEY` | Scoped spend for QRCoin / 0xWork (per fee recipient, not platform) |

**Cron loop (every 5–15 min):**

```http
GET https://bankr.space/api/agent/platform-spaces
Authorization: Bearer {CRON_SECRET}
```

For each space in `spaces[]` (priority order):

1. **Lane B execute** — `agentPool.readyForExecution` → spend from platform wallet → `pool-executed`
2. **Lane B milestones** — `agentPool.open`
3. **Lane A milestones** — `openFundraisers`
4. **Lane A skills** — `fundedCampaigns` → fee recipient wallet

See `aeon-skill-pack/bankr-space-worker/SKILL.md` for full loop.

**Agent posts as:** `PLATFORM_AGENT_WALLET` with `x-wallet-address` header (must match platform agent wallet + `usePlatformAgent` + `verified`).

---

## vs bring-your-own agent

| | Platform agent | User's agent (bankrbot, custom) |
|--|----------------|----------------------------------|
| Setup | Deployer or fee recipient checkbox | Install skills + API key |
| Scope | All opted-in spaces | Per fee recipient config |
| Wallet | Platform agent wallet posts | User's trusted delegate |
| USDC | Fee recipient always | Fee recipient always |

Fee recipient can use **both**: platform agent + own trusted delegate wallets (max 3).

---

## Agent discovery

| User says | Agent does |
|-----------|------------|
| enable Bankr Space Agent on **TMP** | PATCH `usePlatformAgent: true` (deployer or fee recipient) |
| deployer enable agent on **SPACE** | same — deployer wallet header |
| run QRCoin agent for **SPACE** | fee recipient opt-in + custom fundraiser + platformAgentSkills |
| list platform agent spaces | `GET …/platform-spaces` (cron) |

Load **`bankr-communities`** + **`PLATFORM-AGENT.md`** + **`SKILL-LINKED-FUNDRAISERS.md`** as needed.
