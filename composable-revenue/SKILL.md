---
name: composable-revenue
description: Composable revenue management for Clanker tokens on Base. Use when the user wants to tokenize trading fees, create time-locked fee wrappers, set up automated burn/LP/rewards strategies, route fees conditionally based on market metrics, or deploy tokens with fee tokenization via PoolFans infrastructure. Enables trustless, programmable fee automation with no admin keys.
metadata: {"clawdbot":{"emoji":"⚡","homepage":"https://pool.fans","requires":{"bins":["curl","node"]}}}
---

# Composable Revenue (PoolFans)

Deploy and manage composable trading fee strategies on Base using PoolFans infrastructure.

## Quick Start

### Prerequisites
- Node.js v18+
- Base RPC endpoint
- Private key with ETH on Base for gas

### Configuration

```bash
mkdir -p ~/.clawdbot/skills/composable-revenue
cat > ~/.clawdbot/skills/composable-revenue/config.json << 'EOF'
{
  "rpcUrl": "https://mainnet.base.org",
  "privateKey": "YOUR_PRIVATE_KEY",
  "chainId": 8453
}
EOF
```

## Core Capabilities

### 1. Deploy Token with Fee Tokenization
Deploy Clanker tokens with instant fee tokenization. Choose fee collection mode: WETH_ONLY, TOKEN_ONLY, or BOTH.

```
"Deploy token called ClawdFans ticker $CLAWDFANS with WETH fee collection"
```

**Reference**: [references/deploy-tokenize.md](references/deploy-tokenize.md)

### 2. Tokenize Existing Token Fees
Tokenize fees for already-deployed Clanker tokens (V3.1.0+ and V4). Two-step flow for security.

```
"Tokenize fees for my existing token 0x123..."
```

**Reference**: [references/tokenize-existing.md](references/tokenize-existing.md)

### 3. Time-Locked Fee Wrappers
Create tradeable tokens representing temporary fee claiming rights (1 Day, 1 Week, 1 Month).

```
"Create 1D time-wrappers from my fee tokens"
```

**Reference**: [references/time-wrappers.md](references/time-wrappers.md)

### 4. Automated LP Provision
Auto-deploy collected fees as Uniswap V4 liquidity. Three strategies: Below Price (accumulate), Above Price (take profit), Around Price (maximize fees).

```
"Auto-deploy my fees as LP below current price to accumulate tokens"
```

**Reference**: [references/lp-automation.md](references/lp-automation.md)

### 5. Conditional Fee Routing
Route fees to different destinations based on market conditions (market cap, volume, holder count).

```
"Route fees to top 50 holders when market cap > $1M, otherwise burn"
```

**Reference**: [references/conditional-routing.md](references/conditional-routing.md)

### 6. Multi-Strategy Automation
Chain multiple DeFi actions: burn + LP + rewards with percentage allocations.

```
"Split daily fees: 40% burn, 30% LP, 20% to top traders, 10% to me"
```

**Reference**: [references/multi-strategy.md](references/multi-strategy.md)

### 7. Holder/Trader Rewards
Distribute fees to token holders (pro-rata) or top traders by volume.

```
"Distribute 50% of daily fees to top 100 holders"
```

**Reference**: [references/rewards.md](references/rewards.md)

## Contract Addresses (Base Mainnet)

```typescript
const POOL_FANS_CONTRACTS = {
  // Factories
  MULTI_ACTION_VAULT_FACTORY: "0x069aEC7cE08CDc0F45135bAac0E5Fe3B579AB99b",
  LP_AUTOMATION_VAULT_FACTORY: "0xF0a87A32C2F7fAb1E372F676A852C64b8dB0CEDD",
  TIME_WRAPPER_FACTORY: "0x083EDF9b6C894561Ce8a237e2fd570bECB920DfF",
  
  // Tokenizers
  V4_TOKENIZER_FACTORY: "0xea8127533F7be6d04b3DBA8f0a496F2DCfd27728",
  V3_1_0_TOKENIZER_FACTORY: "0x50e2A7193c4AD03221F4B4e3e33cDF1a46671Ced",
  REVENUE_SHARE_REGISTRY: "0xAa9c3E28e2f03e41365D4b01FB2785bdbd1494d2",
  
  // External
  CLANKER_V4_DEPLOYER: "0xE85A59c628F7d27878ACeB4bf3b35733630083a9",
  FEE_LOCKER: "0x63D2DfEA64b3433F4071A98665bcD7Ca14d93496",
  WETH: "0x4200000000000000000000000000000000000006",
};
```

