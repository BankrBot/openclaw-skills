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

Stake $GEM on Base to earn yield and unlock Gem Miner's in-game earn + cashout system. The staking gate requires **25,000,000 GEM** staked. No burn NFT required to stake.

## Contracts (Base mainnet)

| Contract | Address |
|---|---|
| $GEM token | `0xD3776969966B340d72d75731eF890A3Bc9F21bA3` |
| GemStaking | `0xff293DEc665949a3a1a80fBA6a602da3be702C1A` |

## Key Parameters

- **Unbond period:** 7 days (`requestUnstake` → wait → `withdraw`)
- **Early exit fee:** 10% folded back into the reward pool
- **Earn/cashout gate:** 25,000,000 GEM staked
- **Rewards:** from ForgeUpgrade fees — 10% of every forge burn routes to stakers

## Check staking position

```
bankr "on Base, call balanceOf(address), earned(address), and pendingOf(address) on 0xff293DEc665949a3a1a80fBA6a602da3be702C1A with my wallet"
```

Returns: `staked`, `earned` (claimable rewards), `pending` (unbonding amount + unlock timestamp).

## Check GEM balance

```
bankr "what is my GEM balance on Base for token 0xD3776969966B340d72d75731eF890A3Bc9F21bA3"
```

## Stake GEM

Approve then stake in one shot:

```
bankr "on Base, approve 0xff293DEc665949a3a1a80fBA6a602da3be702C1A to spend [AMOUNT_WEI] of token 0xD3776969966B340d72d75731eF890A3Bc9F21bA3, then call stake(uint256) on 0xff293DEc665949a3a1a80fBA6a602da3be702C1A with [AMOUNT_WEI]"
```

> Raw wei: 25M GEM = `25000000000000000000000000` (25 followed by 24 zeros)

## Request unstake (start 7-day unbond)

```
bankr "on Base, call requestUnstake(uint256) on 0xff293DEc665949a3a1a80fBA6a602da3be702C1A with [AMOUNT_WEI]"
```

## Withdraw after 7 days

```
bankr "on Base, call withdraw() on 0xff293DEc665949a3a1a80fBA6a602da3be702C1A"
```

## Early withdraw (pays 10% fee)

```
bankr "on Base, call earlyWithdraw() on 0xff293DEc665949a3a1a80fBA6a602da3be702C1A"
```

## Claim staking rewards

```
bankr "on Base, call getReward() on 0xff293DEc665949a3a1a80fBA6a602da3be702C1A"
```

## Common amounts (raw wei)

| GEM amount | Raw wei |
|---|---|
| 25,000,000 (gate minimum) | `25000000000000000000000000` |
| 50,000,000 | `50000000000000000000000000` |
| 100,000,000 | `100000000000000000000000000` |

## Notes

- No burn NFT required — anyone with GEM can stake
- Rewards accrue continuously; claim anytime without unstaking
- Early withdraw burns 10% — redistributed to remaining stakers
- The 7-day clock starts on `requestUnstake`; you cannot re-stake the pending amount
- Once staked past 25M, you unlock earn events and GEM cashout in-game at gemminer.app
