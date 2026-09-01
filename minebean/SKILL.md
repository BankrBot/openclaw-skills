---
name: minebean
description: Mine $BEAN on the MineBean 5x5 grid mining protocol on Base. Deploy ETH to blocks each 60-second round, win BEAN and ETH rewards, stake BEAN for yield, run AutoMiner for hands-off play.
homepage: https://minebean.com
twitter: https://x.com/minebean_
network: base
chainId: 8453
license: MIT
metadata:
  author: damo-nu11
  version: "1.0.0"
  repository: "https://github.com/damo-nu11/minebean-skills"
  tags: [crypto, mining, defi, ai-agent, base, gaming, grid]
  hermes:
    tags: [crypto, mining, defi, ai-agent, base, gaming]
    required_environment_variables:
      - name: BANKR_API_KEY
        prompt: "Paste your Bankr API key (starts with 'bk_'). Get one at https://bankr.bot/api with agent write access enabled."
        help: "Controls the on-chain wallet used for deploys, claims, staking, and AutoMiner ops."
        required_for: [mining, claims, staking, automine]
  openclaw:
    requires:
      env: ["BANKR_API_KEY"]
      primaryEnv: "BANKR_API_KEY"
  clawdbot:
    requires:
      env: ["BANKR_API_KEY"]
      primaryEnv: "BANKR_API_KEY"
---

# MineBean

MineBean is a 5x5 grid mining protocol on Base. Every 60 seconds a Chainlink VRF picks one of 25 blocks as the winner. Miners who deployed ETH to the winning block split the ETH pool and earn $BEAN. A 1-in-777 beanpot jackpot accumulates 0.1 BEAN per round until it hits.

This skill lets a user query the protocol, deploy on the grid, claim rewards, manage their AutoMiner, and stake $BEAN, all from a tweet, DM, or terminal command.

## Contracts (Base)

| Contract   | Address                                       |
|------------|-----------------------------------------------|
| GridMining | `0x9632495bDb93FD6B0740Ab69cc6c71C9c01da4f0`  |
| Bean       | `0x5c72992b83E74c4D5200A8E8920fB946214a5A5D`  |
| AutoMiner  | `0x31358496900D600B2f523d6EdC4933E78F72De89`  |
| Staking    | `0xfe177128Df8d336cAf99F787b72183D1E68Ff9c2`  |
| Treasury   | `0x38F6E74148D6904286131e190d879A699fE3Aeb3`  |

Full ABIs and revert reasons live in `references/contracts.md`. Full protocol reference lives in `references/protocol.md`.

## What this skill can do

**Read state**
- Show the current round, beanpot value, grid heat map, time remaining
- Show a user's pending ETH and $BEAN rewards
- Show a user's staking position and pending yield
- Show a user's AutoMiner config and remaining rounds
- Show $BEAN price and 24h stats

**Deploy and claim**
- Deploy ETH to one or more blocks in the current round
- Claim pending ETH rewards
- Claim pending $BEAN rewards (with roasting fee preview)

**AutoMiner**
- Configure and fund AutoMiner: strategy, blocks, rounds, deposit
- Stop AutoMiner and refund unspent rounds

**Staking**
- Approve and stake $BEAN
- Withdraw staked $BEAN
- Claim staking yield
- Compound staking yield back into the stake

**Trading**
- Buy or sell $BEAN at the BEAN/ETH LP on Base. Use Bankr's standard swap routing.

## Command vocabulary

The Bankr agent should map natural language to these actions. Examples below are illustrative, the agent should be flexible with phrasing.

### Read state

| User says | Action |
|---|---|
| "what round is bean on" | GET `https://api.minebean.com/api/round/current` → reply with `roundId`, `endTime` |
| "show me the bean grid" | GET `/api/round/current` → reply with per-block deployed totals |
| "what's the beanpot at" | GET `/api/round/current` → reply with `beanpotPoolFormatted` BEAN |
| "show my bean position" | GET `/api/round/current?user=<addr>` → reply with `userDeployedFormatted` |
| "show my bean rewards" | GET `/api/user/<addr>/rewards` → reply with `pendingETHFormatted` and `pendingBEAN.netFormatted` |
| "show my bean stake" | GET `/api/staking/<addr>` → reply with `balanceFormatted` and `pendingRewardsFormatted` |
| "show my auto-miner" | GET `/api/automine/<addr>` → reply with strategy, rounds remaining, refundable |
| "what's bean trading at" | GET `/api/price` → reply with `priceUsd` and 24h change |

### Deploy (gameplay)

| User says | Action |
|---|---|
| "deploy 0.001 eth on block 12 of bean" | `GridMining.deploy([12])` with `value: 0.001 ETH` |
| "mine blocks 0, 5, 10 on bean with 0.003 eth" | `GridMining.deploy([0, 5, 10])` with `value: 0.003 ETH` (split equally, 0.001/block) |
| "deploy 0.005 eth across all 25 blocks" | `GridMining.deploy([0..24])` with `value: 0.005 ETH` (min 0.0000025 ETH/block, this works) |

Rules to enforce client-side before calling:
- One deploy per round per user. Second deploy reverts with `AlreadyDeployedThisRound`.
- Minimum 0.0000025 ETH per block. Reverts below this.
- Round must be active (not in settlement window).

### Claim rewards

