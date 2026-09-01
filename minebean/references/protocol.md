# MineBean Protocol Reference

> Mirrored from https://minebean.com/skill.md
> Source of truth for the protocol. Refer to this when constructing calldata or
> answering nuanced questions about EV, fees, or game mechanics.

## Overview

- **Chain:** Base (8453)
- **App:** https://minebean.com
- **API:** https://api.minebean.com
- **Objective:** Deploy ETH to a 5x5 grid in 60-second rounds. Chainlink VRF picks a winning block. Winners split the pool. Earn ETH + BEAN rewards. Stake BEAN for yield.

## Contracts

| Contract   | Address                                      |
|------------|----------------------------------------------|
| GridMining | `0x9632495bDb93FD6B0740Ab69cc6c71C9c01da4f0` |
| Bean       | `0x5c72992b83E74c4D5200A8E8920fB946214a5A5D` |
| Treasury   | `0x38F6E74148D6904286131e190d879A699fE3Aeb3` |
| AutoMiner  | `0x31358496900D600B2f523d6EdC4933E78F72De89` |
| Staking    | `0xfe177128Df8d336cAf99F787b72183D1E68Ff9c2` |

All amounts are in wei (18 decimals) unless noted. Use `ethers.parseEther()` / `ethers.formatEther()` for conversion.

## Data Model

| Constant             | Value                     | Note                                                    |
|----------------------|---------------------------|---------------------------------------------------------|
| ROUND_DURATION       | 60 seconds                | Based on `block.timestamp` (~2s blocks on Base)         |
| GRID_SIZE            | 25 (5x5)                  | Block IDs 0..24                                         |
| MIN_DEPLOY           | 0.0000025 ETH per block   | Minimum ETH per block in a deploy                       |
| MAX_SUPPLY           | 3,000,000 BEAN            | Hard cap, minting stops when exhausted                  |
| BEAN per round       | 1.1 BEAN                  | 1.0 miner reward + 0.1 beanpot accumulation             |
| BEANPOT_CHANCE       | 1/777                     | ~0.13% jackpot probability per eligible round           |
| ADMIN_FEE_BPS        | 100 (1%)                  | Deducted from total pool                                |
| VAULT_FEE_BPS        | 1000 (10%)                | Deducted from losers' pool only                         |
| ROASTING_FEE_BPS     | 1000 (10%)                | On mined BEAN claims only, roasted bonus is untaxed     |
| Deploys per round    | 1 per user                | Second deploy reverts `AlreadyDeployedThisRound`        |

## How the Game Works

### Round Lifecycle

```
GameStarted -> 60s timer (block.timestamp) -> reset() -> Chainlink VRF -> RoundSettled -> next GameStarted
```

1. A round starts. You have ~60 seconds to deploy.
2. Call `deploy(blockIds)` with ETH, split equally across your chosen blocks.
3. After the timer expires, `reset()` is called (automated by the backend).
4. Chainlink VRF returns 3 random words:
   - **Word 0**: Winning block (`% 25`, uniform random, no block has better odds)
   - **Word 1**: Split/single BEAN winner (`% 2`) plus weighted random seed
   - **Word 2**: Beanpot trigger (`% 777`)
5. Round settles. Winners are all miners who deployed to the winning block.
6. Next round starts immediately.

**Empty rounds** (zero deployments): settle instantly, no VRF, no BEAN minted, no beanpot growth.

**No-winner rounds** (deployments exist but nobody deployed to the winning block): all ETH goes to admin fee plus treasury vault. No BEAN minted. Beanpot does NOT grow.

### ETH Rewards

Fees are deducted, then the remaining pool is split proportionally among winning-block miners.

```
adminFee      = totalDeployed * 1%                              (from everyone)
losersPool    = totalDeployed - winnersDeployed
vaultAmount   = (losersPool - losersPool * 1%) * 10%            (from losers only)
claimablePool = totalDeployed - adminFee - vaultAmount

yourReward = claimablePool * (yourDeployOnWinningBlock / totalOnWinningBlock)
```

