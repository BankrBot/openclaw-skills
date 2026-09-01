---
name: hydrex
description: Interact with Hydrex on Base — liquidity pools, governance, and synths. Use when the user wants to lock HYDX for voting power, check voting power for gauge voting, vote on liquidity pool strategies, view pool information, check voting weights, participate in Hydrex governance, deposit single-sided liquidity into auto-managed vaults to earn Hydrex yields, claim oHYDX rewards from incentive campaigns, exercise oHYDX into veHYDX, or interact with Hydrex Synths (bridge USDC ↔ Solana assets via the multichain router, look up synth addresses from the validator, or read on-chain synth balances on Base). Synth intent input is restricted to USDC or an existing synth. Uses Bankr for transaction execution.
metadata:
  {
    "clawdbot":
      {
        "emoji": "💧",
        "homepage": "https://hydrex.fi",
        "requires": { "bins": ["bankr"] },
      },
  }
---

# Hydrex

Participate in Hydrex governance on Base. Lock HYDX to receive voting power, vote on liquidity pool strategies to direct emissions and rewards, deposit single-sided into auto-managed vaults to earn oHYDX yields, and claim oHYDX rewards from incentive campaigns.

## Quick Start

### Check Voting Power

```
What's my Hydrex voting power?
```

### Lock HYDX for Voting Power

```
Lock 1000 HYDX on Hydrex with rolling lock
```

### Vote on Pools

```
Vote optimally on Hydrex to maximize fees
```

```
Vote 50/50 on HYDX/USDC and cbBTC/WETH on Hydrex
```

### Single-Sided Liquidity

```
What single-sided liquidity vaults can I deposit BNKR into on Hydrex?
```

```
Deposit 500 BNKR into the BNKR/WETH single-sided vault on Hydrex
```

### Rewards

```
Check my Hydrex rewards
```

```
Claim my Hydrex oHYDX rewards
```

```
Convert my oHYDX to veHYDX on Hydrex
```

### Synths

```
Show me all Hydrex synths
```

```
What's the Base address of the WIF synth on Hydrex?
```

```
Check my Hydrex synth balances on Base
```

```
Quote 100 USDC into the WIF synth on Hydrex
```

```
Buy 100 USDC of WIF on Hydrex
```

```
Sell my 25 WIF synth into USDC on Hydrex
```

## Core Capabilities

### Locking HYDX

- Lock HYDX to receive veHYDX (vote-escrowed HYDX)
- Receive an NFT representing your locked position
- Gain voting power starting next epoch
- Rolling locks (Type 1) provide maximum voting power
- Auto-extends to maintain 2-year lock with no manual management
- Earning power = 1.3x voting power for fee distributions

**Reference**: [references/locking.md](references/locking.md)

### Voting on Pools

- Vote to allocate voting power across liquidity pools
- Direct HYDX emissions based on your votes
- Earn fees from supported pools
- Optimize for maximum fee returns
- Natural language voting by pool name

**Reference**: [references/voting.md](references/voting.md)

### Single-Sided Liquidity (ICHI Vaults)

- Deposit a single token into an auto-managed vault
- Earn oHYDX yields on your deposited value
- Vault manages both sides of the liquidity position
- Withdraw with up to 70/30 split (deposit token / counter token)
- No need to source both sides of a pair

**Checking position value** — fetch the strategy from `https://api.hydrex.fi/strategies?depositTokens=<TOKEN>`, find the matching object by `title` (e.g., `"BNKR/WETH"`), then `balanceOf(userAddress)` on the vault `address`. Value = `(rawBalance / 1e18) × lpPriceUsd`. Full breakdown in [references/single-sided-liquidity.md](references/single-sided-liquidity.md).

**Important**: The deposit token is required to look up a position. If a user asks something open-ended like `"What are my Hydrex deposits?"`, **ask which token to check** (e.g., BNKR, USDC, WETH, HYDX) and encourage them to phrase it as `"check my deposit for [TOKEN]"`.

**Reference**: [references/single-sided-liquidity.md](references/single-sided-liquidity.md)

### Claiming and Managing Rewards

- Check unclaimed oHYDX across all incentive campaigns
- Claim all eligible rewards in a single transaction
- Convert oHYDX into a veHYDX lock position via `exerciseVe`
- Exercising oHYDX requires a discounted ETH payment and produces a rolling veHYDX lock

**Reference**: [references/rewards.md](references/rewards.md)

### Synths (Multichain Router + Validator)

Synths are ERC-20 tokens on Base that wrap Solana SPL tokens via the Hydrex bridge. This skill supports three synth operations only:

