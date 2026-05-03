---
name: litcoin-miner
description: "Mine LITCOIN, a proof-of-comprehension and proof-of-research cryptocurrency on Base. Use when the user wants to mine crypto with AI, earn tokens through reading comprehension or solving optimization problems, stake LITCOIN, open vaults, mint LITCREDIT, manage mining guilds, deploy autonomous agents, or interact with the LITCOIN DeFi protocol."
license: MIT-0
compatibility: "Requires Python 3.9+ and pip. Network access to api.litcoin.app."
metadata:
  author: tekkaadan
  version: "2.2.0"
  homepage: "https://litcoin.app"
  repository: "https://github.com/tekkaadan/litcoin-skill"
  tags: [crypto, mining, defi, ai-agent, base, research, staking, litcoin]
  hermes:
    tags: [crypto, mining, defi, ai-agent, base, research, staking]
    required_environment_variables:
      - name: BANKR_API_KEY
        prompt: "Paste your Bankr API key (starts with 'bk_'). Get one at https://bankr.bot/api with agent write access enabled."
        help: "Controls the on-chain wallet used for mining, claims, staking, and vault operations."
        required_for: [mining, claims, staking, vaults, compute]
  openclaw:
    requires:
      env: ["BANKR_API_KEY"]
      primaryEnv: "BANKR_API_KEY"
  clawdbot:
    requires:
      env: ["BANKR_API_KEY"]
      primaryEnv: "BANKR_API_KEY"
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

# List available tasks (20 adapters: code_optimization, algorithm, pattern_recognition, software_engineering,
# bioinformatics, mathematics, compression, security-audit, red-team, proof-of-verification,
# knowledge-synthesis, exploit-forensics, adversarial-robustness, agentic-trace,
# tcg-card-profile, tcg-sentiment, and more)
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

Open vaults with LITCOIN or USDC collateral, mint LITCREDIT (compute-pegged stablecoin: 1 LITCREDIT = 1,000 output tokens of frontier AI).
LITCOIN vaults: tier-based ratios (150-250%), 0.5% minting fee.
USDC vaults: fixed 105% ratio, 0.25% minting fee, 500K LITCREDIT ceiling. No staking needed.

```python
agent.open_vault(10_000_000)             # LITCOIN vault (V1)
agent.open_vault_v2("usdc", 1000)        # USDC vault — $1,000 at 105%
agent.open_vault_v2("litcoin", 10_000_000)  # LITCOIN vault (V2)
vaults = agent.vault_ids()
token = agent.get_vault_token(vaults[0]) # Returns token address
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

## TCG Intelligence

Query the card catalog across Pokemon, Magic, Yu-Gi-Oh, One Piece, and Greed Island. 800K+ cards indexed with live pricing and community sentiment.

```python
# Catalog stats
stats = agent.tcg_stats()

# Search by game, rarity, sort by price
holos = agent.tcg_search(game="pokemon", rarity="Holo Rare", sort="price-desc", limit=10)

# Single card details + latest price
card = agent.tcg_card("pokemon", "base1", "4")  # Base set Charizard

# 90-day price history for one card
history = agent.tcg_price_history("pokemon", "base1", "4", days=90)

# Currently trending cards
trending = agent.tcg_trending(game="mtg", days=7, limit=20)

# Live prices for top-value cards (refreshed every 30 minutes)
live = agent.tcg_prices_live()
```

## Full Flywheel Example

```python
from litcoin import Agent

agent = Agent(bankr_key="bk_...", ai_key="sk-...")

agent.mine(rounds=20)                    # Comprehension mine
agent.research_loop(rounds=10)           # Research mine
agent.claim()                            # Claim on-chain
agent.stake(2)                           # Circuit tier (1.25x boost)
agent.open_vault(10_000_000)             # LITCOIN vault with 10M collateral
agent.open_vault_v2("usdc", 1000)        # Or USDC vault with $1,000
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
- `open_vault(collateral)` — Open vault with LITCOIN (V1)
- `open_vault_v2(token, amount)` — Open vault with LITCOIN or USDC (V2)
- `get_vault_token(vault_id)` — Get collateral type for a vault
- `mint_litcredit(vault_id, amount)` — Mint LITCREDIT (0.5% LITCOIN / 0.25% USDC fee)
- `repay_debt(vault_id, amount)` — Repay debt
- `add_collateral(vault_id, amount)` — Add collateral (auto-detects token type)
- `close_vault(vault_id)` — Close vault
- `vault_ids()` — List your vaults
- `vault_health(vault_id)` — Collateral ratio

### Compute
- `deposit_escrow(amount)` - Deposit LITCREDIT
- `compute(prompt)` - AI inference via relay network