The vault fee only applies to losers' ETH. If the winning block holds a large share of the total pool, the effective house edge is lower.

### BEAN Rewards (1 BEAN per round)

Two possible distribution modes (50/50 chance):

- **Split**: 1 BEAN divided proportionally among all winners based on ETH deployed to the winning block.
- **Single winner**: One miner wins all 1 BEAN via weighted random, more ETH on the winning block raises probability. If more than 2000 unique miners deployed in the entire round, forced to split as a safety cap.

### Beanpot (Jackpot)

- **Accumulates** 0.1 BEAN per round (only when the winning block has miners).
- **Trigger**: `VRF_word_2 % 777 == 0` (~0.13% per eligible round). Must have existing pool > 0.
- **Payout**: Entire accumulated pool split proportionally among winning-block miners. Pool resets. This round's 0.1 BEAN starts a fresh pool.
- **No hit**: 0.1 BEAN added to existing pool. Pool grows over time.
- Beanpot value visible via API (`beanpotPool` field) and on-chain (`GridMining.beanpotPool()`).

### Roasting Fee (BEAN Claims)

When you claim BEAN:
- 10% fee on mined (unroasted) BEAN only. Roasted bonus is NOT taxed.
- Fee redistributes to all users with unclaimed BEAN as a "roasting bonus".
- Holding unclaimed BEAN earns you passive income from others' claim fees.
- If you're the last unclaimed holder, the fee is burned instead.

**Checkpoint**: Rewards auto-checkpoint when you `deploy()`, `claimETH()`, or `claimBEAN()`. No manual checkpoint needed.

### Fee Flow Summary

```
Total ETH in round
+- 1% admin fee (from total)     -> Fee Collector
+- ~10% vault fee (from losers)  -> Treasury
|   +- Buyback: ETH -> BEAN (90% burned, 10% to stakers as yield)
+- Remainder (claimablePool)     -> Winners (proportional)

BEAN minted: 1.0 -> winners   |   0.1 -> beanpot pool
Beanpot: 1/777 chance to pay entire accumulated pool to winners

BEAN claims: 10% fee on mined BEAN -> roasting bonus for unclaimed holders
             Roasted BEAN: untaxed
```

## REST API

Base URL: `https://api.minebean.com`

### Round State

```
GET /api/round/current                  Full grid state (zero latency, served from memory)
GET /api/round/current?user=0xADDR      Same plus your deployment amount
GET /api/round/{id}                     Historical round data
GET /api/round/{id}/miners              Per-miner reward breakdown (settled rounds)
GET /api/rounds?page=1&limit=20         Paginated round history (&settled=true for settled only)
```

`GET /api/round/current` response:
```json
{
  "roundId": "150",
  "startTime": 1709300000,
  "endTime": 1709300060,
  "totalDeployed": "500000000000000000",
  "totalDeployedFormatted": "0.5",
  "beanpotPool": "45000000000000000000",
  "beanpotPoolFormatted": "45.0",
  "settled": false,
  "blocks": [
    { "id": 0, "deployed": "20000000000000000", "deployedFormatted": "0.02", "minerCount": 1 },
    { "id": 1, "deployed": "0", "deployedFormatted": "0.0", "minerCount": 0 }
  ],
  "userDeployed": "50000000000000000",
  "userDeployedFormatted": "0.05"
}
```

### Stats and Price

```
GET /api/stats                          Global stats + BEAN price (cached 60s)
GET /api/price                          BEAN/ETH price from DexScreener (cached 30s)
GET /api/treasury/stats                 Vaulted ETH, total burned, buyback count
GET /api/treasury/buybacks?page=1       Paginated buyback history
```