**Always verify on BaseScan before interacting.**

## Intent Recognition

```typescript
const INTENT_PATTERNS = {
  // Deployment
  deploy_token: /deploy.*token|launch.*token|create.*token/i,
  tokenize_fees: /tokenize.*fee|fee.*token|revenue.*share/i,
  
  // Strategies
  time_wrapper: /time.?wrapper|1D|daily.*claim|temporary.*access/i,
  burn_strategy: /burn|buy.*burn|auto.*burn|destroy/i,
  lp_strategy: /add.*liquidity|LP|provide.*liquidity/i,
  holder_rewards: /distribute.*holder|holder.*reward/i,
  trader_rewards: /top.*trader|volume.*reward/i,
  
  // Conditional
  conditional: /if.*then|condition|market cap|volume|when/i,
  market_cap: /market.*cap|mcap|\$\d+[kKmM]/i,
};
```

## Example Conversation

```
User: "Deploy token called ClawdFans ticker $CLAWDFANS and tokenize fees.
       Split daily fees: 40% burn, 30% LP, 30% to me"

MoltRevenue: ⚡ Composing your revenue strategy...

✅ Strategy Deployed:

1️⃣ Token
   • Name: ClawdFans
   • Symbol: $CLAWDFANS
   • Address: 0x123...

2️⃣ Fee Tokenization
   • You received: 80 fee tokens (80% of trading fees)
   • Treasury: 20 fee tokens (20%)

3️⃣ Multi-Strategy Router
   • Route A (40%): Auto-swap → Burn
   • Route B (30%): Add liquidity → Burn LP
   • Route C (30%): Direct to you
   • Automation: Daily via Chainlink

Monitor at: https://pool.fans/vault/0x123...
```

## Treasury Fee

- Creators receive **80%** of fee tokens
- Treasury receives **20%**
- This is protocol-level and immutable

## Common Patterns

### Full Deflationary Setup
```
"Deploy $TOKEN, tokenize fees, 
 create 1D wrappers,
 burn 100% of collected fees daily"
```

### Holder-Aligned Strategy
```
"Deploy $TOKEN with BOTH fee collection,
 if market cap > $500k: distribute to top 100 holders
 else: burn everything"
```

### LP Growth Strategy
```
"Deploy $TOKEN,
 50% add liquidity below price (accumulate),
 50% add liquidity above price (take profit),
 burn all LP tokens"
```

## Error Handling

| Error | Solution |
|-------|----------|
| Insufficient fee tokens | Wait for more trading fees to accumulate |
| Lock period not expired | Cannot withdraw until lock ends; wrapper tokens still tradeable |
| Allocation != 100% | Percentages must sum to exactly 100% |
| Admin not set | Complete 2-step tokenization flow first |

## Resources

- **UI**: https://pool.fans
- **Docs**: https://pool.fans/docs
- **Contracts**: https://pool.fans/docs#contracts
- **Architecture**: See fee-tokenizer.md for complete guide

## Value Proposition

**For Token Creators:**
- Turn trading fees into programmable revenue
- Build deflationary pressure through burns
- Reward holders and traders automatically

**For AI Bots:**
- Natural language → on-chain execution
- Fully trustless (no admin keys)
- Composable primitives

**For Users:**
- Transparent fee usage (all on-chain)
- Tradeable fee rights via wrappers
- Trust through code, not promises

---

*⚡ Composable Revenue — Forge Your Strategy*
