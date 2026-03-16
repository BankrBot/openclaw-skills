---
name: litcoin-miner
description: "Mine LITCOIN — a proof-of-comprehension and proof-of-research cryptocurrency on Base. Use when the user wants to mine crypto with AI, earn tokens through reading comprehension or solving optimization problems, stake LITCOIN, open vaults, mint LITCREDIT (compute-pegged stablecoin), manage mining guilds, run autonomous research experiments, deploy agents, or interact with the LITCOIN DeFi protocol. Also use when the user asks about proof-of-comprehension mining, proof-of-research, AI agent DeFi, or compute-pegged stablecoins."
license: MIT-0
compatibility: "Requires Python 3.9+, pip, and network access to api.litcoiin.xyz. Optional: websocket-client for relay mining."
homepage: "https://litcoiin.xyz"
metadata:
  author: tekkaadan
  version: "1.1.0"
  clawdbot:
    requires:
      env: ["BANKR_API_KEY"]
      primaryEnv: "BANKR_API_KEY"
  hermes:
    tags: [crypto, mining, defi, ai-agent, base, research]
    category: crypto
---

# LITCOIN Miner Skill

Mine $LITCOIN by solving reading comprehension challenges OR real optimization problems on Base. Full DeFi protocol access: mine, research, claim, stake, vault, mint LITCREDIT, compute, guilds, launchpad.

## Install the SDK

```bash
pip install litcoin
```

## Quick Start — Comprehension Mining

```python
from litcoin import Agent

agent = Agent(
    bankr_key="bk_YOUR_KEY",        # Required — get at bankr.bot/api
    ai_key="sk-YOUR_KEY",           # Optional — enables relay + research mining
    ai_url="https://api.venice.ai/api/v1",
    model="llama-3.3-70b",
)

# Mine (relay auto-starts if ai_key set)
agent.mine(rounds=10)

# Claim rewards on-chain
agent.claim()
```

## Quick Start — Research Mining

```python
# Single research cycle — solve a real optimization problem
result = agent.research_mine(task_type="code_optimization")

# Iterate on one task (Karpathy-style — this is where breakthroughs happen)
agent.research_loop(task_id="sort-benchmark-001", rounds=50, delay=30)

# View your iteration history
history = agent.research_history(task_id="sort-benchmark-001")

# List available tasks
tasks = agent.research_tasks()
```

Research mining requires `ai_key` — the LLM generates experiment code, tests locally, submits if it beats the baseline. The coordinator verifies every submission by re-running the code.

The user needs a Bankr API key from https://bankr.bot/api and some ETH on Base for gas. New wallets with zero balance can use the faucet: `agent.faucet()` gives 5M LITCOIN free (one-time).

## Use LITCOIN as Your LLM Provider (Hermes Agent Compatible)

LITCOIN's relay network works as a drop-in OpenAI replacement. Relay miners serve inference using their own API keys — you pay with LITCREDIT, they earn LITCOIN.

**For Hermes Agent users** — set LITCOIN as your custom endpoint:

```bash
# In ~/.hermes/.env
OPENAI_BASE_URL=https://api.litcoiin.xyz/v1
OPENAI_API_KEY=lk_YOUR_KEY
```

Or with `hermes config`:
```bash
hermes config set OPENAI_BASE_URL https://api.litcoiin.xyz/v1
hermes config set OPENAI_API_KEY lk_YOUR_KEY
```

**For any OpenAI-compatible client** (LangChain, LiteLLM, Cursor, OpenClaw):
- Base URL: `https://api.litcoiin.xyz/v1`
- Auth: API key (`lk_`), `X-Wallet` header + LITCREDIT balance, or free tier (5 req/hr)
- Endpoints: `POST /v1/chat/completions`, `GET /v1/models`
- Streaming, tools, multi-turn all supported
- Target specific relays with `"provider": "0xabc..."` in request body

## Autonomous Mining with Cron (Hermes Agent)

If running inside Hermes Agent, you can set up autonomous mining on a schedule:

```
# Tell Hermes to mine every 2 hours:
/cron add "0 */2 * * *" "Run 10 rounds of LITCOIN comprehension mining, then 5 research iterations on the best available task. Claim if claimable > 100K."
```

Or manually via the SDK in a cron job:
```python
from litcoin import Agent
agent = Agent(bankr_key="bk_...", ai_key="sk-...")
agent.mine(rounds=10)
agent.research_loop(rounds=5, delay=30)
status = agent.status()
if status.get("claimable", 0) > 100000:
    agent.claim()
```

## What This Skill Covers

When the user asks to mine LITCOIN, walk them through setup:

1. **Install**: `pip install litcoin`
2. **Get keys**: Bankr API key from bankr.bot/api. AI provider key (Bankr LLM Gateway, OpenAI, Groq for relay + research mining.
3. **Run**: Create an Agent and call `agent.mine()` for comprehension or `agent.research_loop()` for research
4. **Claim**: Call `agent.claim()` to get tokens on-chain

## Full Protocol Methods

### Mining & Relay
- `agent.mine(rounds=0)` — Comprehension mine forever (0) or N rounds
- `agent.claim()` — Claim rewards on-chain
- `agent.status()` — Check earnings
- `agent.faucet()` — Bootstrap 5M LITCOIN (one-time)

### Research Mining (Proof-of-Research)
- `agent.research_mine(task_type=None, task_id=None)` — Single research cycle
- `agent.research_loop(task_type=None, task_id=None, rounds=10, delay=30)` — Iterate on one task
- `agent.research_tasks(task_type=None)` — List available research tasks
- `agent.research_leaderboard(task_id=None)` — Top researchers by reward
- `agent.research_stats()` — Global research statistics
- `agent.research_history(task_id=None)` — Your iteration history per task

Task types: code_optimization, algorithm, ml_training, prompt_engineering, data_science

### Staking (4 tiers: Spark/Circuit/Core/Architect)
- `agent.stake(tier)` — Stake into tier 1-4 (auto-approves tokens)
- `agent.unstake()` — Unstake after lock expires
- `agent.upgrade_tier(new_tier)` — Upgrade to higher tier
- `agent.stake_info()` — Current tier, amount, lock status

### Vaults (MakerDAO-style CDPs)
- `agent.open_vault(collateral)` — Open vault with LITCOIN collateral
- `agent.mint_litcredit(vault_id, amount)` — Mint LITCREDIT stablecoin
- `agent.repay_debt(vault_id, amount)` — Repay debt
- `agent.add_collateral(vault_id, amount)` — Add more collateral
- `agent.withdraw_collateral(vault_id, amount)` — Withdraw collateral
- `agent.close_vault(vault_id)` — Close vault
- `agent.vault_ids()` — List your vaults
- `agent.vault_health(vault_id)` — Check collateral ratio

### Compute Marketplace
- `agent.deposit_escrow(amount)` — Deposit LITCREDIT for AI compute
- `agent.compute(prompt)` — Use AI inference via relay network

### Mining Guilds
- `agent.create_guild(name)` — Create a guild
- `agent.join_guild(guild_id, amount)` — Join with deposit
- `agent.add_guild_deposit(amount)` — Add more to pool
- `agent.leave_guild()` — Leave guild (withdraws from buffer)
- `agent.stake_guild(tier)` — Stake full pool at tier (leader only)
- `agent.upgrade_guild_tier(tier)` — Upgrade tier (leader only)
- `agent.unstake_guild()` — Unstake after lock (leader only)
- `agent.guild_membership()` — Your guild info

### Read State
- `agent.balance()` — LITCOIN + LITCREDIT balances
- `agent.oracle_prices()` — CPI and LITCOIN prices
- `agent.snapshot()` — Full protocol state in one call

## Full Flywheel Example

```python
from litcoin import Agent

agent = Agent(bankr_key="bk_...", ai_key="sk-...")

agent.mine(rounds=20)           # Comprehension mine
agent.research_loop(rounds=10)  # Research mine
agent.claim()                    # Claim on-chain
agent.stake(2)                   # Stake into Circuit tier
agent.open_vault(10_000_000)     # Open vault with 10M collateral
vaults = agent.vault_ids()       # Get vault ID
agent.mint_litcredit(vaults[0], 500)  # Mint 500 LITCREDIT
agent.deposit_escrow(100)        # Deposit to escrow
result = agent.compute("Explain proof of research")
print(result['response'])
```

## Three Ways to Connect

| Method | Command | Best For |
|--------|---------|----------|
| Python SDK | `pip install litcoin` | Developers, autonomous agents, scripts |
| MCP Server | `npx litcoin-mcp` (29 tools) | Claude Desktop, Cursor, any MCP agent |
| Agent Skill | ClawHub or GitHub | Hermes Agent, OpenClaw, coding agents |
| OpenAI API | `base_url=https://api.litcoiin.xyz/v1` | Any OpenAI-compatible client |

## Key Info

- Chain: Base mainnet (8453)
- Token: `0x316ffb9c875f900AdCF04889E415cC86b564EBa3`
- 1 LITCREDIT = 1,000 output tokens of frontier AI inference
- SDK: v4.6.0 on PyPI
- MCP Server: `npx litcoin-mcp` (npm, v2.1.0) — 29 tools including 6 research tools
- Docs: https://litcoiin.xyz/docs
- Research Lab: https://litcoiin.xyz/research
- Statistics: https://litcoiin.xyz/stats
- Site: https://litcoiin.xyz

## Coordinator Internals (for advanced context)

- Research rewards use `creditReward(wallet, amount, label)` — a pre-calculated reward function. NOT `addReward()` which is for comprehension mining only.
- Agent stop requires ownership proof: Bankr API key resolves to wallet, must match agent's wallet. 5 auth methods total.
- All data persists to Upstash Redis. Claims, research submissions, bounties, and agent state survive coordinator redeploys.
- Emission: 1.5% of treasury/day. Pool split: 65% research, 10% comprehension, 25% staking. Pools are independent.
- Research uses block-based verification: 5-min blocks, pipelined (N+1 collects while N verifies), 3 concurrent sandboxes, no participation rewards.
- Research submissions return 202 (accepted). Poll `/v1/research/submission-status/:id` for result. SDK timeout: 600s.
- Guild staking uses V3 keyed positions: `stakeKeyed(guildId, tier, amount)`. Multiple guilds stake independently.
- Guild yield: coordinator detects guild keyed positions, splits staking yield to members proportionally by deposit share every 30 min.
- Boost logic: `max(personalBoost, guildBoost)` — takes the higher, not personal-first.
- Research uses pool-share reward model (pool / totalDailySubmissions), capped at 3x comprehension rate.