`GET /api/price` response:
```json
{
  "bean": {
    "priceUsd": "0.0234",
    "priceNative": "0.00000812",
    "volume24h": "15234.56",
    "liquidity": "45678.90",
    "priceChange24h": "-2.34",
    "fdv": "70200"
  },
  "fetchedAt": "2026-03-02T12:00:00.000Z"
}
```

### User Data

```
GET /api/user/{address}                 Balances plus lifetime stats (roundsPlayed, wins, totalDeployed)
GET /api/user/{address}/rewards         Pending ETH plus BEAN breakdown (unroasted/roasted/fee/net)
GET /api/user/{address}/history         Deploy/claim history (?type=deploy for PNL per round)
```

`GET /api/user/{address}/rewards` response:
```json
{
  "pendingETH": "50000000000000000",
  "pendingETHFormatted": "0.05",
  "pendingBEAN": {
    "unroasted": "1000000000000000000",
    "unroastedFormatted": "1.0",
    "roasted": "200000000000000000",
    "roastedFormatted": "0.2",
    "gross": "1200000000000000000",
    "grossFormatted": "1.2",
    "fee": "100000000000000000",
    "feeFormatted": "0.1",
    "net": "1100000000000000000",
    "netFormatted": "1.1"
  },
  "uncheckpointedRound": "0"
}
```

### Staking

```
GET /api/staking/stats                  Total staked, TVL (USD), APR (already %, e.g. "7.52")
GET /api/staking/{address}              Your stake, pending yield, compound fee reserve
```

### AutoMiner

```
GET /api/automine/{address}             Config, strategy, cost/round, refundable amount
```

### Leaderboard

```
GET /api/leaderboard/miners?period=24h  Top deployers (?period=24h|7d|30d|all&limit=20)
GET /api/leaderboard/earners            Top unclaimed BEAN holders (?page=1&limit=20)
GET /api/leaderboard/stakers            Top stakers (?page=1&limit=20)
```

## SSE Streams (Real-Time)

```
GET /api/events/rounds                  Global stream (all events)
GET /api/user/{address}/events          Per-user stream (your rewards, claims)
```

### Global Events

**`deployed`**: Someone deployed. Full grid snapshot (no client-side decoding needed):
```json
{
  "type": "deployed",
  "data": {
    "roundId": "150", "user": "0x...", "totalAmount": "50000000000000000",
    "isAutoMine": false,
    "totalDeployed": "500000000000000000", "totalDeployedFormatted": "0.5",
    "userDeployed": "100000000000000000", "userDeployedFormatted": "0.1",
    "blocks": [
      { "id": 0, "deployed": "...", "deployedFormatted": "...", "minerCount": 2 }
    ]
  }
}
```

**`roundTransition`**: Round ended and new round begins:
```json
{
  "type": "roundTransition",
  "data": {
    "settled": {
      "roundId": "149", "winningBlock": 14, "topMiner": "0x...",
      "totalWinnings": "...", "topMinerReward": "...", "beanpotAmount": "0", "isSplit": false
    },
    "newRound": {
      "roundId": "150", "startTime": 1709300000, "endTime": 1709300060,
      "beanpotPool": "45000000000000000000", "beanpotPoolFormatted": "45.0"
    }
  }
}
```
`settled` is `null` for empty rounds (no deployments). `beanpotAmount` is `"0"` when the jackpot didn't trigger.

**`heartbeat`**: Every 30 seconds: `{ "timestamp": "..." }`

### Per-User Events

| Event               | Key Fields                                    |
|---------------------|-----------------------------------------------|
| `checkpointed`      | `roundId`, `ethReward`, `beanReward`          |
| `claimedETH`        | `amount`, `txHash`                            |
| `claimedBEAN`       | `minedBean`, `roastedBean`, `fee`, `net`      |
| `stakeDeposited`    | `amount`, `newBalance`                        |
| `stakeWithdrawn`    | `amount`, `newBalance`                        |
| `yieldClaimed`      | `amount`                                      |
| `yieldCompounded`   | `amount`, `fee`                               |

