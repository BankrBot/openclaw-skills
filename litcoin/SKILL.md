---
name: litcoin-miner
description: "Mine LITCOIN — a proof-of-comprehension and proof-of-research cryptocurrency on Base. Use when the user wants to mine crypto with AI, earn tokens through reading comprehension or solving optimization problems, stake LITCOIN, open vaults, mint LITCREDIT, manage mining guilds, deploy autonomous agents, or interact with the LITCOIN DeFi protocol."
license: MIT-0
compatibility: "Requires Python 3.9+ and pip. Network access to api.litcoiin.xyz."
homepage: "https://litcoiin.xyz"
metadata:
  author: tekkaadan
  version: "2.0.0"
  openclaw:
    requires:
      env: ["BANKR_API_KEY"]
      primaryEnv: "BANKR_API_KEY"
  clawdbot:
    requires:
      env: ["BANKR_API_KEY"]
      primaryEnv: "BANKR_API_KEY"
  hermes:
    tags: [crypto, mining, defi, ai-agent, base, research, staking]
    category: crypto
---

# LITCOIN Miner

Mine $LITCOIN on Base (chain 8453) using the Python SDK. Two mining paths: comprehension mining (no LLM needed) and research mining (LLM generates optimized code, tested in sandbox, verified on-chain).