| User says | Action |
|---|---|
| "claim my bean" | `GridMining.claimBEAN()`. Warn user: 10% roasting fee applies to mined BEAN only (not roasted bonus). |
| "claim my eth rewards on bean" | `GridMining.claimETH()` |
| "claim my bean staking yield" | `Staking.claimYield()` |
| "claim everything on bean" | Check `/api/user/<addr>/rewards` for pending ETH/BEAN and `/api/staking/<addr>` for `pendingRewards`. Send only the txs where the corresponding amount is greater than zero: `GridMining.claimETH()`, `GridMining.claimBEAN()`, `Staking.claimYield()`. Skip the ones with zero balance to avoid wasted gas. |

### AutoMiner (basic automation, on-chain only, no off-chain strategy)

| User says | Action |
|---|---|
| "auto-mine bean for 100 rounds on all blocks, 0.0001 eth per block" | `AutoMiner.setConfig(strategyId=1, numRounds=100, numBlocks=0, blockMask=0)` with `value = deposit` (see deposit math below) |
| "random auto-mine bean: 10 blocks, 50 rounds, 0.0001 eth per block" | `AutoMiner.setConfig(strategyId=0, numRounds=50, numBlocks=10, blockMask=0)` with deposit |
| "auto-mine bean on blocks 0, 5, 10 for 50 rounds at 0.0001 eth per block" | `AutoMiner.setConfig(strategyId=2, numRounds=50, numBlocks=3, blockMask=0x421)` with deposit |
| "stop my bean auto-miner" | `AutoMiner.stop()` (refunds unspent rounds) |

**Strategy IDs:** 0 = Random (executor picks N blocks each round), 1 = All (all 25 blocks every round), 2 = Select (specific blocks via `blockMask` bitmask)

**Deposit math:** `setConfig` requires upfront ETH for all rounds plus executor fees. Per round cost is `max(perBlockAmount * numBlocks * 1.01, perBlockAmount * numBlocks + 0.000006 ETH)`. Multiply by `numRounds` to get the deposit value.

### Staking

| User says | Action |
|---|---|
| "stake 1000 bean" | `Bean.approve(stakingAddr, amount)` → wait → `Staking.deposit(amount)` |
| "unstake 500 bean" | `Staking.withdraw(amount)` |
| "claim my bean yield" | `Staking.claimYield()` |
| "compound my bean yield" | `Staking.compound()` |
| "show my staking apr" | GET `/api/staking/stats` → reply with `apr` field |

### Trading

| User says | Action |
|---|---|
| "buy 0.01 eth of bean" | Use Bankr's standard swap (0x router). Pair: BEAN/WETH on Base. |
| "sell 1000 bean for eth" | Same. |

LP pool: `0xd7e5522c9cc3682c960afada6adde0f8116580f2ad2cef08c197faf625e53842` (Uniswap V3 on Base)

## Important rules

1. **One deploy per round.** GridMining reverts a second deploy in the same round with `AlreadyDeployedThisRound`. Check the user's deploy status before submitting.
2. **Minimum deploy.** 0.0000025 ETH per block. Reverts below.
3. **Round timing.** Rounds are 60 seconds based on `block.timestamp`. Base block time is ~2s. Don't promise a deploy will land if `endTime` is within 5 seconds.
4. **Roasting fee.** Claiming mined BEAN has a 10% fee that redistributes to other holders. Roasted bonus is untaxed. Mention this when the user claims.
5. **Approve before staking.** `Staking.deposit` requires prior `Bean.approve(stakingAddr, amount)`. This is two transactions.
6. **AutoMiner is upfront-funded.** Estimate the deposit accurately or `setConfig` reverts. Use the deposit math above.
7. **Rate limits.** Public API has 60 req/min default and 5 req/min on user-specific endpoints. Cache aggressively.

## Quick reference: minimum useful response shapes

The Bankr agent should keep replies short and informative. Suggested templates:

- After deploy: `Deployed 0.001 ETH on blocks [12] in round #91872. Tx: <basescan link>`
- After claim: `Claimed 0.025 ETH and 12.4 BEAN (10% roasting fee: 1.38 BEAN). Tx: <basescan link>`
- After AutoMiner setConfig: `AutoMiner active: Random strategy, 10 blocks, 50 rounds, 0.005 ETH deposited. Tx: <basescan link>`
- After stake: `Staked 1000 BEAN. Position: 5340 BEAN total. Pending yield: 8.2 BEAN. APR: 7.5%.`
- Round state: `MineBean round #91872. 18s remaining. Beanpot: 47.3 BEAN (1-in-777 each round). Your position: not deployed yet.`

## Out of scope for v1

These will land in a follow-up skill version once additional infrastructure is in place:

- Configuring server-side agent strategies (Sniper, Anti-Winner, Beanpot Hunter, Anti-Loser, Nostradamus). These require a signed off-chain agent config and are not yet exposed to Bankr-signed flows.
- Saved custom agent presets. Users have personal saved strategies on the MineBean frontend, not yet portable to Bankr.
- Hosted strategy execution (server-side mining workers that fire each round on the user's behalf).

Direct users who ask about agent strategies to https://minebean.com to configure them in the web app.

## Support

Twitter: https://x.com/minebean_
Web: https://minebean.com
API: https://api.minebean.com