## Contract Functions

### GridMining (Gameplay)

**Write (state-changing):**

| Function | Payable | Description |
|----------|---------|-------------|
| `deploy(uint8[] calldata blockIds)` | YES | Deploy ETH to selected blocks (1..25). ETH split equally: `amountPerBlock = msg.value / blockIds.length` |
| `claimETH()` | No | Claim accumulated ETH rewards |
| `claimBEAN()` | No | Claim accumulated BEAN (10% fee on mined portion, roasted bonus untaxed) |

**Read (view):**

| Function | Returns |
|----------|---------|
| `getCurrentRoundInfo()` | `(roundId, startTime, endTime, totalDeployed, timeRemaining, isActive)` |
| `getTotalPendingRewards(address)` | `(pendingETH, unroastedBEAN, roastedBEAN, uncheckpointedRound)` |
| `getPendingBEAN(address)` | `(gross, fee, net)` |
| `getRoundDeployed(uint64 roundId)` | `uint256[25]` ETH per block |
| `getMinerInfo(uint64 roundId, address)` | `(deployedMask, amountPerBlock, checkpointed)` |
| `beanpotPool()` | `uint256` current beanpot value |
| `currentRoundId()` | `uint64` |

### Bean Token (ERC20)

| Function | Description |
|----------|-------------|
| `approve(address spender, uint256 amount)` | Required before staking. Approve Staking contract address. |
| `transfer(address to, uint256 amount)` | Transfer BEAN tokens |
| `balanceOf(address)` | Your BEAN balance |

### Staking (Yield from Buybacks)

| Function | Payable | Description |
|----------|---------|-------------|
| `deposit(uint256 amount)` | No | Stake BEAN (requires prior `approve`). No lock, no penalty. |
| `withdraw(uint256 amount)` | No | Unstake BEAN. Instant. |
| `claimYield()` | No | Claim all accumulated staking yield |
| `compound()` | No | Compound yield back into stake (no fee, no cooldown for self) |
| `depositCompoundFee()` | YES | Pre-deposit ETH so bots can auto-compound for you |

**Read:**

| Function | Returns |
|----------|---------|
| `getStakeInfo(address)` | `(balance, pendingRewards, compoundFeeReserve, lastClaimAt, lastDepositAt, lastWithdrawAt, canCompound)` |
| `getPendingRewards(address)` | `uint256` pending yield |
| `getGlobalStats()` | `(totalStaked, totalYieldDistributed, accYieldPerShare)` |

### AutoMiner (Automated Play)

| Function | Payable | Description |
|----------|---------|-------------|
| `setConfig(uint8 strategyId, uint256 numRounds, uint8 numBlocks, uint32 blockMask)` | YES | Set up auto-mining with ETH deposit for N rounds. Fee: `max(flatFee, percentageFee)` per round. |
| `stop()` | No | Stop auto-mining and refund remaining rounds |

**Strategies:**
- `0` (Random): Executor picks `numBlocks` random blocks each round
- `1` (All): Deploy to all 25 blocks every round (numBlocks=0)
- `2` (Select): You specify exact blocks via `blockMask` (uint32 bitmask, bits 0..24). E.g., blocks 0, 5, 10 -> `(1<<0) | (1<<5) | (1<<10)` = `1057`

**Read:**

| Function | Returns |
|----------|---------|
| `configs(address)` | Full config struct (strategy, blocks, rounds, deposit, fees) |
| `getUserState(address)` | Config plus progress plus costPerRound plus refundable |
| `getConfigProgress(address)` | `(active, numRounds, roundsExecuted, roundsRemaining, percentComplete)` |

## Strategy

### Expected Value (EV)

Each round has a negative ETH EV due to fees, but positive total EV when BEAN rewards are valuable enough.