1. **Create an intent** — auction-based cross-chain swap between USDC and a Solana asset. **Input must be USDC or an existing synth** — no other inputs are accepted (the `send-app` frontend enforces this in `useSpendOptions.ts`).
2. **Get a quote** via the multichain router — the same intent endpoint returns both the quote and the ready-to-sign transaction.
3. **Look up synth addresses and balances** — the validator's `/tokens` endpoint is the source of truth for `(solana mint ↔ base evmAddress)`; balances are read on-chain via plain `balanceOf` on the Base ERC-20.

**Key endpoints:**

| Purpose | URL |
|---|---|
| Validator registry | `https://synths-validator-1.onrender.com/tokens` |
| Deterministic wrapped address | `https://synths-validator-1.onrender.com/relayer/wrapped-address/:solanaTokenAddress` |
| Buy intent (USDC → Solana asset) | `https://router.api.hydrex.fi/multichain-auction/intent/buy` |
| Sell intent (Solana asset → USDC) | `https://router.api.hydrex.fi/multichain-auction/intent/sell` |
| Intent status (poll after submit) | `https://router.api.hydrex.fi/multichain-auction/status?transactionHash=…` |

**USDC on Base:** `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
**Hydrex Solana chain id:** `501474`

**If the user wants to spend anything other than USDC or a synth**, refuse to build an intent and tell them to swap into USDC first on Base. Do not auto-chain a same-chain swap into an intent.

**References**:
- [references/synths.md](references/synths.md) — validator `/tokens` registry, address lookup, balance reads
- [references/synths-intents.md](references/synths-intents.md) — full intent request/response shape, examples, post-submit status polling
- [references/synths-multichain-router.md](references/synths-multichain-router.md) — quote semantics, decimal-by-direction table, slippage guidance

## Contracts (Base Mainnet)

| Contract               | Address                                      |
| ---------------------- | -------------------------------------------- |
| HYDX Token             | `0x00000e7efa313F4E11Bfff432471eD9423AC6B30` |
| veHYDX (Voting Escrow) | `0x25B2ED7149fb8A05f6eF9407d9c8F878f59cd1e1` |
| Voter                  | `0xc69E3eF39E3fFBcE2A1c570f8d3ADF76909ef17b` |
| Vault Deposit Guard    | `0x9A0EBEc47c85fD30F1fdc90F57d2b178e84DC8d8` |
| Vault Deployer         | `0x7d11De61c219b70428Bb3199F0DD88bA9E76bfEE` |
| Incentive Distributor  | `0x8604d646df5A15074876fc2825CfeE306473dD45` |
| oHYDX Token            | `0xA1136031150E50B015b41f1ca6B2e99e49D8cB78` |
| Hydrex Intent Router   | `0xBa29b52084E1f363D830E5e8c9370046D76eF62A` |
| Hydrex Bridge          | `0x06F57053638546A0E6cc94A6986bf61F35524278` |
| Wrapper Factory        | `0x60f912c8b696eab5693058402002b7369e272117` |

## Pool Information API

Get current liquidity pool data:

```bash
bankr agent "What are the top Hydrex pools by projected fees?"
bankr agent "Show me all Hydrex liquidity pools with their voting weights"
```

**Key fields for voting optimization:**

- `address` — Pool address (voting target)
- `title` — Pool name (e.g., "HYDX/USDC")
- `gauge.projectedFeeInUsd` — **Primary optimization metric**
- `gauge.liveVotingWeight` — Current competition for fees
- `gauge.votingAprProjection` — Expected APR from voting

**Efficiency formula**: `projectedFeeInUsd / liveVotingWeight` = fee revenue per vote

## Common Workflows

### First-Time Setup

1. **Get HYDX** — Acquire HYDX tokens on Base
2. **Approve HYDX** — Approve veHYDX contract to spend HYDX
3. **Lock HYDX** — Create rolling lock (Type 1) for voting power
4. **Wait for epoch** — Voting power activates next epoch (~weekly)
5. **Vote** — Allocate voting power to pools

**Example:**

```
# Step 1: Check HYDX balance
"What's my HYDX balance on Base?"

# Step 2 & 3: Approve and lock in one go
"Lock 1000 HYDX on Hydrex with rolling lock"

# Step 4: Wait for next epoch (typically next Thursday 00:00 UTC)

