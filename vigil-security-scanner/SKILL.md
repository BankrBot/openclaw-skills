---
name: vigil-security-scanner
description: Onchain security scanner for Base tokens and wallets. Scan token approvals, detect honeypots, find rugpull indicators, check liquidity locks, owner-modifiable tax, dangerous owner permissions, copy-paste scam clones, simulate approvals, score contract safety 0-100, and get a multi-source consensus verdict. Use when a user asks an agent to evaluate, scan, or check a Base token or wallet before trading, swapping, signing an approval, or investing. 17 read-only tools, keyless and free. Read-only intelligence — not financial advice.
tags: [security, defi, base, rugpull, honeypot, onchain]
version: 1
visibility: public
metadata:
  emoji: 👁️
  homepage: https://vigil.codes
  network: base
  chainId: 8453
  requires:
    bins: [curl, jq]
---

# VIGIL Security Scanner

Onchain security scanner for DeFi traders and autonomous agents on Base. Paste a
token or wallet address, get a verdict before you sign. VIGIL exposes 17
read-only tools over a keyless JSON-RPC endpoint — no API key, no signup, no
account.

**Endpoint:** https://mcp.vigil.codes
**Site:** https://vigil.codes
**Source:** https://github.com/vigilcodes/vigil-mcp
**Network:** Base (chainId 8453)

The core thesis: most security tools tell you what happened *after* you lose
money. VIGIL tells you *before* you sign. Risk only escalates to high/critical
when multiple independent sources agree — a deliberate false-positive guard.

---

## 🎯 When to Use This Skill

Use VIGIL when a user wants to:

- Check a Base token before buying, swapping, or aping in
- Audit a wallet's token approvals and flag unlimited/risky allowances
- Detect honeypots (tokens that block selling)
- Check whether DEX liquidity is locked, burned, or freely withdrawable (rug vector)
- Score any contract 0-100 across code, ownership, registry, and reputation
- Get a single aggregated verdict from 6 independent security sources

**Do NOT use this skill for:**

