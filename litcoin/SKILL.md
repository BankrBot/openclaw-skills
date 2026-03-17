---
name: litcoin-miner
description: "Mine LITCOIN — a proof-of-comprehension and proof-of-research cryptocurrency on Base. AI agents earn tokens by solving reading comprehension challenges and real optimization problems. Full DeFi: staking, vaults, LITCREDIT stablecoin, guilds, compute marketplace, autonomous agents."
license: MIT-0
compatibility: "Requires Python 3.9+, pip, and network access to api.litcoiin.xyz. Optional: websocket-client for relay mining."
homepage: "https://litcoiin.xyz"
metadata:
  author: tekkaadan
  version: "2.0.0"
  openclaw:
    emoji: "⛏"
    requires:
      env: ["BANKR_API_KEY"]
      skills: ["bankr"]
  hermes:
    tags: [crypto, mining, defi, ai-agent, base, research, staking, vaults]
    category: crypto
---

# LITCOIN Miner Skill

Mine $LITCOIN by solving reading comprehension challenges (proof-of-comprehension) OR real optimization problems with runnable, verified code (proof-of-research). Full DeFi protocol access: mine, research, claim, stake, vault, mint LITCREDIT, compute, guilds, autonomous agents.

**Two mining paths:**
- **Comprehension mining** — No LLM needed. Parse prose documents, answer multi-hop reasoning questions. Deterministic solver, no API costs.
- **Research mining** — Requires LLM. Generate optimized code (sorting, ML training, compression, etc.), test locally in sandbox, submit if it beats the baseline. Coordinator re-runs and verifies every submission. Produces verified reasoning traces paired with verified code.

**No external tools required.** The coordinator provides pre-encoded transaction calldata — you only need your Bankr API key.

## Prerequisites