**Requirements:** Python 3.9+, a Bankr API key from [bankr.bot/api](https://bankr.bot/api) with agent write access enabled, and a small amount of ETH on Base for gas.

## Install

```python
# PyPI package: https://pypi.org/project/litcoin/
pip install litcoin
```

## Quick Start — Comprehension Mining

No LLM or AI key needed. The SDK's deterministic solver parses documents without LLM calls.

```python
from litcoin import Agent

agent = Agent(bankr_key="bk_YOUR_KEY")

# Bootstrap free tokens (one-time, 5M LITCOIN)
agent.faucet()

# Mine 10 rounds
agent.mine(rounds=10)

# Claim rewards on-chain
agent.claim()
```

## Quick Start — Research Mining

Requires an AI API key. The LLM generates experiment code, the SDK tests it locally, and submits only if it beats the baseline. The coordinator verifies every submission by re-running the code in a sandbox.

```python
agent = Agent(
    bankr_key="bk_YOUR_KEY",
    ai_key="sk-or-v1-YOUR_KEY",    # OpenRouter recommended. Or use Bankr LLM (see below)
    ai_url="https://openrouter.ai/api/v1",
    model="google/gemini-2.5-flash",
)

# Single research cycle
result = agent.research_mine()

# Iterate on one task (this is where breakthroughs happen)
agent.research_loop(task_id="sort-benchmark-001", rounds=50, delay=30)

# List available tasks (20 tasks across algorithm, mathematics, bioinformatics)
tasks = agent.research_tasks()
```

### Using Bankr LLM (no extra API key)

Your Bankr key doubles as an LLM API key:

```python
agent = Agent(
    bankr_key="bk_YOUR_KEY",
    ai_key="bk_YOUR_KEY",
    ai_url="https://llm.bankr.bot/v1",
)
agent.research_mine()
```

## Staking (Mining Boost)

Staking increases your mining rewards:

| Tier | Name | Stake | Lock | Boost |
|------|------|-------|------|-------|
| 1 | Spark | 1M | 7d | 1.10x |
| 2 | Circuit | 5M | 30d | 1.25x |
| 3 | Core | 50M | 90d | 1.50x |
| 4 | Architect | 500M | 180d | 2.00x |

```python
agent.stake(tier=2)              # Stake into Circuit
agent.stake_info()               # Check tier and lock status
agent.unstake()                  # After lock expires
agent.early_unstake(confirm=False)  # Preview penalty
agent.early_unstake(confirm=True)   # Execute with penalty
```

## Vaults and LITCREDIT

Open vaults with LITCOIN collateral, mint LITCREDIT (compute-pegged stablecoin: 1 LITCREDIT = 1,000 output tokens of frontier AI).

```python
agent.open_vault(10_000_000)             # Deposit 10M LITCOIN
vaults = agent.vault_ids()
agent.mint_litcredit(vaults[0], 500)     # Mint 500 LITCREDIT
agent.repay_debt(vaults[0], 500)         # Repay debt
agent.add_collateral(vaults[0], 5_000_000)  # Strengthen vault
agent.close_vault(vaults[0])             # Close vault
agent.vault_health(vaults[0])            # Check collateral ratio
```

## Guilds

Pool resources with other miners for shared staking boost:

```python
agent.join_guild(guild_id=1, amount=5_000_000)
agent.guild_membership()
agent.leave_guild()
agent.stake_guild(tier=2)        # Leader only
agent.unstake_guild()            # Leader only
```

## Compute Marketplace

Spend LITCREDIT on AI inference served by relay miners:

```python
agent.deposit_escrow(100)
result = agent.compute("Explain proof of research")
print(result['response'])
```

## Full Flywheel Example

```python
from litcoin import Agent

agent = Agent(bankr_key="bk_...", ai_key="sk-...")

agent.mine(rounds=20)                    # Comprehension mine
agent.research_loop(rounds=10)           # Research mine
agent.claim()                            # Claim on-chain
agent.stake(2)                           # Circuit tier (1.25x boost)
agent.open_vault(10_000_000)             # Vault with 10M collateral
vaults = agent.vault_ids()
agent.mint_litcredit(vaults[0], 500)     # Mint 500 LITCREDIT
agent.deposit_escrow(100)                # Fund compute
result = agent.compute("Summarize this document")
print(result['response'])
```

## Full SDK Reference

### Mining
- `mine(rounds=None)` — Comprehension mine (None = infinite loop)
- `claim()` — Claim rewards on-chain
- `status()` — Check earnings and claimable balance
- `faucet()` — Bootstrap 5M LITCOIN (one-time)
- `balance()` — LITCOIN + LITCREDIT balances

### Research Mining
- `research_mine(task_type, task_id)` — Single research cycle
- `research_loop(task_type, task_id, rounds, delay)` — Iterate on one task
- `research_tasks(task_type)` — List active tasks
- `research_leaderboard(task_id)` — Top researchers
- `research_stats()` — Global stats
- `research_history(task_id)` — Your submissions

### Staking
- `stake(tier)` — Stake tier 1-4 (auto-approves)
- `unstake()` — Unstake after lock expires
- `early_unstake(confirm)` — Preview/execute early unstake with penalty
- `upgrade_tier(new_tier)` — Upgrade to higher tier
- `stake_info()` — Tier, amount, lock status
- `time_until_unlock()` — Seconds until lock expires

### Vaults
- `open_vault(collateral)` — Open vault with LITCOIN
- `mint_litcredit(vault_id, amount)` — Mint LITCREDIT (0.5% fee)
- `repay_debt(vault_id, amount)` — Repay debt
- `add_collateral(vault_id, amount)` — Add collateral
- `close_vault(vault_id)` — Close vault
- `vault_ids()` — List your vaults
- `vault_health(vault_id)` — Collateral ratio

### Compute
- `deposit_escrow(amount)` — Deposit LITCREDIT
- `compute(prompt)` — AI inference via relay network

### Guilds
- `create_guild(name)` — Create guild
- `join_guild(guild_id, amount)` — Join with deposit
- `leave_guild()` — Leave guild
- `stake_guild(tier)` — Stake pool (leader)
- `unstake_guild()` — Unstake pool (leader)
- `guild_membership()` — Your guild info

### Read State
- `balance()` — LITCOIN + LITCREDIT
- `oracle_prices()` — CPI and LITCOIN prices
- `snapshot()` — Full protocol state

## Error Handling

The SDK raises exceptions with clear messages:

| Error | Fix |
|-------|-----|
| Insufficient balance | Use `faucet()` or buy more LITCOIN |
| Stake locked | Use `early_unstake()` or wait for lock to expire |
| Not staked | Call `stake(tier)` first |
| Daily cap reached | Wait, mining rewards reset daily |
| Max mintable exceeded | Reduce mint amount |
| Vault has debt | Call `repay_debt()` before closing |
| Rate limited | Wait 30 seconds between DeFi operations |

## Key Info

- Chain: Base mainnet (8453)
- Token: `0x316ffb9c875f900AdCF04889E415cC86b564EBa3`
- SDK: v4.7.0 on [PyPI](https://pypi.org/project/litcoin/)
- MCP Server: `npx litcoin-mcp` (43 tools)
- Emission: 1.5%/day (~34.4M LITCOIN)
- 1 LITCREDIT = 1,000 output tokens of frontier AI
- Docs: https://litcoiin.xyz/docs
- Source: https://litcoiin.xyz
