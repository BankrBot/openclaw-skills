---
name: hydrex
description: Interact with Hydrex liquidity pools on Base. Use when the user wants to lock HYDX for voting power, check voting power for gauge voting, vote on liquidity pool strategies, view pool information, check voting weights, or participate in Hydrex governance. Uses Bankr for transaction execution.
metadata: {"clawdbot":{"emoji":"💧","homepage":"https://hydrex.fi","requires":{"bins":["curl","jq"]}}}
---

# Hydrex

Participate in Hydrex governance on Base. Lock HYDX to receive voting power, then vote on liquidity pool strategies to direct emissions and rewards.

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

## Contracts (Base Mainnet)

| Contract | Address |
|----------|---------|
| HYDX Token | `0x00000e7efa313F4E11Bfff432471eD9423AC6B30` |
| veHYDX (Voting Escrow) | `0x25B2ED7149fb8A05f6eF9407d9c8F878f59cd1e1` |
| Voter | `0x16613524e02ad97eDfeF371bC883F2F5d6C480A5` |

## Pool Information API

Get current liquidity pool data:

```bash
curl -s https://api.hydrex.fi/strategies | jq '.'
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
# Via Bankr (displays earning power)
"What's my Hydrex earning power?"

# Manual query - voting power (voter contract)
ADDRESS="0xYourAddress"
ADDRESS_PADDED=$(echo $ADDRESS | sed 's/0x/000000000000000000000000/')

VOTING_POWER=$(curl -s -X POST https://mainnet.base.org \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"eth_call",
    "params":[{
      "to":"0x16613524e02ad97eDfeF371bC883F2F5d6C480A5",
      "data":"0x90a40d0a'"$ADDRESS_PADDED"'"
    },"latest"],
    "id":1
  }' | jq -r '.result' | xargs printf "%d\n")

# Calculate earning power (1.3x voting power)
echo "scale=0; $VOTING_POWER * 1.3 / 1" | bc
```

**Display to users**: Show earning power (voting power × 1.3) when discussing fee earnings, as this is what determines your share of distributions.

## Vote Proportions

Vote weights are in basis points (10000 = 100%):

| User Says | Proportions |
|-----------|-------------|
| "100% on X" | `[10000]` |
| "50/50 on X and Y" | `[5000, 5000]` |
| "60/40 on X and Y" | `[6000, 4000]` |
| "33/33/34 on X, Y, Z" | `[3333, 3333, 3334]` |
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
5. **Execute vote** via voter contract `0x16613524e02ad97eDfeF371bC883F2F5d6C480A5`

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
- **Voter Contract**: [BaseScan](https://basescan.org/address/0x16613524e02ad97eDfeF371bC883F2F5d6C480A5)
- **veHYDX Contract**: [BaseScan](https://basescan.org/address/0x25B2ED7149fb8A05f6eF9407d9c8F878f59cd1e1)

## Detailed References

- **[Locking HYDX](references/locking.md)** — Complete guide to creating veHYDX positions
- **[Voting on Pools](references/voting.md)** — Comprehensive voting mechanics and optimization

---

**💡 Pro Tip**: Efficiency (fees per vote) matters more than absolute fees. Say "vote optimally on Hydrex" and let Bankr handle the math. Remember your earnings are based on earning power (1.3x voting power).

**⚠️ Important**: Rolling locks (Type 1) automatically extend to maintain 2-year duration. This maximizes your voting power without manual management.

**🚀 Quick Win**: Lock HYDX with rolling lock, wait for next epoch, then say "vote optimally on Hydrex to maximize fees" — Bankr calculates using your earning power and does the rest.
