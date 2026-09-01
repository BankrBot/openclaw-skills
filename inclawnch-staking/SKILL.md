---
name: inclawnch-staking
description: >
  Stake and unstake INCLAWNCH tokens in the on-chain UBI staking contract on Base.
  Query treasury stats, wallet positions, APY estimates, and top stakers.
  All write operations require wallet signatures (on-chain transactions).
  Read operations use a public API — no API key needed.
  Use when: (1) user wants to stake INCLAWNCH, (2) checking staking positions or rewards,
  (3) unstaking tokens, (4) claiming rewards, (5) enabling auto-compound, (6) comparing staking yields.
version: 1.1.0
metadata:
  openclaw:
    emoji: "🌱"
    homepage: "https://inclawbate.com/skills"
    requires:
      bins: ["curl"]
---

# INCLAWNCH UBI Staking — On-Chain Staking for AI Agents

Stake INCLAWNCH tokens in the InclawnchStaking smart contract on Base. Unstake anytime, claim rewards, toggle auto-compounding, and query treasury stats via a public read API.

**All write operations are on-chain transactions** that require the caller to sign with their wallet. No API key needed for reads.

## Quick Start

```bash
# Get treasury stats + top stakers
curl "https://inclawbate.com/api/inclawbate/staking"

# Get a specific wallet's staking position
curl "https://inclawbate.com/api/inclawbate/staking?wallet=0x91b5c0d07859cfeafeb67d9694121cd741f049bd"

# Read the machine-readable skill spec
curl "https://inclawbate.com/api/inclawbate/skill/staking"
```

## Write Capabilities (On-Chain Transactions)

All write operations are signed transactions sent to the InclawnchStaking contract on Base. Each requires the caller's wallet to sign, ensuring only the token owner can modify their position.

### Staking Contract

```
Chain:    Base (chainId 8453)
Contract: 0x206C97D4Ecf053561Bd2C714335aAef0eC1105e6  (InclawnchStaking proxy)
Token:    0xB0b6e0E9da530f68D713cC03a813B506205aC808  (INCLAWNCH ERC-20)
```

### Stake INCLAWNCH

Two-step process — both are on-chain transactions signed by the wallet:

**Step 1: Approve** the staking contract to spend your INCLAWNCH:
```
To:       0xB0b6e0E9da530f68D713cC03a813B506205aC808  (INCLAWNCH token)
Function: approve(address spender, uint256 amount)
Selector: 0x095ea7b3
Args:     spender = 0x206C97D4Ecf053561Bd2C714335aAef0eC1105e6, amount = tokens in wei
```

**Step 2: Stake** into the contract:
```
To:       0x206C97D4Ecf053561Bd2C714335aAef0eC1105e6  (InclawnchStaking)
Function: stake(uint256 amount)
Selector: 0xa694fc3a
Args:     amount = tokens in wei (1 INCLAWNCH = 1e18 wei)
```

Stakers begin earning rewards immediately. Rewards accrue continuously (per-second drip).

### Unstake INCLAWNCH

No lock period. Tokens returned to your wallet in the same transaction.

```
To:       0x206C97D4Ecf053561Bd2C714335aAef0eC1105e6  (InclawnchStaking)
Function: unstake(uint256 amount)
Selector: 0x2e17de78
Args:     amount = tokens in wei to withdraw
```

### Claim Rewards

Withdraw accrued rewards to your wallet:

```
To:       0x206C97D4Ecf053561Bd2C714335aAef0eC1105e6  (InclawnchStaking)
Function: claim()
Selector: 0x4e71d92d
```

### Claim and Restake

Claim accrued rewards and immediately restake them (compound):

```
To:       0x206C97D4Ecf053561Bd2C714335aAef0eC1105e6  (InclawnchStaking)
Function: claimAndRestake()
Selector: 0xf755d8c3
```

### Toggle Auto-Compound

When enabled, rewards are automatically restaked on claim events:

```
To:       0x206C97D4Ecf053561Bd2C714335aAef0eC1105e6  (InclawnchStaking)
Function: setAutoRestake(bool enabled)
Selector: 0x501cdba4
Args:     enabled = true (1) or false (0)
```

### Exit (Unstake All + Claim)

Withdraw entire staked balance and all accrued rewards in one transaction:

```
To:       0x206C97D4Ecf053561Bd2C714335aAef0eC1105e6  (InclawnchStaking)
Function: exit()
Selector: 0xe9fad8ee
```

