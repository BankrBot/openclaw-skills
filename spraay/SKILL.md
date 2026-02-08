# Spraay

Batch crypto payments via natural language. Send ETH or ERC-20 tokens to multiple recipients in a single transaction on Base. Pay your team, airdrop your community, split bills — all onchain.

## Quick Start

### First-Time Setup

#### Option A: Use with Bankr (recommended)

Spraay works alongside the Bankr skill. If Bankr is already configured, Spraay uses the same wallet and API key to submit batch transactions via Bankr's arbitrary transaction system.

```
mkdir -p ~/.clawdbot/skills/spraay
cat > ~/.clawdbot/skills/spraay/config.json << 'EOF'
{
  "bankrApiKey": "bk_YOUR_KEY_HERE",
  "bankrApiUrl": "https://api.bankr.bot",
  "sprayContract": "0x1646452F98E36A3c9Cfc3eDD8868221E207B5eEC",
  "chainId": 8453,
  "protocolFeePercent": 0.3
}
EOF
```

#### Option B: Direct contract interaction

If not using Bankr, Spraay can generate raw transaction calldata for any wallet or agent to execute:

```
mkdir -p ~/.clawdbot/skills/spraay
cat > ~/.clawdbot/skills/spraay/config.json << 'EOF'
{
  "sprayContract": "0x1646452F98E36A3c9Cfc3eDD8868221E207B5eEC",
  "chainId": 8453,
  "protocolFeePercent": 0.3,
  "rpcUrl": "https://mainnet.base.org"
}
EOF
```

#### Verify Setup

```
scripts/spraay.sh "Show Spraay contract info"
```

## Core Usage

### Batch Send ETH

```
scripts/spraay.sh "Spray 0.1 ETH each to 0xAAA, 0xBBB, 0xCCC on Base"
```

### Batch Send ERC-20 Tokens

```
scripts/spraay.sh "Spray 100 USDC each to 0xAAA, 0xBBB, 0xCCC on Base"
```

### Variable Amounts

```
scripts/spraay.sh "Spray ETH on Base: 0.5 to 0xAAA, 0.2 to 0xBBB, 1.0 to 0xCCC"
```

### CSV Batch Upload

```
scripts/spraay.sh "Spray from CSV: /path/to/recipients.csv"
```

CSV format:
```
address,amount
0xAAA...,0.5
0xBBB...,0.2
0xCCC...,1.0
```

## Capabilities Overview

### Batch ETH Payments
* Send ETH to up to 200+ recipients in one transaction
* Equal or variable amounts per recipient
* ~80% gas savings vs individual transfers
* Protocol fee: 0.3% on total amount

### Batch ERC-20 Payments
* Send any ERC-20 token (USDC, USDT, DAI, WETH, etc.)
* Requires token approval before first use
* Same 200+ recipient capacity
* Protocol fee: 0.3% on total amount

### Payroll & Team Payments
* Recurring batch sends for DAO/team payroll
* CSV import for large recipient lists
* Combine with Bankr automation for scheduled payroll
* Track payment history

### Airdrop Distribution
* Mass token distribution to community
* Support for large recipient lists via CSV
* Gas-efficient for high-volume distributions

### Social Payments (via Farcaster/X)
* Resolve Farcaster usernames to addresses
* Resolve ENS names
* "Spray 10 USDC each to @alice @bob @charlie"

**Reference**: [references/batch-payments.md](references/batch-payments.md)

## How It Works

### Transaction Flow

1. **Parse** — Spraay parses the natural language request into recipient addresses and amounts
2. **Validate** — Checks addresses, amounts, and sender balance
3. **Build** — Constructs the batch transaction calldata for the Spraay contract
4. **Submit** — Sends via Bankr's arbitrary transaction system (or directly)
5. **Confirm** — Returns transaction hash and receipt summary

### Smart Contract

The Spraay contract on Base handles:
- Batch ETH transfers via `sprayETH()`
- Batch ERC-20 transfers via `sprayToken()`
- Protocol fee collection (0.3%)
- Reentrancy protection
- Emergency pause capability

**Contract Address**: `0x1646452F98E36A3c9Cfc3eDD8868221E207B5eEC` (Base Mainnet)

**Reference**: [references/smart-contract.md](references/smart-contract.md)

## Integration with Bankr

Spraay is designed to work seamlessly with Bankr's existing infrastructure:

### Via Arbitrary Transactions
Spraay builds the calldata and submits through Bankr's arbitrary transaction API:

```
scripts/spraay.sh "Spray 0.1 ETH each to 0xAAA, 0xBBB, 0xCCC"
```

Behind the scenes, this submits to Bankr:
```
"Submit this transaction: {to: 0xSPRAAY_CONTRACT, data: 0x..., value: 0.3015, chainId: 8453}"
```

### Via Natural Language
If installed alongside Bankr, users can simply say:
- "Spray 100 USDC to my team"
- "Airdrop 0.01 ETH to these addresses: ..."
- "Pay 50 DAI each to 0xAAA, 0xBBB, 0xCCC on Base"

### Swap + Spray Combo
Combined with Bankr's trading capabilities:
- "Swap 1 ETH to USDC then spray 100 USDC each to 0xAAA, 0xBBB, 0xCCC"
- Bankr handles the swap, Spraay handles the batch send

## Supported Chains

| Chain | Contract | Status |
|-------|----------|--------|
| Base  | `0x1646452F98E36A3c9Cfc3eDD8868221E207B5eEC` | ✅ Live |

*More chains coming via Relay Protocol cross-chain integration.*

## Common Patterns

### Team Payroll

```
# Equal payments
scripts/spraay.sh "Spray 500 USDC each to 0xAlice, 0xBob, 0xCharlie on Base"

# Variable payments from CSV
scripts/spraay.sh "Spray USDC on Base from payroll.csv"
```

