---
name: litcoin-miner
description: "Mine LITCOIN — a proof-of-comprehension cryptocurrency on Base. Use when the user wants to mine crypto with AI, earn tokens through reading comprehension, stake LITCOIN, open vaults, mint LITCREDIT (compute-pegged stablecoin), manage mining guilds, deposit to compute escrow, or interact with the LITCOIN DeFi protocol. Also use when the user asks about proof-of-comprehension mining, AI agent DeFi, or compute-pegged stablecoins."
---

# LITCOIN Miner Skill

Mine $LITCOIN by solving reading comprehension challenges on Base. Full DeFi protocol access: mine, claim, stake, vault, mint LITCREDIT, compute, guilds.

## Install the SDK

```bash
pip install litcoin
```

## Quick Start

```python
from litcoin import Agent

agent = Agent(
    bankr_key="bk_YOUR_KEY",        # Required — get at bankr.bot/api
    ai_key="sk-YOUR_KEY",           # Optional — enables relay mining (+33% rewards)
    ai_url="https://api.venice.ai/api/v1",
    model="llama-3.3-70b",
)

# Mine (relay auto-starts if ai_key set)
agent.mine(rounds=10)

# Claim rewards on-chain
agent.claim()
```

The user needs a Bankr API key from https://bankr.bot/api and some ETH on Base for gas. New wallets with zero balance can use the faucet: `agent.faucet()` gives 5M LITCOIN free (one-time).

## What This Skill Covers

When the user asks to mine LITCOIN, walk them through setup:

1. **Install**: `pip install litcoin`
2. **Get keys**: Bankr API key from bankr.bot/api. Optionally an AI provider key (Venice, OpenAI, Groq) for relay mining.
3. **Run**: Create an Agent and call `agent.mine()`
4. **Claim**: Call `agent.claim()` to get tokens on-chain

## Full Protocol Methods

For detailed method reference, read `references/protocol.md`.

### Mining & Relay
- `agent.mine(rounds=0)` — Mine forever (0) or N rounds
- `agent.claim()` — Claim rewards on-chain
- `agent.status()` — Check earnings
- `agent.faucet()` — Bootstrap 5M LITCOIN (one-time)

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
- `agent.leave_guild()` — Leave guild

### Read State
- `agent.balance()` — LITCOIN + LITCREDIT balances
- `agent.oracle_prices()` — CPI and LITCOIN prices
- `agent.snapshot()` — Full protocol state in one call

## Full Flywheel Example

```python
from litcoin import Agent

agent = Agent(bankr_key="bk_...", ai_key="sk-...")

agent.mine(rounds=20)           # Mine tokens
agent.claim()                    # Claim on-chain
agent.stake(2)                   # Stake into Circuit tier
agent.open_vault(10_000_000)     # Open vault with 10M collateral
vaults = agent.vault_ids()       # Get vault ID
agent.mint_litcredit(vaults[0], 500)  # Mint 500 LITCREDIT
agent.deposit_escrow(100)        # Deposit to escrow
result = agent.compute("Explain proof of comprehension")
print(result['response'])
```

## Key Info

- Chain: Base mainnet (8453)
- Token: `0x316ffb9c875f900AdCF04889E415cC86b564EBa3`
- 1 LITCREDIT = 1,000 output tokens of frontier AI inference
- SDK: v3.2.1 on PyPI
- MCP Server: `npx litcoin-mcp` (npm) — add to any MCP config for full protocol access
- Docs: https://litcoiin.xyz/docs.md
- Site: https://litcoiin.xyz
