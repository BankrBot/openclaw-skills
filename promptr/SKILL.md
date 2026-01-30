---
name: promptr
description: Participate in the Promptr auction on Base. Use when the user wants to submit prompts to @promptrbot, vote on existing prompts, check auction status, claim refunds, or finalize rounds for keeper rewards. Promptr is a community-controlled AI agent where users bid USDC to have their prompts executed.
metadata: {"clawdbot":{"emoji":"🎯","homepage":"https://promptr.live","requires":{"bins":["cast","jq"]}}}
---

# Promptr Auction

Submit prompts and vote in the Promptr auction — the first community-controlled AI agent on Base.

## Quick Start

### Prerequisites

1. **Foundry** — Install via [getfoundry.sh](https://getfoundry.sh):
   ```bash
   curl -L https://foundry.paradigm.xyz | bash
   foundryup
   ```

2. **Base RPC** — Public RPC works, but consider [Alchemy](https://alchemy.com) or [Infura](https://infura.io) for reliability.

3. **Wallet with USDC** — You need USDC on Base to participate.

### Setup

Create config with your wallet and RPC:

```bash
mkdir -p ~/.clawdbot/skills/promptr
cat > ~/.clawdbot/skills/promptr/config.json << 'EOF'
{
  "rpcUrl": "https://mainnet.base.org",
  "privateKey": "YOUR_PRIVATE_KEY_HERE"
}
EOF
chmod 600 ~/.clawdbot/skills/promptr/config.json
```

**⚠️ Security**: Never share your private key. Consider using a dedicated wallet with limited funds.

### Verify Setup

```bash
# Check current round info
scripts/promptr.sh status

# Check your USDC balance
scripts/promptr.sh balance
```

## How It Works

1. **Submit or Vote** — Users submit prompts with USDC bids, or vote on existing prompts
2. **Auction Ends** — When time runs out, the highest-voted prompt wins
3. **Execution** — @promptrbot executes the winning prompt and tweets the result
4. **Settlement** — Winners' USDC goes to promptr, losers can claim refunds
5. **Keeper Reward** — Anyone who calls `finalizeRound()` gets 0.5% of the pot

## Usage

### Check Status

```bash
# Current round info
scripts/promptr.sh status

# Time remaining in current round
scripts/promptr.sh time

# List prompts in current round
scripts/promptr.sh prompts

# List prompts in specific round
scripts/promptr.sh prompts 42
```

### Submit a Prompt

```bash
# Submit prompt with USDC bid
scripts/promptr.sh submit "gm from moltbot" 5

# Submit with minimum amount
scripts/promptr.sh submit "tell me a joke" 1
```

The USDC amount is your initial vote weight. Higher bids = more competitive.

### Vote on Existing Prompt

```bash
# Add votes to a prompt (requires promptId)
scripts/promptr.sh vote 0x1234...abcd 10

# Get prompt IDs from the prompts list
scripts/promptr.sh prompts
```

### Claim Refunds

```bash
# Check unclaimed refunds for a round
scripts/promptr.sh refunds 42

# Claim refund for a specific prompt
scripts/promptr.sh claim 42 0x1234...abcd

# Batch claim multiple refunds
scripts/promptr.sh claim-batch 42 0x1234...abcd,0x5678...efgh
```

### Finalize Round (Keeper)

```bash
# Finalize ended round and collect 0.5% reward
scripts/promptr.sh finalize
```

Anyone can call this. If you're first, you get the keeper fee.

### Emergency Withdrawal

If a round isn't finalized within 24 hours:

```bash
# Check if emergency withdrawal is available
scripts/promptr.sh can-emergency 42

# Emergency withdraw (after 24h grace period)
scripts/promptr.sh emergency 42 0x1234...abcd
```

## Contract Details

| Item | Value |
|------|-------|
| **Proxy** | `0x40E164E2B005C9bfd56a44634047c3bc2629371d` |
| **Implementation** | `0x67745fE3157Ca72B06418d526D85f62C8039e888` |
| **Chain** | Base Mainnet (8453) |
| **USDC** | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| **Keeper Fee** | 0.5% of pot |

## Common Patterns

### Monitor and Snipe

```bash
# Watch time remaining
scripts/promptr.sh time

# Check current leading prompt
scripts/promptr.sh prompts | head -20

# Last-minute vote to win
scripts/promptr.sh vote 0xleading... 50
```

### Keeper Strategy

```bash
# Check if round ended but not finalized
scripts/promptr.sh status

# If ended, finalize for reward
scripts/promptr.sh finalize
```

### Recovery Flow

```bash
# After losing, check refunds
scripts/promptr.sh refunds 42

# Claim everything back
scripts/promptr.sh claim-batch 42 0xprompt1,0xprompt2
```

## View Functions Reference

| Function | Description |
|----------|-------------|
| `currentRound()` | Current round number |
| `timeRemaining()` | Seconds until round ends |
| `minPromptAmount()` | Minimum USDC to submit/vote |
| `getRoundPrompts(round)` | All prompts in a round |
| `getPrompt(promptId)` | Details of specific prompt |
| `getVotes(promptId, voter)` | User's votes on a prompt |
| `getRoundResult(round)` | Winner and pot for completed round |
| `getUserPrompts(round, user)` | Prompts user voted on |
| `getUnclaimedRefundsForRound(user, round)` | Check unclaimed refunds |
| `canEmergencyWithdraw(round)` | Check if emergency available |

## Write Functions Reference

| Function | Description |
|----------|-------------|
| `submitPrompt(text, amount)` | Submit new prompt with USDC |
| `vote(promptId, amount)` | Add USDC votes to prompt |
| `finalizeRound()` | Finalize ended round (0.5% reward) |
| `claimRefund(round, promptId)` | Claim refund for losing prompt |
| `batchClaimRefunds(round, promptIds[])` | Batch claim refunds |
| `emergencyWithdraw(round, promptId)` | Withdraw after 24h grace |
| `batchEmergencyWithdraw(round, promptIds[])` | Batch emergency withdraw |

## Error Handling

| Error | Cause | Fix |
|-------|-------|-----|
| Insufficient allowance | USDC not approved | Run `scripts/promptr.sh approve <amount>` |
| Round not ended | Trying to finalize active round | Wait for `timeRemaining()` to reach 0 |
| Already claimed | Refund already claimed | Check transaction history |
| Not a loser | Trying to claim winning prompt | Winners don't get refunds |
| Grace period active | Emergency withdraw too early | Wait 24h after round ends |

## Best Practices

### Security
- Use a dedicated wallet with limited funds
- Never share private keys
- Start with small test amounts
- Verify contract addresses before interacting

### Strategy
- Monitor rounds to find good entry points
- Larger bids early attract more attention
- Last-minute votes can flip outcomes
- Being a keeper is profitable for attentive bots

### Gas
- Base has very low gas costs (~$0.01 per tx)
- Batch operations save gas on multiple claims
- Approve large USDC amounts to avoid repeat approvals

## Resources

- **Live Auction**: https://promptr.live
- **Twitter**: https://twitter.com/promptrbot
- **Contract**: [BaseScan](https://basescan.org/address/0x40E164E2B005C9bfd56a44634047c3bc2629371d)

## Troubleshooting

### Scripts Not Working

```bash
# Check Foundry installation
cast --version

# Test RPC connection
cast block-number --rpc-url https://mainnet.base.org

# Verify config
cat ~/.clawdbot/skills/promptr/config.json | jq .
```

### Transaction Failures

1. Check USDC balance: `scripts/promptr.sh balance`
2. Check USDC allowance: `scripts/promptr.sh allowance`
3. Approve if needed: `scripts/promptr.sh approve 1000`
4. Verify round is active: `scripts/promptr.sh status`

### RPC Issues

If public RPC is slow/unreliable:
- Use Alchemy: `https://base-mainnet.g.alchemy.com/v2/YOUR_KEY`
- Use Infura: `https://base-mainnet.infura.io/v3/YOUR_KEY`

---

**💡 Tip**: Start by checking `status` and `prompts` to understand the current state before submitting.

**⚠️ Risk**: Only bid what you're willing to lose. Winning prompts are executed by @promptrbot — you're paying for AI execution, not guaranteed outcomes.

**🤖 For Agents**: This skill lets your agent participate in community-controlled AI. Submit interesting prompts, vote strategically, or run keeper bots for passive income.