### Community Airdrop

```
# Equal airdrop
scripts/spraay.sh "Airdrop 100 MANGO each to these 50 addresses: 0x..."

# From file
scripts/spraay.sh "Spray MANGO on Base from airdrop-list.csv"
```

### Bill Splitting

```
# Split equally
scripts/spraay.sh "Spray 0.05 ETH each to 0xAAA, 0xBBB, 0xCCC, 0xDDD"
```

### Social Tipping

```
# Via Farcaster handles (requires Neynar skill)
scripts/spraay.sh "Spray 5 USDC each to @alice @bob @charlie on Farcaster"

# Via ENS
scripts/spraay.sh "Spray 0.01 ETH each to alice.eth, bob.eth, charlie.eth"
```

## Prompt Examples

### Basic Batch Sends
- "Spray 0.1 ETH each to 0xAAA, 0xBBB, 0xCCC on Base"
- "Send 50 USDC to each of these addresses: 0xAAA, 0xBBB"
- "Batch send 100 DAI to 0xAAA, 0xBBB, 0xCCC"
- "Airdrop 1000 PEPE each to 0xAAA, 0xBBB, 0xCCC on Base"

### Variable Amounts
- "Spray ETH on Base: 0.5 to 0xAAA, 0.2 to 0xBBB, 1.0 to 0xCCC"
- "Pay my team: 500 USDC to 0xAlice, 300 USDC to 0xBob, 800 USDC to 0xCharlie"

### From CSV
- "Spray USDC on Base from /path/to/recipients.csv"
- "Airdrop tokens from my CSV file"

### Info & Estimates
- "How much would it cost to spray 100 USDC to 10 addresses?"
- "Estimate gas for spraying ETH to 50 recipients"
- "Show Spraay contract info"

### Combo with Bankr
- "Swap 1 ETH to USDC then spray 100 USDC each to 0xAAA, 0xBBB, 0xCCC"
- "Check my USDC balance then spray 50 USDC to these 5 addresses"

## Error Handling

Common issues and fixes:

- **Insufficient balance** → Check balance covers total amount + 0.3% fee + gas
- **Too many recipients** → Split into batches of 200 max
- **Invalid address** → Verify all addresses are valid checksummed addresses
- **Token not approved** → Approve Spraay contract to spend your tokens first
- **Transaction reverted** → Check amounts and recipient count
- **Gas estimation failed** → Reduce recipient count or try again
- **Batch reverted mid-send** → Spraay is atomic: all recipients succeed or none do. No funds are lost on revert (gas is still consumed). Check BaseScan for the exact revert reason, fix the issue, and retry.
- **Contract recipient rejects ETH** → Some smart contracts reject incoming ETH. Test suspect addresses individually first, then remove any that fail from your batch.

**Reference**: [references/error-handling.md](references/error-handling.md)

## Gas Estimation

Gas on Base is extremely cheap. Typical costs for batch sends:

| Recipients | sprayETH Gas | sprayToken Gas | Est. USD Cost |
|-----------|-------------|---------------|---------------|
| 10        | ~95,000     | ~130,000      | < $0.01       |
| 50        | ~250,000    | ~350,000      | < $0.01       |
| 100       | ~420,000    | ~620,000      | < $0.01       |
| 200       | ~750,000    | ~1,100,000    | < $0.01       |

**Recommended batch sizes:** Up to 200 for ETH, up to 150 for ERC-20 tokens. For larger distributions, split into multiple transactions.

**Reference**: [references/batch-payments.md](references/batch-payments.md)

## Best Practices

### Security
1. Always double-check recipient addresses before sending
2. Start with small test amounts
3. Verify CSV files before large batch sends
4. Use the gas estimation feature before executing

### Cost Optimization
1. Use Base for lowest gas costs
2. Batch as many recipients as possible per transaction
3. Send during low-gas periods for additional savings
4. Protocol fee is 0.3% — factor this into budgets

### Large Distributions
1. For 200+ recipients, split into multiple transactions
2. Use CSV import for large lists
3. Test with a small subset first
4. Monitor transaction confirmations

## Protocol Fee

Spraay charges a **0.3% protocol fee** on every batch transaction. This fee:
- Is calculated on the total amount being sent
- Is collected by the Spraay contract at transaction time
- Supports ongoing development and maintenance of Spraay
- Is transparent and verifiable onchain

Example: Spraying 1 ETH total → 0.003 ETH fee → recipients receive 1 ETH, sender pays 1.003 ETH + gas.

## Resources

- **Website**: [spraay.app](https://spraay.app)
- **Smart Contract (Base)**: `0x1646452F98E36A3c9Cfc3eDD8868221E207B5eEC`
- **GitHub**: [github.com/plagtech/spraay](https://github.com/plagtech/spraay)
- **Twitter**: [@lostpoet](https://x.com/lostpoet)
- **Farcaster**: [@plag](https://warpcast.com/plag)

## Troubleshooting

### Scripts Not Working

```
# Ensure scripts are executable
chmod +x ~/.clawdbot/skills/spraay/scripts/*.sh

# Test connectivity
curl -I https://api.bankr.bot
```

### Getting Help

1. Check error message in response JSON
2. Consult relevant reference document
3. Verify configuration and contract address
4. Test with a simple 2-recipient ETH spray first

---

**💡 Pro Tip**: Always specify "on Base" in your prompts to avoid chain ambiguity. Spraay currently operates on Base only.

**⚠️ Security**: Double-check all recipient addresses. Blockchain transactions are irreversible. Start with small test amounts.

**🚀 Quick Win**: Try "Spray 0.001 ETH each to 0xAAA, 0xBBB on Base" with two of your own wallets to see how it works.
