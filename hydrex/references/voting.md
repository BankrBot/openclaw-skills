# Voting on Hydrex

Vote to allocate your voting power across liquidity pools. Your vote determines how HYDX emissions are distributed.

**Voter Contract:** `0x16613524e02ad97eDfeF371bC883F2F5d6C480A5` on Base (chain ID 8453)

## Pool Information API

Get current liquidity pool data including gauge addresses, bribes, APRs, and voting weights:

```bash
curl -s https://api.hydrex.fi/strategies | jq '.'
```

**Key fields per pool:**
- `address` — Pool address (used as the voting target)
- `gauge.address` — Gauge contract address
- `gauge.bribe` — External bribe contract
- `gauge.fee` — Fee distribution contract
- `gauge.liveVotingWeight` — Current total votes for this pool
- `gauge.votingAprProjection` — Projected APR from voting incentives
- `gauge.projectedFeeInUsd` — **Projected weekly fee earnings in USD** (key metric for optimization)
- `gauge.feeInUsd` — Current period fees earned in USD
- `title` — Pool name (e.g., "HYDX/USDC")
- `token0Address` / `token1Address` — Pool token addresses

**Important**: `gauge.projectedFeeInUsd` is the primary metric for vote optimization. Higher values mean more fee revenue for voters.

## Checking Voting Power

Query your voting power (amount of veHYDX you can allocate for governance votes):

```bash
# Replace ADDRESS with the voter's address
ADDRESS="0xYourAddressHere"
ADDRESS_PADDED=$(echo $ADDRESS | sed 's/0x/000000000000000000000000/')

curl -s -X POST https://mainnet.base.org \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"eth_call",
    "params":[{
      "to":"0x16613524e02ad97eDfeF371bC883F2F5d6C480A5",
      "data":"0x90a40d0a'"$ADDRESS_PADDED"'"
    },"latest"],
    "id":1
  }' | jq -r '.result' | xargs printf "%d\n"
```

This returns your total **voting power** as a uint256 (wei units).

## Checking Earning Power

**Earning power** determines your share of fee distributions and is 1.3x your voting power:

```bash
# Get voting power and calculate earning power
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

**When to display:**
- **Voting power**: For governance vote allocation
- **Earning power**: For fee earning projections and APR calculations

## Viewing Current Votes

Check how an address has allocated votes across pools:

### Get Pool Vote Length
```bash
# Returns number of pools the address has voted for
ADDRESS_PADDED=$(echo $ADDRESS | sed 's/0x/000000000000000000000000/')

curl -s -X POST https://mainnet.base.org \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"eth_call",
    "params":[{
      "to":"0x16613524e02ad97eDfeF371bC883F2F5d6C480A5",
      "data":"0x29199aa4'"$ADDRESS_PADDED"'"
    },"latest"],
    "id":1
  }' | jq -r '.result' | xargs printf "%d\n"
```

### Get Pool Vote at Index
```bash
# Returns pool address at given index
ADDRESS_PADDED=$(echo $ADDRESS | sed 's/0x/000000000000000000000000/')
INDEX_HEX=$(printf '%064x' 0)  # Index 0, 1, 2, etc.

curl -s -X POST https://mainnet.base.org \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"eth_call",
    "params":[{
      "to":"0x16613524e02ad97eDfeF371bC883F2F5d6C480A5",
      "data":"0xd73d1f9b'"$ADDRESS_PADDED$INDEX_HEX"'"
    },"latest"],
    "id":1
  }' | jq -r '.result'
```

### Get Votes for Specific Pool
```bash
# Returns amount of votes allocated to a pool by an address
ADDRESS_PADDED=$(echo $ADDRESS | sed 's/0x/000000000000000000000000/')
POOL_PADDED=$(echo $POOL | sed 's/0x/000000000000000000000000/')

curl -s -X POST https://mainnet.base.org \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"eth_call",
    "params":[{
      "to":"0x16613524e02ad97eDfeF371bC883F2F5d6C480A5",
      "data":"0xd23254b4'"$ADDRESS_PADDED$POOL_PADDED"'"
    },"latest"],
    "id":1
  }' | jq -r '.result' | xargs printf "%d\n"