### View Functions (On-Chain Reads)

Query the contract directly for real-time data:

| Function | Selector | Returns |
|----------|----------|---------|
| `balanceOf(address)` | `0x70a08231` | User's staked balance (wei) |
| `earned(address)` | `0x008cc262` | User's unclaimed rewards (wei) |
| `autoRestake(address)` | `0x5ccb a116` | Whether auto-compound is on |
| `totalStaked()` | `0x817b1cd2` | Total INCLAWNCH staked (wei) |
| `stakerCount()` | `0xdff69787` | Number of stakers |
| `rewardRate()` | `0x7b0a47ee` | Rewards per second (wei) |
| `rewardPoolBalance()` | `0x7a5c08ae` | Remaining reward pool (wei) |
| `periodEnd()` | `0x506ec095` | Reward period end (unix timestamp) |

## Read Capabilities (Public API)

### Get Treasury Stats (no params)

Returns the full UBI treasury overview plus top 20 stakers leaderboard.

```bash
curl "https://inclawbate.com/api/inclawbate/staking"
```

**Treasury fields:**

| Field | Description |
|-------|-------------|
| `total_stakers` | Number of unique staking wallets |
| `total_staked` | Total INCLAWNCH staked |
| `tvl_usd` | Total value locked in USD |
| `weekly_distribution_rate` | INCLAWNCH distributed per week |
| `daily_distribution_rate` | INCLAWNCH distributed per day |
| `total_distributed` | All-time INCLAWNCH distributed |
| `total_distributed_usd` | All-time USD value distributed |
| `estimated_apy` | Current estimated staking APY % |
| `wallet_cap_pct` | Max % any single wallet receives per distribution |

**Top stakers fields:**

| Field | Description |
|-------|-------------|
| `x_handle` | Staker's X/Twitter handle |
| `x_name` | Display name |
| `total_staked` | Total INCLAWNCH staked |
| `staked_usd` | USD value of stake |
| `stake_count` | Number of individual stake transactions |
| `staking_since` | Earliest stake timestamp |

### Get Wallet Position (`?wallet=0x...`)

Returns everything above plus the wallet's specific staking position.

```bash
curl "https://inclawbate.com/api/inclawbate/staking?wallet=0xYourWallet"
```

**Wallet position fields:**

| Field | Description |
|-------|-------------|
| `total_staked` | Wallet's total INCLAWNCH staked |
| `staked_usd` | USD value of wallet's stake |
| `share_pct` | Wallet's share of the total pool (%) |
| `estimated_daily_reward` | Estimated INCLAWNCH received per day |
| `estimated_weekly_reward` | Estimated INCLAWNCH received per week |
| `auto_stake_enabled` | Whether rewards auto-compound |
| `total_rewards_received` | All-time INCLAWNCH rewards earned |
| `active_stakes` | Array of individual stake records |

## How UBI Staking Works

1. **Approve** — Approve the staking contract to spend your INCLAWNCH (on-chain tx, signed by wallet).
2. **Stake** — Call `stake(amount)` on the contract (on-chain tx, signed by wallet).
3. **Earn** — Rewards drip continuously per-second from the reward pool, proportional to your stake.
4. **Claim** — Call `claim()` to withdraw rewards, or `claimAndRestake()` to compound.
5. **Auto-compound** — Call `setAutoRestake(true)` so rewards automatically restake.
6. **Unstake** — Call `unstake(amount)` anytime. No lock period, instant withdrawal.

## Token Info

| Detail | Value |
|--------|-------|
| Token | INCLAWNCH |
| Chain | Base (chainId 8453) |
| Token Contract | `0xB0b6e0E9da530f68D713cC03a813B506205aC808` |
| Staking Contract | `0x206C97D4Ecf053561Bd2C714335aAef0eC1105e6` |
| BaseScan (Token) | https://basescan.org/token/0xB0b6e0E9da530f68D713cC03a813B506205aC808 |
| BaseScan (Staking) | https://basescan.org/address/0x206C97D4Ecf053561Bd2C714335aAef0eC1105e6 |

## Links

- **Skill Spec (JSON):** https://inclawbate.com/api/inclawbate/skill/staking
- **Read Endpoint:** https://inclawbate.com/api/inclawbate/staking
- **UBI Dashboard:** https://inclawbate.com/ubi
- **Skills Directory:** https://inclawbate.com/skills
- **Homepage:** https://inclawbate.com