# Step 5: Vote optimally
"Vote optimally on Hydrex to maximize fees"
```

### Optimized Voting

When you want maximum returns:

```
Vote optimally on Hydrex to maximize my fee earnings
```

Bankr will:

1. Fetch all pools from API
2. Calculate efficiency (fees per vote) for each pool
3. Rank pools by efficiency
4. Allocate votes to top pools
5. Execute vote transaction

### Named Pool Voting

Vote by pool name instead of addresses:

```
Vote 100% on HYDX/USDC on Hydrex
```

```
Vote 60% on HYDX/USDC and 40% on cbBTC/WETH on Hydrex
```

```
Vote 33/33/34 on HYDX/USDC, cbBTC/WETH, and USDC/USDbC on Hydrex
```

### Changing Votes

Reallocate your voting power:

```
Change my Hydrex vote to 100% on cbBTC/WETH
```

This will reset current votes and apply new allocation.

## Optimization Strategies

### Simple Strategy

Vote 100% on the pool with highest `projectedFeeInUsd / liveVotingWeight` ratio.

**Example:**

```
Vote on the single best Hydrex pool by fees
```

### Balanced Strategy

Split votes equally across top 3-5 efficient pools for diversification.

**Example:**

```
Vote equally on top 3 Hydrex pools by projected fees
```

### Weighted Strategy

Allocate votes proportional to efficiency scores.

**Example:**

```
Vote on Hydrex pools weighted by their fee efficiency
```

## Understanding Voting Power

### How Voting Power Works

1. **Lock HYDX** → Receive veHYDX NFT
2. **veHYDX amount** = Your voting power
3. **Rolling locks** (Type 1) = Maximum voting power with auto-extension
4. **Earning power** = 1.3x voting power (used for fee distributions)
5. **Next epoch** = Voting power activates
6. **Vote allocation** = Direct emissions to pools

### Checking Your Power

```bash
# Check voting power
bankr agent "What's my Hydrex voting power?"

# Check earning power (1.3x voting power)
bankr agent "What's my Hydrex earning power?"

# Check veHYDX NFT balance
bankr agent "Show my veHYDX NFT balance"

# Check a specific NFT's earning power
bankr agent "How much earning power does my veHYDX NFT #5 have?"
```

**Display to users**: Show earning power (voting power × 1.3) when discussing fee earnings, as this is what determines your share of distributions.

## Vote Proportions

Vote weights are in basis points (10000 = 100%):

| User Says             | Proportions                |
| --------------------- | -------------------------- |
| "100% on X"           | `[10000]`                  |
| "50/50 on X and Y"    | `[5000, 5000]`             |
| "60/40 on X and Y"    | `[6000, 4000]`             |
| "33/33/34 on X, Y, Z" | `[3333, 3333, 3334]`       |
| "25% each on 4 pools" | `[2500, 2500, 2500, 2500]` |

**Proportions must sum to exactly 10000.**

## Epoch System

Hydrex operates on epochs:

- **Duration**: Typically 1 week
- **Voting power activation**: Next epoch after locking
- **Vote changes**: Respect vote delay between changes
- **Epoch boundary**: Usually Thursday 00:00 UTC

## Example Prompts

### Locking

- "Lock 1000 HYDX on Hydrex with rolling lock"
- "Create veHYDX rolling lock with 500 HYDX on Base"
- "Add 250 HYDX to my veHYDX NFT #1"

### Voting

- "Vote optimally on Hydrex"
- "Vote 50/50 on HYDX/USDC and cbBTC/WETH on Hydrex"
- "Allocate my votes to top 3 Hydrex pools by fees"
- "Change my Hydrex vote to 100% on HYDX/USDC"

### Queries

- "What's my Hydrex earning power?"
- "Show me the best Hydrex pools to vote for"
- "How much earning power does my veHYDX NFT #5 have?"

### Single-Sided Liquidity

- "What single-sided liquidity vaults are available on Hydrex?"
- "What single-sided vaults can I deposit BNKR into on Hydrex?"
- "Deposit 500 BNKR into the BNKR/WETH single-sided vault on Hydrex"
- "Show my Hydrex single-sided liquidity positions"
- "Withdraw my BNKR/WETH single-sided position on Hydrex"
- "How much is my Hydrex BNKR vault position worth?"

### Rewards

- "Check my Hydrex rewards"
- "How much oHYDX have I earned on Hydrex?"
- "Claim my Hydrex oHYDX rewards"
- "Claim all my unclaimed Hydrex incentives"
- "What's my oHYDX balance on Base?"
- "Convert my oHYDX to veHYDX on Hydrex"
- "Exercise my oHYDX rewards into veHYDX"

### Synths

- "List all Hydrex synths"
- "Find the Hydrex synth for mint EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm"
- "What's the Base address for the WIF synth?"
- "Check my Hydrex synth balances"
- "How much WIF synth do I hold on Base?"
- "Quote 100 USDC into WIF on Hydrex"
- "Quote 25 WIF synth back to USDC on Hydrex"
- "Buy 100 USDC of WIF on Hydrex"
- "Sell my 50 WIF synth into USDC on Hydrex"

## Tips

### For New Users

- **Start small**: Lock a small amount first to learn the flow
- **Rolling locks**: Use Type 1 for maximum voting power with auto-extension
- **Wait for epoch**: Voting power activates at next epoch boundary
- **Let Bankr optimize**: "Vote optimally" handles everything automatically
- **Earning power**: Remember your fee earnings are based on 1.3x your voting power

### For Active Voters

- **Track efficiency**: Monitor `projectedFeeInUsd / liveVotingWeight`
- **Diversify votes**: Split across 3-5 pools to reduce risk
- **Watch bribes**: Check API for additional incentive opportunities
- **Respect delays**: Vote delay prevents too-frequent changes
- **Use pool names**: Easier than remembering addresses

### For Maximizers

- **Efficiency > absolute fees**: $5k fees with 100k weight beats $10k fees with 500k weight
- **Use earning power**: Calculate earnings with 1.3x voting power for accurate projections
- **Rebalance periodically**: Pool efficiency changes over time
- **Consider liquidity**: High-volume pools may be more stable
- **Factor in bribes**: Check `gauge.bribes` for extra rewards
- **Rolling locks**: Type 1 automatically maintains 2-year duration for max power

## Natural Language Voting Guide for Bankr

When processing Hydrex voting requests:

1. **Fetch pool data** from `https://api.hydrex.fi/strategies`
2. **Get user earning power**: Query voting power, multiply by 1.3
3. **Parse user intent**:
   - Pool names → Look up addresses in API (`title` field)
   - "Optimally" / "maximize fees" → Calculate efficiency rankings
   - Percentages → Convert to basis points (60% = 6000)