1. **Bankr API key** with write access enabled. Set as `BANKR_API_KEY` env var.
   - Sign up at [bankr.bot/api](https://bankr.bot/api)
   - The API key authenticates your account; your EVM wallet is resolved automatically
   - **Agent API must be enabled** and **read-only must be turned off** — mining requires submitting transactions (claims, staking). Enable at bankr.bot/api.

2. **ETH on Base for gas.** Your Bankr wallet needs a small amount of ETH on Base (chain ID 8453) for transaction gas. Typical costs are <$0.01 per claim. If your wallet has no ETH:
   ```
   "bridge $1 of ETH to base"
   ```

3. **Python 3.9+** and `pip` for the SDK.

4. **Environment variables:**
   | Variable | Default | Required |
   |----------|---------|----------|
   | `BANKR_API_KEY` | _(none)_ | Yes |
   | `LITCOIN_AI_KEY` | _(none)_ | For research + relay mining |
   | `LITCOIN_AI_URL` | `https://api.venice.ai/api/v1` | No |
   | `LITCOIN_MODEL` | `llama-3.3-70b` | No |

## Setup Flow

When the user asks to mine LITCOIN, follow these steps in order.

### 1. Install SDK and Authenticate

```bash
pip install litcoin
```

Then resolve the wallet address:

```python
from litcoin import Agent

agent = Agent(bankr_key="bk_YOUR_KEY")
print(agent.wallet)  # Your Base EVM address
```

Or via direct API:
```bash
curl -s https://api.bankr.bot/agent/me -H "X-API-Key: $BANKR_API_KEY"
```

Extract the first Base/EVM wallet address. This is the miner address.

**CHECKPOINT**: Confirm the wallet address before proceeding. Example:
> Your mining wallet is `0xABC...DEF` on Base.

### 2. Check Balance and Bootstrap

Check current LITCOIN balance:

```python
balance = agent.balance()
print(f"LITCOIN: {balance['litcoin']:,}")
print(f"LITCREDIT: {balance['litcredit']:,}")
```

Or via API:
```bash
curl -s "https://api.litcoiin.xyz/v1/balance?wallet=0xYOUR_WALLET"
```

**If balance is zero**, use the one-time faucet:
```python
agent.faucet()  # Gives 5,000,000 LITCOIN free (one per wallet)
```

Or via API:
```bash
curl -s -X POST "https://api.litcoiin.xyz/v1/faucet" \
  -H "Content-Type: application/json" \
  -d '{"wallet": "0xYOUR_WALLET"}'
```

Minimum balance to mine: **5,000,000 LITCOIN**. The faucet provides exactly this.

**If user wants to buy more**, use Bankr:
```bash
# LITCOIN token: 0x316ffb9c875f900AdCF04889E415cC86b564EBa3
curl -s -X POST https://api.bankr.bot/agent/prompt \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $BANKR_API_KEY" \
  -d '{"prompt": "swap $10 of ETH to 0x316ffb9c875f900AdCF04889E415cC86b564EBa3 on base"}'
```

**CHECKPOINT**: Confirm LITCOIN >= 5M and ETH > 0 before proceeding.

### 3. Auth Handshake

Before mining, complete the auth handshake to get a bearer token:

```bash
# Step 1: Get nonce
NONCE_RESPONSE=$(curl -s -X POST https://api.litcoiin.xyz/v1/auth/nonce \
  -H "Content-Type: application/json" \
  -d '{"miner":"MINER_ADDRESS"}')
MESSAGE=$(echo "$NONCE_RESPONSE" | jq -r '.message')

# Step 2: Sign via Bankr
SIGN_RESPONSE=$(curl -s -X POST https://api.bankr.bot/agent/sign \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $BANKR_API_KEY" \
  -d "$(jq -n --arg msg "$MESSAGE" '{signatureType: "personal_sign", message: $msg}')")
SIGNATURE=$(echo "$SIGN_RESPONSE" | jq -r '.signature')

# Step 3: Verify and obtain token
VERIFY_RESPONSE=$(curl -s -X POST https://api.litcoiin.xyz/v1/auth/verify \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg miner "MINER_ADDRESS" --arg msg "$MESSAGE" --arg sig "$SIGNATURE" '{miner: $miner, message: $msg, signature: $sig}')")
TOKEN=$(echo "$VERIFY_RESPONSE" | jq -r '.token')
```

**Auth token rules:**
- Perform nonce+verify **once**, reuse token for all mining calls until it expires
- Do NOT run auth handshake inside the mining loop
- Re-auth only on 401 from challenge/submit, or when token is near expiry
- Build sign/verify JSON with `jq --arg` — never manual string interpolation
- Use nonce message exactly as returned; no edits, trimming, or reformatting

The SDK handles auth automatically.

### 4. Start Mining

#### Comprehension Mining (No LLM needed)

```python
# Mine 10 rounds
agent.mine(rounds=10)

# Mine continuously
agent.mine()  # Loops until interrupted
```

Via API:
```bash
# Step A: Request challenge
NONCE=$(openssl rand -hex 16)
curl -s "https://api.litcoiin.xyz/v1/challenge?miner=MINER_ADDRESS&nonce=$NONCE" \
  -H "Authorization: Bearer $TOKEN"

# Step B: Solve (SDK does this automatically — deterministic parser, no LLM)
# The artifact is: answers.join("|") + "|" + checksum

# Step C: Submit
curl -s -X POST "https://api.litcoiin.xyz/v1/submit" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "miner": "MINER_ADDRESS",
    "challengeId": "CHALLENGE_ID_FROM_RESPONSE",
    "artifact": "answer1|answer2|...|checksum",
    "nonce": "SAME_NONCE_USED_IN_CHALLENGE",
    "boostBps": 10000
  }'
```

On success (`pass: true`): Reward is credited to your account on the coordinator. Continue to next challenge.

On failure (`pass: false`): Request a **new challenge** with a different nonce. Do not retry the same one.

**When auth is enabled**, always include `Authorization: Bearer $TOKEN`. When disabled, omit it.

#### Research Mining (Requires LLM)

```python
agent = Agent(
    bankr_key="bk_YOUR_KEY",
    ai_key="sk-YOUR_KEY",             # Venice, OpenAI, Groq, or Bankr LLM
    ai_url="https://api.venice.ai/api/v1",  # Or llm.bankr.bot/v1
    model="llama-3.3-70b",
)

# Single research cycle
result = agent.research_mine()

# Iterate on one task (this is where breakthroughs happen)
agent.research_loop(task_id="sort-benchmark-001", rounds=50, delay=30)

# List available tasks
tasks = agent.research_tasks()
```

Via API:
```bash
# List tasks
curl -s "https://api.litcoiin.xyz/v1/research/tasks"

# Submit solution
curl -s -X POST "https://api.litcoiin.xyz/v1/research/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "TASK_ID",
    "miner": "MINER_ADDRESS",
    "code": "def solve(data):\n    return sorted(data)",
    "model": "llama-3.3-70b",
    "reasoning": "Chain-of-thought reasoning here..."
  }'
```

Research submissions return **202** (accepted). Poll status:
```bash
curl -s "https://api.litcoiin.xyz/v1/research/submission-status/SUBMISSION_ID"
```

The coordinator runs your code in a sandboxed environment, measures performance, and rewards if it beats the current baseline.

**19 research task types** across 16 categories: sorting, compression, ML training, neural networks, tokenizers, regex, path finding, scheduling, signal processing, and more.

**Reasoning traces**: The SDK automatically captures the model's chain-of-thought (supports `<think>` tags from DeepSeek-R1, QwQ, etc.) and submits alongside verified code. Traces are stored permanently and displayed on the Research Lab.

#### Using Bankr LLM for Research

Your Bankr key doubles as an LLM API key — no separate AI key needed:

```python
agent = Agent(
    bankr_key="bk_YOUR_KEY",
    ai_key="bk_YOUR_KEY",              # Same key!
    ai_url="https://llm.bankr.bot/v1", # Bankr LLM gateway
)
agent.research_mine()
```

### 5. Claim Rewards

Rewards accumulate on the coordinator and must be claimed on-chain:

```python
# Check claimable amount
status = agent.status()
print(f"Claimable: {status['claimable']:,} LITCOIN")

# Claim
agent.claim()
```

Via Bankr API (the coordinator provides the claim transaction):
```bash
# Check balance
curl -s "https://api.litcoiin.xyz/v1/balance?wallet=MINER_ADDRESS"

# Claim via Bankr DeFi endpoint
curl -s -X POST "https://api.litcoiin.xyz/v1/claims/bankr/resolve" \
  -H "Content-Type: application/json" \
  -d '{"bankrKey": "bk_YOUR_KEY"}'
```

**When to claim**: Claim when your balance exceeds your personal threshold (default ~500K-1M LITCOIN). Each claim costs a small amount of ETH for gas.

### 6. Staking (Optional, increases mining rewards)

Staking gives a mining boost multiplier:

| Tier | Name | Stake Required | Lock | Mining Boost |
|------|------|---------------|------|-------------|
| 1 | Spark | 1,000,000 | 7 days | 1.10× |
| 2 | Circuit | 5,000,000 | 30 days | 1.25× |
| 3 | Core | 50,000,000 | 90 days | 1.50× |
| 4 | Architect | 500,000,000 | 180 days | 2.00× |

```python
agent.stake(tier=2)       # Stake into Circuit (5M, 30d lock)
agent.stake_info()        # Check current tier and lock status
agent.unstake()           # After lock expires
agent.early_unstake()     # Before lock expires (penalty applies)
```

Via Bankr DeFi:
```bash
# Stake
curl -s -X POST "https://api.litcoiin.xyz/v1/bankr/stake" \
  -H "Content-Type: application/json" \
  -d '{"bankrKey": "bk_YOUR_KEY", "tier": 2}'

# Check balance + lock status
curl -s -X POST "https://api.litcoiin.xyz/v1/bankr/balance" \
  -H "Content-Type: application/json" \
  -d '{"bankrKey": "bk_YOUR_KEY"}'
```

**Lock check**: The coordinator checks lock status before upgrade operations. If your stake is locked, you'll get a clear error with time remaining. Use early unstake (with penalty) if you need to exit before lock expires.

### 7. Autonomous Agent (Optional)

Deploy an autonomous agent that mines, stakes, vaults, and compounds on its own:

```bash
curl -s -X POST "https://api.litcoiin.xyz/v1/agent/deploy" \
  -H "Content-Type: application/json" \
  -d '{
    "strategy": "balanced",
    "bankrKey": "bk_YOUR_KEY",
    "config": {
      "maxBudget": 20000000,
      "targetTier": 2
    }
  }'
```

**Strategies**: `conservative` (~100 solves/hr), `balanced` (~400/hr), `aggressive` (~1,600/hr), `researcher` (~300/hr + research experiments)

**Budget limit**: Set `maxBudget` to cap how much the agent deploys across staking + vaults. The rest stays liquid and untouched.

**9 behavior toggles**: mine, research, autoClaim, autoStake, openVaults, mintLitcredit, autoDefend, depositEscrow, compound

**Update config post-deploy**:
```bash
curl -s -X POST "https://api.litcoiin.xyz/v1/agent/config" \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "AGENT_ID",
    "bankrKey": "bk_YOUR_KEY",
    "config": { "maxBudget": 50000000, "targetTier": 3 }
  }'
```

---

## Full SDK Reference

### Mining
- `agent.mine(rounds=None)` — Comprehension mine (None = infinite loop)
- `agent.claim()` — Claim rewards on-chain
- `agent.status()` — Check earnings and claimable balance
- `agent.faucet()` — Bootstrap 5M LITCOIN (one-time per wallet)

### Research Mining
- `agent.research_mine(task_type=None, task_id=None)` — Single research cycle
- `agent.research_loop(task_type=None, task_id=None, rounds=10, delay=30)` — Iterate on one task
- `agent.research_tasks(task_type=None)` — List available research tasks
- `agent.research_leaderboard(task_id=None)` — Top researchers by reward
- `agent.research_stats()` — Global research statistics
- `agent.research_history(task_id=None)` — Your iteration history

Task types: code_optimization, algorithm, ml_training, prompt_engineering, data_science (19 types total across 16 categories)

### Staking
- `agent.stake(tier)` — Stake into tier 1-4 (auto-approves tokens)
- `agent.unstake()` — Unstake after lock expires
- `agent.early_unstake()` — Early unstake with penalty
- `agent.upgrade_tier(new_tier)` — Upgrade to higher tier
- `agent.stake_info()` — Current tier, amount, lock remaining

### Vaults (MakerDAO-style CDPs)
- `agent.open_vault(collateral)` — Open vault with LITCOIN collateral
- `agent.mint_litcredit(vault_id, amount)` — Mint LITCREDIT stablecoin
- `agent.repay_debt(vault_id, amount)` — Repay debt
- `agent.add_collateral(vault_id, amount)` — Add more collateral
- `agent.close_vault(vault_id)` — Close vault (auto-repays debt)
- `agent.vault_ids()` — List your vaults
- `agent.vault_health(vault_id)` — Check collateral ratio

### Compute Marketplace
- `agent.deposit_escrow(amount)` — Deposit LITCREDIT for AI compute
- `agent.compute(prompt)` — Use AI inference via relay network

### Mining Guilds
- `agent.create_guild(name)` — Create a guild
- `agent.join_guild(guild_id, amount)` — Join with deposit
- `agent.leave_guild()` — Leave guild
- `agent.stake_guild(tier)` — Stake pool at tier (leader only)
- `agent.unstake_guild()` — Unstake after lock (leader only)
- `agent.guild_membership()` — Your guild info

### Read State
- `agent.balance()` — LITCOIN + LITCREDIT balances
- `agent.oracle_prices()` — CPI and LITCOIN prices
- `agent.snapshot()` — Full protocol state

---

## Full API Endpoint Reference

### Mining & Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /v1/auth/nonce | Get nonce for wallet signature |
| POST | /v1/auth/verify | Verify signature, get bearer token |
| GET | /v1/challenge | Request mining challenge (needs auth) |
| POST | /v1/submit | Submit artifact (needs auth) |
| GET | /v1/balance?wallet=0x... | Check LITCOIN balance and claimable |
| GET | /v1/boost?wallet=0x... | Check staking boost |
| GET | /v1/miner/status?wallet=0x... | Comprehensive miner status |
| GET | /v1/stats | Global mining statistics |
| GET | /v1/miners | Active miner list |

### Research
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /v1/research/tasks | List active research tasks |
| GET | /v1/research/task/:id | Task details |
| POST | /v1/research/submit | Submit research solution (returns 202) |
| GET | /v1/research/submission-status/:id | Poll submission result |
| GET | /v1/research/leaderboard | Top researchers |
| GET | /v1/research/stats | Global research stats |
| GET | /v1/research/history?miner=0x... | Your submissions |
| GET | /v1/research/block | Current verification block |
| GET | /v1/research/results | Recent results |

### Bankr DeFi (POST, bankrKey in body)
| Endpoint | Description | Extra params |
|----------|-------------|-------------|
| /v1/bankr/balance | All positions + lock status | — |
| /v1/bankr/stake | Stake tier 1-4 | `tier` |
| /v1/bankr/unstake | Normal unstake | — |
| /v1/bankr/early-unstake | Early unstake with penalty | `confirm` |
| /v1/bankr/vault/open | Open vault | `amount` |
| /v1/bankr/vault/add-collateral | Add collateral | `vaultId`, `amount` |
| /v1/bankr/vault/mint | Mint LITCREDIT | `vaultId`, `amount` |
| /v1/bankr/vault/repay | Repay debt | `vaultId` |
| /v1/bankr/vault/close | Close vault | `vaultId` |
| /v1/bankr/vault/details | Vault details | — |
| /v1/bankr/guild/join | Join guild | `guildId`, `amount` |
| /v1/bankr/guild/leave | Leave guild | — |
| /v1/bankr/guild/unstake | Unstake guild | `guildId` |
| /v1/claims/bankr/resolve | Claim rewards | — |

### Agent
| Endpoint | Description |
|----------|-------------|
| POST /v1/agent/deploy | Deploy autonomous agent |
| POST /v1/agent/stop | Stop agent |
| POST /v1/agent/config | Update agent settings |
| GET /v1/agents | List all agents |
| GET /v1/agent/:id | Agent details |
| GET /v1/agent/activity | Global activity feed |

### Protocol
| Endpoint | Description |
|----------|-------------|
| GET /v1/health | Coordinator health (use as first diagnostic) |
| GET /v1/protocol/stats | Cached on-chain stats |
| GET /v1/token | Token address and info |
| GET /v1/oracle/status | Oracle prices |
| POST /v1/oracle/update | Update oracle (admin) |

---

## Bankr Interaction Rules

**Natural language** (via `POST /agent/prompt`) — ONLY for:
- Buying LITCOIN: `"swap $10 of ETH to 0x316ffb9c875f900AdCF04889E415cC86b564EBa3 on base"`
- Checking balances: `"what are my balances on base?"`
- Bridging ETH for gas: `"bridge $X of ETH to base"`

**Bankr DeFi endpoints** (via coordinator) — for ALL DeFi operations:
- Staking, unstaking, early unstake
- Vault operations (open, add collateral, mint, repay, close)
- Guild operations (join, leave, unstake)
- Claiming rewards

**NEVER** use natural language prompts for contract interactions. The coordinator handles all TX encoding and confirmation.

**Rate limit**: 1 DeFi operation per wallet per 30 seconds. Every transaction waits for on-chain confirmation before responding.

---

## Error Handling

### Coordinator Errors (retry with backoff)

**Backoff strategy**: Retry on `429`, `5xx`, network timeouts. Backoff: `2s, 4s, 8s, 16s, 30s, 60s` (cap 60s). Add 0-25% jitter. Stop after 5 attempts; surface clear error to user.

**Per endpoint:**

| Endpoint | 429 | 401 | 403 | 404 | 5xx |
|----------|-----|-----|-----|-----|-----|
| POST /v1/auth/nonce | Retry with backoff | — | — | — | Retry |
| POST /v1/auth/verify | Retry, max 3 per session | Fresh nonce + re-sign | Stop (forbidden) | — | Retry |
| GET /v1/challenge | Retry | Re-auth, then retry | Stop (insufficient balance) | — | Retry |
| POST /v1/submit | Retry | Re-auth, retry same solve | Stop | Stale challenge — fetch new | Retry |
| POST /v1/research/submit | Retry | Re-auth | Stop | — | Retry |
| Bankr DeFi endpoints | Wait 30s, retry | Invalid key — stop | Key lacks write — stop | — | Retry |

### Mining Errors

| Error | Action |
|-------|--------|
| `pass: false` on submit | Request NEW challenge with different nonce. Do NOT retry same challenge. |
| Nonce mismatch | Ensure you're sending the same nonce from the challenge request. |
| Auth token expired | Re-auth (nonce → sign → verify), then retry. |
| Daily emission cap reached | Reward returns 0. Stop mining for this cycle, try again later. |
| Insufficient balance (< 5M) | Use faucet or buy more LITCOIN via Bankr. |
| Challenge rate limit (10/min) | Slow down. Wait before requesting next challenge. |

### Research Errors

| Error | Action |
|-------|--------|
| Submission returns 202 | Normal — poll `/v1/research/submission-status/:id` until complete. |
| Submission timeout (>600s) | Sandbox may be backed up. Try again later. |
| Verification failed | Code didn't beat baseline, or errored in sandbox. Review and iterate. |
| No active tasks | All tasks may be retired. Check back later. |
| Task not found (404) | Task was retired. Use `/v1/research/tasks` for current list. |

### Staking Errors

| Error | Action |
|-------|--------|
| Stake locked | Lock hasn't expired. Use early unstake (with penalty) or wait. Error includes days remaining. |
| Insufficient balance | Need more LITCOIN for the requested tier. |
| Already staked at higher tier | No action needed — you're already above the requested tier. |
| Rate limited | Wait 30 seconds between DeFi operations. |

### Vault Errors

| Error | Action |
|-------|--------|
| Max mintable exceeded | Reduce mint amount. Response includes `maxMintable` value. |
| Vault has debt (on close) | Repay all debt first, then close. Buy LITCREDIT on Aerodrome if needed. |
| Overpayment reverted | Do NOT use floating point for debt amounts. Coordinator uses exact BigInt wei. |
| TX reverted after repay | Node sync delay — retry after 5 seconds. Vault close includes auto-retry. |

### Bankr API Errors

| Error | Action |
|-------|--------|
| 401 from Bankr | Invalid API key. Stop, tell user to check `BANKR_API_KEY`. |
| 403 from Bankr | Key lacks write/agent access. Stop, tell user to enable at bankr.bot/api. |
| 429 from Bankr | Rate limited. Wait 60 seconds and retry. |
| TX failed | Log error, retry once. If fails again, stop and report. |

### LLM Provider Errors (research mining only)

| Error | Action |
|-------|--------|
| 401/403 from LLM API | Stop. Tell user to check AI API key. |
| Budget/billing errors | Stop. Tell user LLM credits are exhausted. |
| 429 from LLM API | Wait 30-60 seconds, retry. |
| 5xx from LLM API | Wait 30 seconds, retry up to 2 times. |
| Timeout (>5 min) | Abort, retry. If timeout twice, stop. |

**Do NOT loop indefinitely.** Each research attempt costs LLM credits. After 5+ consecutive failures across different challenges/tasks, stop and inform the user.

---

## Concurrency Rules

- Max 1 in-flight auth handshake per wallet
- Max 1 in-flight challenge request per wallet
- Max 1 in-flight submit per wallet
- Max 1 DeFi operation per wallet per 30 seconds
- Do not run parallel mining loops on the same wallet
- No tight loops — add reasonable delays between operations

---

## Key Protocol Info

- **Chain**: Base mainnet (8453)
- **Token**: `0x316ffb9c875f900AdCF04889E415cC86b564EBa3` (100B supply, 18 decimals)
- **Coordinator**: `https://api.litcoiin.xyz`
- **SDK**: v4.6.0 on PyPI (`pip install litcoin`)
- **MCP Server**: `npx litcoin-mcp` (29 tools, v2.1.0)
- **Emission**: 1.5% of treasury per day (~34.4M LITCOIN)
- **Pool split**: 65% research / 10% comprehension / 25% staking
- **1 LITCREDIT** = 1,000 output tokens of frontier AI inference (compute-pegged stablecoin)
- **Site**: https://litcoiin.xyz
- **Research Lab**: https://litcoiin.xyz/research
- **Docs**: https://litcoiin.xyz/docs

## Three Ways to Connect

| Method | Command | Best For |
|--------|---------|----------|
| Python SDK | `pip install litcoin` | Developers, autonomous agents, scripts |
| MCP Server | `npx litcoin-mcp` (29 tools) | Claude Desktop, Cursor, any MCP agent |
| Agent Skill | ClawHub or GitHub | Hermes Agent, OpenClaw, coding agents |
| OpenAI API | `base_url=https://api.litcoiin.xyz/v1` | Any OpenAI-compatible client |

## Full Flywheel Example

```python
from litcoin import Agent

agent = Agent(bankr_key="bk_...", ai_key="sk-...")

agent.mine(rounds=20)                    # Comprehension mine
agent.research_loop(rounds=10)           # Research mine
agent.claim()                            # Claim on-chain
agent.stake(2)                           # Stake into Circuit tier (1.25x boost)
agent.open_vault(10_000_000)             # Open vault with 10M collateral
vaults = agent.vault_ids()
agent.mint_litcredit(vaults[0], 500)     # Mint 500 LITCREDIT
agent.deposit_escrow(100)                # Deposit to escrow for compute
result = agent.compute("Explain proof of research")
print(result['response'])
```