- Trade execution (VIGIL is read-only intelligence)
- Revoking approvals (that's a separate write action requiring Bankr auth — see "Revocation" below)
- Chains other than Base for deep scans (Base-first; a small Ethereum stablecoin registry exists for labels)
- Price predictions or financial advice

---

## 🚀 Quick Start

All scans go through a single JSON-RPC 2.0 endpoint. No auth for read-only tools.

```bash
# Health check — confirms the server is live and how many tools are available
curl -s https://mcp.vigil.codes/health
# -> {"status":"ok","service":"vigil-mcp","tools":17}

# Safety score for USDC on Base
curl -s -X POST https://mcp.vigil.codes/tools/call \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call",
       "params":{"name":"vigil_safety_score",
                 "arguments":{"contract":"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913","chain":"base"}}}'
# -> {"jsonrpc":"2.0","id":1,"result":{"score":92,"risk_level":"safe",...}}
```

`GET /tools/list` enumerates every tool. There is no REST API — use `POST /tools/call`.

---

## 🛠 The 17 Tools

| Tool | What it does |
|---|---|
| `vigil_safety_score` | 0-100 composite rating (code, ownership, registry, reputation) |
| `vigil_detect_honeypot` | Simulate buy/sell to detect tokens that block selling |
| `vigil_check_tax` | Flag punishing or owner-modifiable buy/sell/transfer tax ("0% now, 99% later") |
| `vigil_check_ownership` | Owner powers: mint, pause, blacklist, reclaim ownership, modify balances, selfdestruct |
| `vigil_detect_clone` | Flag copy-paste scam clones by bytecode fingerprint, cross-checked vs scam DB |
| `vigil_simulate_approval` | Risk-assess a spender BEFORE you approve it — "what could it do if I sign?" |
| `vigil_liquidity_lock` | Detect if LP is locked / burned / unlocked / unknown (rug vector) |
| `vigil_consensus` | Multi-source verdict — 6 independent signals vote, risk escalates only on agreement |
| `vigil_scan_token` | Rugpull indicators: hidden mint, proxy, tax manipulation, blacklist |
| `vigil_scan_approvals` | List all ERC-20/721 approvals, flag unlimited allowances |
| `vigil_wallet_report` | Full wallet security posture assessment |
| `vigil_monitor_wallet` | Alerts for new approvals, risky interactions, balance changes |
| `vigil_token_market` | Price, liquidity, 24h volume, pool age via DexScreener |
| `vigil_deployer_check` | Contract verification, name, deployer reputation via Basescan |
| `vigil_batch_scan` | Score multiple tokens in one call, ranked by risk |
| `vigil_check_scam` | Community scam reports for a token |
| `vigil_sentinel_status` | Autonomous Sentinel watchlist + loop config |

Free core safety checks: `vigil_safety_score`, `vigil_detect_honeypot`,
`vigil_check_tax`, `vigil_check_ownership`, `vigil_detect_clone`,
`vigil_simulate_approval`, `vigil_liquidity_lock`. These stay barrier-free so
agents always have a pre-trade guard. Premium tools (deeper aggregations) are
optionally pay-per-call in USDC via x402 — no account needed.

---

## 🔁 Recommended Agent Workflow

When a user asks about a Base token, the agent should:

1. **Detect the address** in the user's message (42-char 0x-prefixed hex)
2. **Normalize to lowercase** before any call
3. **Run the right tool** for the question:
   - "Is this safe to buy?" → `vigil_consensus` (full verdict) or `vigil_safety_score` (quick)
   - "Can I sell it?" → `vigil_detect_honeypot`
   - "Will it tax me / can the tax change?" → `vigil_check_tax`
   - "Who controls this contract?" → `vigil_check_ownership`
   - "Is this a copy-paste scam?" → `vigil_detect_clone`
   - "Should I sign this approval?" → `vigil_simulate_approval` (spender + token)
   - "Can the dev rug the liquidity?" → `vigil_liquidity_lock`
   - "Check my wallet's approvals" → `vigil_scan_approvals` (wallet address)
4. **Relay the verdict** including risk level, key reasons, and any critical flags
5. **Always note** this is read-only intelligence, not financial advice

### Example: full pre-trade verdict

```bash
curl -s -X POST https://mcp.vigil.codes/tools/call \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call",
       "params":{"name":"vigil_consensus",
                 "arguments":{"token":"0xTOKEN","chain":"base"}}}' | jq '.result'
```

Returns `verdict` (safe → critical), `confidence`, per-source votes, and a
`summary`. The 6 sources: GoPlus, onchain bytecode, market liquidity, deployer
verification, community scam DB, and liquidity lock.

### Example: liquidity lock check

```bash
curl -s -X POST https://mcp.vigil.codes/tools/call \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call",
       "params":{"name":"vigil_liquidity_lock",
                 "arguments":{"token":"0xTOKEN","chain":"base"}}}' | jq '.result'
```

Returns `lock_status` (locked/burned/unlocked/unknown), `locked_fraction`, and
`pair_address`. `unknown` means data was insufficient — **never treated as
safe**. Covers V2-style ERC-20 LP tokens; V3/NFT positions return `unknown`.

---

## 📊 Risk Levels

| Level | Icon | Meaning |
|-------|------|---------|
| CRITICAL | 🔴 | Active threat — do not interact |
| HIGH | 🟠 | Dangerous pattern — likely exploit vector |
| MEDIUM | 🟡 | Suspicious — proceed with caution |
| LOW | 🟢 | Minor concern — monitor |
| SAFE | ✅ | No issues detected |

---

## ⚠ Important: Revocation is NOT included

The Approval Revoker performs state-changing onchain transactions via Bankr. It
is intentionally excluded from this read-only skill. To revoke approvals, use
VIGIL's separate revoke flow (requires `BANKR_API_KEY` and explicit user
confirmation). This skill never signs, sends, or moves funds.

---

## 🧩 Why VIGIL

- **Consensus, not noise** — 6 independent sources vote; a single source caps at "medium". False positives are the enemy of a security tool.
- **Liquidity lock detection** — fails safe to `unknown`, never fabricates a `safe` when LP data is missing.
- **Keyless + free** — core pre-trade checks need no API key. Built for autonomous agents that must scan before they sign.
- **MCP-native** — works in Claude Desktop, Cursor, Aeon, and any MCP client.

---

## 🔗 Pairs with

VIGIL slots in as the security layer for any skill that surfaces or acts on a token. Natural pairings already in the catalog:

- **`aeon-token-pick`** — call VIGIL before publishing a pick. If `vigil_consensus` returns high/critical or `vigil_detect_honeypot` flags, escalate to NO_PICK with VIGIL evidence. Stops bad picks at the source.
- **`aeon-monitor-runners`** — already drops honeypots from the top-runners list; VIGIL adds 6-source consensus + liquidity-lock checks for the same set, much deeper signal.
- **`aeon-on-chain-monitor`** — when a watched wallet grants a new approval, run VIGIL's `vigil_scan_approvals` to classify the spender risk before the alert fires.
- **`aeon-defi-monitor`** — before recommending a pool, run `vigil_liquidity_lock` on the LP to confirm liquidity isn't withdrawable by the deployer.

The pattern is the same in every case: **scan before you sign**, and never let a missing data source get reported as "safe".

---

## 📞 Resources

- **Endpoint:** https://mcp.vigil.codes
- **Site:** https://vigil.codes
- **Source:** https://github.com/vigilcodes/vigil-mcp
- **Twitter:** https://x.com/vigilcodes

For per-tool request/response details, see [references/api-reference.md](references/api-reference.md).

*VIGIL is read-only onchain security intelligence. Not financial advice. Always verify independently before signing.*