4. **Validate proportions** sum to 10000
5. **Execute vote** via voter contract `0xc69E3eF39E3fFBcE2A1c570f8d3ADF76909ef17b`

**When displaying earnings projections, always use earning power (voting power × 1.3), not raw voting power.**

**Example optimization logic:**

```bash
curl -s https://api.hydrex.fi/strategies | jq '[.[] |
  select(.gauge.projectedFeeInUsd != null and .gauge.liveVotingWeight > 0) |
  {
    address,
    title,
    efficiency: (.gauge.projectedFeeInUsd / .gauge.liveVotingWeight)
  }
] | sort_by(-.efficiency) | .[0:3]'
```

## Resources

- **Hydrex Platform**: https://hydrex.fi
- **Pool API**: https://api.hydrex.fi/strategies
- **Documentation**: https://docs.hydrex.fi
- **Voter Contract**: [BaseScan](https://basescan.org/address/0xc69E3eF39E3fFBcE2A1c570f8d3ADF76909ef17b)
- **veHYDX Contract**: [BaseScan](https://basescan.org/address/0x25B2ED7149fb8A05f6eF9407d9c8F878f59cd1e1)

## Detailed References

- **[Locking HYDX](references/locking.md)** — Complete guide to creating veHYDX positions
- **[Voting on Pools](references/voting.md)** — Comprehensive voting mechanics and optimization
- **[Single-Sided Liquidity](references/single-sided-liquidity.md)** — ICHI vault deposits, withdrawals, and position management
- **[Rewards](references/rewards.md)** — Claiming oHYDX incentives and exercising into veHYDX
- **[Synths](references/synths.md)** — Validator `/tokens` registry, address lookup, on-chain balance reads
- **[Synth Intents](references/synths-intents.md)** — Multichain auction intent endpoint, request/response shape, status polling
- **[Synth Multichain Router](references/synths-multichain-router.md)** — Quote semantics, decimals, slippage, fee fields

---

**💡 Pro Tip**: Efficiency (fees per vote) matters more than absolute fees. Say "vote optimally on Hydrex" and let Bankr handle the math. Remember your earnings are based on earning power (1.3x voting power).

**⚠️ Important**: Rolling locks (Type 1) automatically extend to maintain 2-year duration. This maximizes your voting power without manual management.

**🚀 Quick Win**: Lock HYDX with rolling lock, wait for next epoch, then say "vote optimally on Hydrex to maximize fees" — Bankr calculates using your earning power and does the rest.
