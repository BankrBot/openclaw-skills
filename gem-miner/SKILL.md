---
name: gem-miner
description: Stake $GEM tokens on Gem Miner (gemminer.app) to earn yield and unlock the in-game earn/cashout system. Use when the user wants to stake GEM, check their staking balance or rewards, unstake, claim rewards, or check whether they meet the 25M GEM gate. Base mainnet only.
metadata:
  {
    "clawdbot":
      {
        "emoji": "⛏️",
        "homepage": "https://gemminer.app",
        "requires": { "bins": ["bankr"] },
      },
  }
---

# Gem Miner Staking

Stake $GEM on Base to earn yield and unlock Gem Miner's in-game earn + cashout system. The staking gate requires **25,000,000 GEM** staked to access earning and cashout.

## Contracts (Base mainnet)

| Contract | Address |
|---|---|
| $GEM token | `0xD3776969966B340d72d75731eF890A3Bc9F21bA3` |
| GemStaking | `0xff293DEc665949a3a1a80fBA6a602da3be702C1A` |

## Key Parameters

- **Unbond period:** 7 days (`requestUnstake` → wait → `withdraw`)
- **Early exit fee:** 10% of staked amount (fee folds back into the reward pool)
- **Earn/cashout gate:** 25,000,000 GEM staked
- **Rewards:** distributed proportionally from ForgeUpgrade fees (10% of every forge burn routes to stakers)

## Usage via Bankr

### Check GEM balance

```
bankr "what is my GEM balance on Base? token 0xD3776969966B340d72d75731eF890A3Bc9F21bA3"
```

### Check staking position

```
bankr "call balanceOf(address) on 0xff293DEc665949a3a1a80fBA6a602da3be702C1A on Base with my address"
```

Or check rewards and pending unstake:

```
bankr "call earned(address) and pendingOf(address) on 0xff293DEc665949a3a1a80fBA6a602da3be702C1A on Base"
```

### Stake GEM

First approve the staking contract to spend your GEM, then stake:

```
bankr "approve 0xff293DEc665949a3a1a80fBA6a602da3be702C1A to spend 50000000 GEM (0xD3776969966B340d72d75731eF890A3Bc9F21bA3) on Base, then call stake(uint256) with 50000000000000000000000000"
```

> Amount is in raw wei (18 decimals). 50,000,000 GEM = `50000000000000000000000000`.

### Request unstake (start 7-day unbond)

```
bankr "call requestUnstake(uint256) on 0xff293DEc665949a3a1a80fBA6a602da3be702C1A on Base with amount 50000000000000000000000000"
```

### Withdraw after unbond period

```
bankr "call withdraw() on 0xff293DEc665949a3a1a80fBA6a602da3be702C1A on Base"
```

### Early withdraw (10% fee)

```
bankr "call earlyWithdraw() on 0xff293DEc665949a3a1a80fBA6a602da3be702C1A on Base"
```

### Claim staking rewards

```
bankr "call getReward() on 0xff293DEc665949a3a1a80fBA6a602da3be702C1A on Base"
```

### Check if gate is met

```
bankr "call balanceOf(address) on 0xff293DEc665949a3a1a80fBA6a602da3be702C1A on Base — do I have at least 25000000000000000000000000 staked?"
```

## Common Amounts (raw wei)

| GEM | Raw wei |
|---|---|
| 25,000,000 (gate minimum) | `25000000000000000000000000` |
| 50,000,000 | `50000000000000000000000000` |
| 100,000,000 | `100000000000000000000000000` |

## Notes

- Staking and withdrawal are user-callable directly — no backend required.
- Rewards accrue continuously. You can call `getReward()` at any time without unstaking.
- If you need your GEM back urgently, `earlyWithdraw()` burns 10% — the fee goes back to all remaining stakers.
- The 7-day unbond clock starts when you call `requestUnstake`. You cannot re-stake the pending amount; request a full or partial amount.
