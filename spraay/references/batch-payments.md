# Batch Payments Reference

## Overview

Spraay enables sending ETH or ERC-20 tokens to multiple recipients in a single blockchain transaction. This is dramatically more gas-efficient than sending individual transfers.

## Gas Savings

| Recipients | Individual Txs Gas | Spraay Gas | Savings |
|-----------|-------------------|------------|---------|
| 5         | ~105,000          | ~65,000    | ~38%    |
| 10        | ~210,000          | ~95,000    | ~55%    |
| 50        | ~1,050,000        | ~250,000   | ~76%    |
| 100       | ~2,100,000        | ~420,000   | ~80%    |
| 200       | ~4,200,000        | ~750,000   | ~82%    |

## Gas Estimation Guide

### Estimated Costs on Base (at typical gas prices)

Base L2 gas is extremely cheap. These estimates assume ~0.01 gwei gas price (typical for Base):

| Recipients | Function | Est. Gas | Est. Cost (ETH) | Est. Cost (USD) |
|-----------|----------|----------|-----------------|-----------------|
| 5         | sprayETH | ~65,000  | ~0.00000065     | < $0.01         |
| 10        | sprayETH | ~95,000  | ~0.00000095     | < $0.01         |
| 25        | sprayETH | ~170,000 | ~0.0000017      | < $0.01         |
| 50        | sprayETH | ~250,000 | ~0.0000025      | < $0.01         |
| 100       | sprayETH | ~420,000 | ~0.0000042      | < $0.01         |
| 200       | sprayETH | ~750,000 | ~0.0000075      | < $0.01         |
| 5         | sprayToken | ~85,000  | ~0.00000085   | < $0.01         |
| 50        | sprayToken | ~350,000 | ~0.0000035    | < $0.01         |
| 100       | sprayToken | ~620,000 | ~0.0000062    | < $0.01         |
| 200       | sprayToken | ~1,100,000 | ~0.000011   | < $0.01         |

**Note:** ERC-20 sprays (`sprayToken`) use more gas than ETH sprays because each token transfer involves calling the token contract. Actual costs may vary with network congestion.

### Planning Large Batches

**Recommended batch sizes by function:**
- `sprayETH`: Up to 200 recipients comfortably
- `sprayToken`: Up to 150 recipients recommended (token transfers are heavier)
- `sprayEqual`: Up to 200 recipients (more efficient since amount is stored once)

**For 500+ recipients:**
Split into multiple transactions of 100-150 each. Example:
```
"Spray USDC on Base from batch1.csv"   # rows 1-150
"Spray USDC on Base from batch2.csv"   # rows 151-300
"Spray USDC on Base from batch3.csv"   # rows 301-500
```

### Total Cost Formula

For any spray, the total sender cost is:

```
Total Cost = Sum of all recipient amounts
           + Protocol fee (0.3% of sum)
           + Gas fee (negligible on Base, see table above)
```

Example: Spraying 1 ETH total to 10 recipients
- Recipient amounts: 1.0 ETH
- Protocol fee: 0.003 ETH
- Gas: ~0.000001 ETH
- **Total: ~1.003001 ETH**

## ETH Batch Payments

### Function: `sprayETH`

Sends ETH to multiple recipients in one transaction.

**Parameters:**
- `recipients`: Array of `{recipient: address, amount: uint256}` structs

**Value:** Total of all amounts + 0.3% protocol fee

**Example calldata construction:**
```
Function: sprayETH((address,uint256)[])
Recipients: [(0xAAA, 100000000000000000), (0xBBB, 200000000000000000)]
Value: sum of amounts + (sum * 30 / 10000)
```

### Limits
- Maximum 200 recipients per transaction
- Minimum 0.000001 ETH per recipient
- Sender must have sufficient ETH for total + fee + gas

## ERC-20 Batch Payments

### Function: `sprayToken`

Sends ERC-20 tokens to multiple recipients in one transaction.

**Parameters:**
- `token`: ERC-20 token contract address
- `recipients`: Array of `{recipient: address, amount: uint256}` structs

**Prerequisites:**
- Sender must approve the Spraay contract to spend tokens
- Approval amount should cover total + 0.3% fee

**Example flow:**
1. Approve: `token.approve(SPRAAY_CONTRACT, totalAmount + fee)`
2. Spray: `spraay.sprayToken(token, recipients)`

### Supported Tokens
Any standard ERC-20 token on Base, including:
- USDC (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)
- USDT
- DAI
- WETH (0x4200000000000000000000000000000000000006)
- Any community/meme token

## CSV Format

For large distributions, Spraay accepts CSV files:

```csv
address,amount
0x1234567890abcdef1234567890abcdef12345678,0.5
0xabcdef1234567890abcdef1234567890abcdef12,0.2
0x9876543210fedcba9876543210fedcba98765432,1.0
```

**Rules:**
- Header row required: `address,amount`
- One recipient per line
- Addresses must be valid checksummed Ethereum addresses
- Amounts in human-readable format (not wei)
- Maximum 200 rows per CSV (split larger lists)

## Social Handle Resolution

When used alongside the Neynar skill (Farcaster) or ENS:

| Input | Resolution |
|-------|-----------|
| `@alice` (Farcaster) | Resolved via Neynar API → 0x address |
| `alice.eth` | Resolved via ENS → 0x address |
| `0xABC...` | Used directly |

## Protocol Fee Structure

- **Fee rate**: 0.3% (30 basis points)
- **Calculation**: `fee = totalAmount * 30 / 10000`
- **Collection**: Deducted at contract level during execution
- **Transparency**: Fee is emitted in transaction events, verifiable onchain

## Use Cases

### DAO Payroll
Monthly or bi-weekly batch payments to contributors. Combine with Bankr automation:
```
"Set up monthly spray: 500 USDC to 0xAlice, 300 USDC to 0xBob, 800 USDC to 0xCharlie on the 1st of every month"
```

### Token Airdrops
Distribute tokens to community members, contest winners, or early adopters.

### Grant Distributions
Pay out multiple grant recipients from a treasury in one transaction.

### Revenue Sharing
Split revenue among partners, contributors, or stakeholders.

### Event Rewards
Pay speakers, volunteers, or participants after an event.