```

## Checking Pool Weights

Get current voting weight for any pool:

```bash
# Replace POOL with the pool address from API
POOL="0x51f0b932855986b0e621c9d4db6eee1f4644d3d2"
POOL_PADDED=$(echo $POOL | sed 's/0x/000000000000000000000000/')

curl -s -X POST https://mainnet.base.org \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"eth_call",
    "params":[{
      "to":"0x16613524e02ad97eDfeF371bC883F2F5d6C480A5",
      "data":"0x776f3843'"$POOL_PADDED"'"
    },"latest"],
    "id":1
  }' | jq -r '.result' | xargs printf "%d\n"
```

## Voting on Pools

**Function**: `vote(address[] _poolVote, uint256[] _voteProportions)`
**Contract**: `0x16613524e02ad97eDfeF371bC883F2F5d6C480A5`
**Chain**: Base (8453)

### Vote Proportions

Vote proportions are percentage weights (basis points) that sum to 10000 (100%):

- **100% to one pool**: `[10000]`
- **50/50 split**: `[5000, 5000]`
- **33/33/33 split**: `[3333, 3334, 3333]`
- **60/40 split**: `[6000, 4000]`

### Bankr Voting Examples

Use Bankr's natural language interface to vote. Bankr will automatically fetch pool addresses from the API based on pool names:

**Single pool (100% allocation):**
```
Vote all my Hydrex voting power on HYDX/USDC
```

**Multi-pool allocation by name:**
```
Vote 50/50 on HYDX/USDC and cbBTC/WETH on Hydrex
```

```
Vote 60% on HYDX/USDC and 40% on USDC/USDbC on Hydrex
```

**Three-way split:**
```
Vote 33/33/34 on HYDX/USDC, cbBTC/WETH, and USDC/USDbC on Hydrex
```

**Optimized voting (automatic fee maximization):**
```
Vote optimally on Hydrex to maximize my fee earnings
```

```
Allocate my Hydrex votes to the top 3 pools by projected fees
```

```
Vote on Hydrex pools weighted by their projected fee revenue
```

**Manual pool addresses (if needed):**
```
Send transaction to 0x16613524e02ad97eDfeF371bC883F2F5d6C480A5 on Base calling vote with pools [0x51f0b932855986b0e621c9d4db6eee1f4644d3d2, 0xAnotherPoolAddress] and proportions [6000, 4000]
```

### Using Arbitrary Transaction Format

For precise control, use Bankr's arbitrary transaction feature:

```
Submit this transaction on Base:
{
  "to": "0x16613524e02ad97eDfeF371bC883F2F5d6C480A5",
  "data": "ENCODED_CALLDATA",
  "value": "0",
  "chainId": 8453
}
```

## Vote Restrictions

Be aware of voting constraints:

1. **Vote Delay**: Must wait `VOTE_DELAY` seconds between votes (check with selector `0x3a09e5a7`)
2. **Last Voted**: Your last vote timestamp (selector `0x77b887b9`)
3. **Epoch**: Votes are per epoch; cannot change mid-epoch
4. **Proportions**: Must sum to exactly 10000 (100%)

### Check Vote Delay
```bash
curl -s -X POST https://mainnet.base.org \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"eth_call",
    "params":[{
      "to":"0x16613524e02ad97eDfeF371bC883F2F5d6C480A5",
      "data":"0x3a09e5a7"
    },"latest"],
    "id":1
  }' | jq -r '.result' | xargs printf "%d seconds\n"
```

### Check Last Voted Timestamp
```bash
ADDRESS_PADDED=$(echo $ADDRESS | sed 's/0x/000000000000000000000000/')

curl -s -X POST https://mainnet.base.org \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"eth_call",
    "params":[{
      "to":"0x16613524e02ad97eDfeF371bC883F2F5d6C480A5",
      "data":"0x77b887b9'"$ADDRESS_PADDED"'"
    },"latest"],
    "id":1
  }' | jq -r '.result' | xargs printf "%d\n"