```
ETH house edge ~= 1% admin + ~10% vault (from losers only)
BEAN value     = 1 BEAN * priceNative (from /api/price)
Beanpot EV     = (1/777) * beanpotPool * priceNative

Net EV per round ~= BEAN_value + Beanpot_EV - (ETH_deployed * effective_house_edge)
```

Use `/api/price` for `priceNative` (BEAN price in ETH) and `/api/round/current` for `beanpotPool`.

EV is positive when `BEAN_value + Beanpot_EV > ETH_deployed * ~0.11`. Higher BEAN price and larger beanpot make every round more profitable.

### Block Selection

All 25 blocks have equal 1/25 win probability (Chainlink VRF is uniform random). Strategy is about share, not odds:

- **Fewer blocks** (1..3): Higher risk, higher reward per block if you win. Best when pool is large relative to your bet.
- **More blocks** (10..25): Higher win rate, smaller reward per win. Consistent but lower upside.
- **Read the grid**: Watch SSE `deployed` events. Deploy to less crowded blocks for a bigger proportional share.
- **Empty blocks**: If you're the only miner on a block and it wins, you get the entire claimablePool share for that block.

### Timing

Rounds are 60 seconds (based on `block.timestamp`, which may drift ~2s from wall clock on Base).

- **Deploy early**: Others see your position via SSE and may counter.
- **Deploy late**: Less time for others to react, but risk missing the round if your tx doesn't confirm in time.
- **Reactive**: Watch SSE for 40..50 seconds, then deploy to the least crowded blocks.

### Bet Sizing

- **Minimum**: `0.0000025 ETH * numBlocks`
- **Bankroll**: Don't risk more than a small percentage per round. BEAN's variance is high (1/25 win probability per block).
- **Pool context**: Check `totalDeployed` on `/api/round/current`. Your share of the winning block determines reward size.

### BEAN Management

1. **Hold unclaimed BEAN**: Earn passive roasting bonus (10% of every other user's BEAN claim fees redistribute to you).
2. **Stake BEAN**: Earn yield from treasury buybacks. Check APR via `/api/staking/stats` (value is already a percentage, e.g. `"7.52"` = 7.52%).
3. **Self-compound**: Call `compound()`, no fee, no cooldown.
4. **Track price**: Use `/api/price` for BEAN/ETH rate. Sell when price is high, accumulate when low.

### AutoMiner vs Manual

| | Manual | AutoMiner |
|---|---|---|
| Control | Full (choose blocks, amount, timing each round) | Strategy preset (random/all/select) |
| Cost | Gas per deploy (~$0.001 on Base) | Executor fee: max(flatFee, %) per round + upfront deposit |
| Upside | React to grid state in real-time | Hands-off, runs N rounds automatically |
| Best for | Active play, reactive strategy | Passive play, guaranteed participation |

## Critical Rules

1. **One deploy per round**: second attempt reverts `AlreadyDeployedThisRound`.
2. **Minimum deploy**: 0.0000025 ETH per block. Transaction reverts below this.
3. **Approve before staking**: Call `Bean.approve(stakingAddress, amount)` before `Staking.deposit()`.
4. **Roasting fee**: 10% on mined BEAN only. Roasted bonus (from others' fees) is untaxed.
5. **Block timestamps**: Round timing uses `block.timestamp`, not wall clock. Base ~2s block times cause minor drift.
6. **Beanpot conditions**: Only accumulates AND can trigger when winning block has at least 1 miner.
7. **Empty rounds**: Zero deployments equals instant settle, no VRF, no BEAN, no beanpot growth.
8. **Checkpoint auto-trigger**: `deploy()`, `claimETH()`, `claimBEAN()` all checkpoint your previous round automatically.
9. **AutoMiner fees**: Hybrid `max(flatFee, percentageFee)` per round, frozen at config creation. Check via `/api/automine/ADDR`.
10. **Rate limits**: API has default 60 req/min, strict 5 req/min on RPC-heavy endpoints (user balances, rewards, staking).