### TCG Intelligence
- `tcg_stats()` - Catalog stats across all five games
- `tcg_search(game, query, set_code, rarity, sort, limit, offset)` - Search cards (sort: name, number, rarity, price-desc, price-asc, recent)
- `tcg_card(game, set_code, card_number)` - Full card details + latest price
- `tcg_price_history(game, set_code, card_number, days)` - Daily price history (up to 365 days)
- `tcg_trending(game, days, limit)` - Trending cards by price momentum + sentiment
- `tcg_prices_live()` - Live prices for top-value cards across all games

### Guilds
- `create_guild(name)` — Create guild
- `join_guild(guild_id, amount)` — Join with deposit
- `leave_guild()` — Leave guild
- `stake_guild(tier)` — Stake pool (leader)
- `unstake_guild()` — Unstake pool (leader)
- `guild_membership()` — Your guild info

### Delegation (Liquidity → Production)
Direct your already-staked LITCOIN at one of six research archetypes
(Enhancer, Transmuter, Conjurer, Specialist, Manipulator, Emitter). Backed
miners get a boost; you earn commission on what they produce. Funds never
move — your principal stays in the staking contract. Tier-weighted power:
Spark 1x, Circuit 2x, Core 4x, Architect 8x.

Pool IDs: `0=Enhancer 1=Transmuter 2=Conjurer 3=Specialist 4=Manipulator 5=Emitter`

- `delegate(allocations)` — Sign + record delegation. Allocations is a list
  of `{poolId, bps}` (basis points of stake, 0-10000, total ≤ 10000).
  Example: `agent.delegate([{"poolId": 4, "bps": 10000}])` (100% to Manipulator)
  Split: `agent.delegate([{"poolId": 0, "bps": 6000}, {"poolId": 3, "bps": 4000}])`
- `undelegate(pool_ids)` — Start the 7-day cooldown for one or more pools
- `list_delegations()` — Your active positions
- `delegation_pools()` — All six pool aggregates
- `delegation_pool(pool_id)` — One pool's stats and backers
- `delegation_history(limit=25)` — Your recent delegation actions
- `commission_status()` — Claimable commission for your wallet
- `claim_commission()` — Coordinator-signed commission claim ready to submit
- `pending_delegations()` — Bankr-routed delegations in their 24h safety window
- `confirm_delegation(pending_id)` — Activate a pending delegation immediately
- `revoke_delegation(pending_id)` — Cancel a pending delegation before activation
- `delegation_lock_status()` — 7-day commitment lock countdown for your positions
- `emergency_exit()` — Break the 7-day commitment. Penalty: 14 days of staking yield, routed to research mining pool. Principal untouched.
- `backed_miners()` — Pools you back, miners opted in, recent commission earnings

**Delegation safety system.** Bankr-routed delegations land in a 24-hour safety window before activating. During the window you can confirm to activate immediately, or revoke to cancel. After 24h with no action, the delegation auto-activates. Telegram notifications fire if you've bound a chat. Rate limit: max 3 Bankr-routed delegation changes per wallet per 24h. Amount cap: a single change cannot move more than 50% of stake-power. The safety system applies ONLY to Bankr-routed paths. Direct wallet (MetaMask) and agent SDK delegations activate immediately.

**Lock + emergency exit.** When a delegation signature lands, every position is locked for 7 days. You cannot re-delegate elsewhere until the lock expires. Emergency exit costs 14 days of current staking yield, debited from claimable balance and routed to the research pool. Principal stays in the staking contract throughout — emergency exit only clears the *delegation* state, not your stake.

### Boost program (miner-side)

Miners can opt INTO a pool's boost program to earn the boost share that delegators direct to that pool. Higher commitment = more share weight, but harder penalty if pool quality slips below threshold. Threshold = avg quality ≥6/10 AND ≥5 verified subs/day.

- `opt_in_to_boost(pool_id, commitment_tier=1)` — Commit this miner to a pool. Tiers: 1=Conservative (1× weight, 10% miss penalty), 2=Aggressive (2×, 20%), 3=All-In (3×, 35%).
- `opt_out_of_boost(pool_id)` — End the commitment. Future settlements will skip this miner in this pool.
- `boost_optin_status()` — Active opt-ins for your wallet across all six pools.

The boost share is sourced from a 2.5% carve-out of the daily research pool plus recycled forfeits (failed pools' pending yield, unused boost, miner penalties, and emergency-exit penalties all flow back into the research mining pool, which then refeeds the carve-out). Unbacked miners are unaffected.

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
- SDK: v4.14.1 on [PyPI](https://pypi.org/project/litcoin/)
- Emission: 1.0% APR of treasury (soft-landing)
- 1 LITCREDIT = 1,000 output tokens of frontier AI
- 20 research adapters producing verified code and structured data
- TCG intelligence across Pokemon, Magic, Yu-Gi-Oh, One Piece, Greed Island
- Docs: https://litcoin.app/docs
- Cards: https://litcoin.app/cards
- Source: https://litcoin.app