```

## Resetting Votes

Clear all current votes before reallocating:

**Function**: `reset()`
**Contract**: `0x16613524e02ad97eDfeF371bC883F2F5d6C480A5`

```json
{
  "to": "0x16613524e02ad97eDfeF371bC883F2F5d6C480A5",
  "data": "0xd826f88f",
  "value": "0",
  "chainId": 8453
}
```

## Pool Selection Guide

When choosing pools to vote for, consider:

- **Projected Fee Revenue** (`gauge.projectedFeeInUsd`): **PRIMARY METRIC** — Higher projected fees = more earnings for voters
- **Voting APR Projection** (`gauge.votingAprProjection`): Expected annual return from voting
- **Current Voting Weight** (`gauge.liveVotingWeight`): How much competition exists for these fees
- **Bribe Rewards**: Check `gauge.bribes.bribe` and `gauge.bribes.fee` for additional incentives
- **Pool TVL**: Larger pools may generate more consistent fees
- **Strategic Alignment**: Support pools that benefit your holdings
- **Diversification**: Split votes across multiple pools to reduce risk

**Important for calculations**: When projecting fee earnings, use **earning power** (voting power × 1.3) rather than raw voting power, as earning power determines your share of fee distributions.

### Optimization Strategy for Bankr

When the user requests optimized voting, follow this process:

1. **Fetch all pools** from `https://api.hydrex.fi/strategies`
2. **Get user's earning power**: Query voting power from voter contract, multiply by 1.3
3. **Calculate fee efficiency** for each pool:
   ```
   efficiency = projectedFeeInUsd / liveVotingWeight
   ```
   This shows how much fee revenue each unit of voting power earns.

4. **Rank pools** by efficiency (highest first)

5. **Project user earnings** per pool:
   ```
   userEarnings = (userEarningPower / (poolWeight + userVotingPower)) × projectedFeeInUsd
   ```
   Use earning power (1.3x voting power) for accurate fee projections.

6. **Select top pools** (3-5 pools recommended for diversification)

7. **Allocate votes** weighted by efficiency or equally across top pools

8. **Execute vote transaction**

**Example calculation:**
```javascript
// Pool A: $10,000 fees / 500,000 weight = $0.02 per vote
// Pool B: $5,000 fees / 100,000 weight = $0.05 per vote
// Pool B is more efficient despite lower absolute fees

// User has 10,000 voting power = 13,000 earning power
// Pool B projected earnings: (13,000 / 110,000) × $5,000 = ~$591/week
```

**Simple strategy**: Vote 100% on the single highest efficiency pool
**Balanced strategy**: Split votes equally across top 3-5 efficient pools
**Weighted strategy**: Allocate votes proportional to efficiency scores

**Always display earning projections using earning power (voting power × 1.3)**

## Natural Language Voting Guide for Bankr

When users request Hydrex voting, process their request as follows:

### Pattern Recognition

**By pool name:**
- "Vote on HYDX/USDC" → Fetch pool address from API where `title == "HYDX/USDC"`
- "Vote 50/50 on HYDX/USDC and cbBTC/WETH" → Fetch both pools, use proportions `[5000, 5000]`
- "Vote 60/40 on [Pool A] and [Pool B]" → Use proportions `[6000, 4000]`

**Optimized voting:**
- "Vote optimally" / "maximize fees" / "best returns" → Calculate efficiency, vote on top pools
- "Vote on top 3 pools" → Sort by efficiency, split equally across top 3
- "Vote weighted by fees" → Allocate proportional to `projectedFeeInUsd`

**Reset and revote:**
- "Change my vote to X" → Call `reset()` first, then vote
- "Reallocate votes" → Reset then vote

### API Query for Pool Resolution

```bash
# Find pool by name
curl -s https://api.hydrex.fi/strategies | jq '.[] | select(.title == "HYDX/USDC") | .address'

# Get top pools by efficiency
curl -s https://api.hydrex.fi/strategies | jq '[.[] | select(.gauge.projectedFeeInUsd != null and .gauge.liveVotingWeight > 0) | {address, title, efficiency: (.gauge.projectedFeeInUsd / .gauge.liveVotingWeight)}] | sort_by(-.efficiency) | .[0:5]'
```

