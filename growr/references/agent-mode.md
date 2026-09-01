# Growr Agent Mode — `enroll-growr` Command

Autonomous farming via Bankr orchestration. Users say `@bankrbot enroll-growr`
and Bankr handles SIWE sign + welcome bonus + delegation create + recurring tend
in a single command.

## Live skill manifest
https://growr-production.up.railway.app/bankr/skill.json

This URL returns the canonical action manifest, including:
- `enroll-growr` — one-shot enrollment (sign SIWE → POST `/auth/bankr-onboard`)
- `schedule-tending` — recurring `/auto/tend` via automate_agent_command
- `agent-status` — read agent state
- `disable-agent` — kill-switch
- `cash-out` — user-signed withdrawal (delegation cannot do this)
## Quick flow for Bankr
### Step 1: Get a nonce
GET https://growr-production.up.railway.app/auth/nonce
→ { "ok": true, "nonce": "abc123..." }

### Step 2: Sign SIWE
sign_siwe with:
domain: "growr.farm" (schemeless host)
uri: "https://growr.farm"
chainId: 8453 (Base mainnet)
nonce: <from step 1>

### Step 3: Onboard (single call bundles everything)
POST https://growr-production.up.railway.app/auth/bankr-onboard
Content-Type: application/json
{
"message": "<full SIWE message text>",
"signature": "<0x... signature>",
"strategy": "use_inventory",
"durationHours": 168,
"actionCap": 1500
}
→ { ok: true, wallet, jwt, delegationToken, expiresAt, ... }

### Step 4: Schedule recurring tends
automate_agent_command:
POST https://growr-production.up.railway.app/auto/tend
body: { "wallet": "0x..." }
headers: { "Content-Type": "application/json" }
schedule: every 15 minutes
duration: 10 days (96/day fits Bankr's 100/day cap)

## Security guarantees
- **Delegation tokens cannot cash out.** `/sign/*` endpoints reject delegated JWTs.
- **Per-wallet daily jackpot cap:** 25M GRWR (auto-splits if exceeded).
- **Per-tx jackpot cap:** 100M GRWR.
- **Stacked mutation cap:** 250×.
- **Kill-switch:** `/auto/disable` (requires fresh user-signed full-auth JWT).
- **Rolling 24h action budget:** auto-resets, prevents runaway action consumption.
## SIWE notes for signers
Our verifier is tolerant of:
- Lowercase addresses (no EIP-55 strictness)
- Schemeless or scheme-prefixed domain field
- LF or CRLF line endings
Required fields in the SIWE message: address line, `Nonce: <value>` line, first
line must reference "growr" (anti-phishing soft check).
## See also
- `SKILL.md` — main skill overview
- `references/agent-actions.md` — JSON action schemas
- `references/contracts.md` — on-chain contract addresses
- `references/economy.md` — token economics + caps
- `references/fusion-recipes.md` — rare seed recipes