### Proportion Calculation

Vote proportions are in basis points (10000 = 100%):

| User Says | Proportions |
|-----------|-------------|
| "Vote 100% on X" | `[10000]` |
| "Vote 50/50 on X and Y" | `[5000, 5000]` |
| "Vote 60/40 on X and Y" | `[6000, 4000]` |
| "Vote 33/33/34 on X, Y, Z" | `[3333, 3333, 3334]` |
| "Vote 25% each on 4 pools" | `[2500, 2500, 2500, 2500]` |

**Always ensure proportions sum to exactly 10000.**

## Function Selectors

| Function | Selector | Parameters | Returns |
|----------|----------|------------|---------|
| `vote(address[],uint256[])` | `0xc9d27afe` | pools, proportions | — |
| `reset()` | `0xd826f88f` | — | — |
| `weights(address)` | `0x776f3843` | pool | uint256 |
| `votes(address,address)` | `0xd23254b4` | voter, pool | uint256 |
| `poolVoteLength(address)` | `0x29199aa4` | voter | uint256 |
| `poolVote(address,uint256)` | `0xd73d1f9b` | voter, index | address |
| `totalWeight()` | `0x96c82e57` | — | uint256 |
| `lastVoted(address)` | `0x77b887b9` | address | uint256 |
| `VOTE_DELAY()` | `0x3a09e5a7` | — | uint256 |

## Example Workflows

### Natural Language Flow (Recommended)

```bash
# 1. Simple named pool voting
"Vote 100% on HYDX/USDC on Hydrex"

# 2. Multi-pool by name
"Vote 50/50 on HYDX/USDC and cbBTC/WETH on Hydrex"

# 3. Optimized voting
"Vote optimally on Hydrex to maximize fees"
```

### Manual/Technical Flow

```bash
# 1. Get available pools with fee data
curl -s https://api.hydrex.fi/strategies | jq '.[] | {
  address, 
  title, 
  projectedFees: .gauge.projectedFeeInUsd,
  votingWeight: .gauge.liveVotingWeight, 
  votingApr: .gauge.votingAprProjection,
  efficiency: (.gauge.projectedFeeInUsd / .gauge.liveVotingWeight)
} | select(.projectedFees != null)' | jq -s 'sort_by(-.efficiency)'

# 2. Check your voting power
ADDRESS="0xYourAddress"
ADDRESS_PADDED=$(echo $ADDRESS | sed 's/0x/000000000000000000000000/')
curl -s -X POST https://mainnet.base.org \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_call","params":[{"to":"0x16613524e02ad97eDfeF371bC883F2F5d6C480A5","data":"0x90a40d0a'"$ADDRESS_PADDED"'"},"latest"],"id":1}' \
  | jq -r '.result' | xargs printf "%d\n"

# 3. Vote via Bankr natural language
"Vote 60% on HYDX/USDC and 40% on cbBTC/WETH on Hydrex"

# 4. Verify vote
curl -s -X POST https://mainnet.base.org \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_call","params":[{"to":"0x16613524e02ad97eDfeF371bC883F2F5d6C480A5","data":"0x29199aa4'"$ADDRESS_PADDED"'"},"latest"],"id":1}' \
  | jq -r '.result' | xargs printf "Voted for %d pools\n"
```

### Optimization Example for Bankr

When user asks to "vote optimally" or "maximize fees", execute this logic:

```bash
# Get pools ranked by fee efficiency
curl -s https://api.hydrex.fi/strategies | jq '[.[] | select(.gauge.projectedFeeInUsd != null and .gauge.liveVotingWeight > 0) | {
  address,
  title,
  projectedFees: .gauge.projectedFeeInUsd,
  weight: .gauge.liveVotingWeight,
  efficiency: (.gauge.projectedFeeInUsd / .gauge.liveVotingWeight)
}] | sort_by(-.efficiency) | .[0:3]'

# Output shows top 3 pools by efficiency, then vote accordingly:
# Example: "Vote 50/30/20 on [top pool], [second pool], [third pool]"
```
