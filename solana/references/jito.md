# Jito MEV Bundles

Submit atomic transaction bundles with priority execution.

## Overview

Jito is Solana's leading MEV infrastructure. Key features:
- **Bundles**: Multiple txs that execute all-or-nothing
- **Tips**: Pay validators for priority inclusion
- **Protection**: Prevent sandwich attacks on your swaps

## When to Use Jito

### Arbitrage
Multi-hop swaps that must execute atomically:
```
Buy on DEX A → Sell on DEX B → Profit
```
If any step fails, entire bundle reverts.

### Sandwich Protection
Your swap can't be frontrun if submitted as a bundle with appropriate tip.

### Liquidations
Capture liquidation opportunities before others.

### Multi-Transaction Operations
Token launch + initial buy in one atomic bundle.

### Time-Sensitive Trades
Priority inclusion during network congestion.

## Bundle Basics

### What's in a Bundle?

| Component | Description |
|-----------|-------------|
| Transactions | 1-5 serialized transactions |
| Tip | Payment to validators (lamports) |
| Expiry | When bundle becomes invalid |

### Execution Guarantees

- **All-or-nothing**: Every tx succeeds or entire bundle fails
- **Ordering**: Transactions execute in specified order
- **Atomicity**: No external txs can insert between yours

## Creating Bundles

### Simple Bundle

**Prompt examples:**
- "Submit my swap as a Jito bundle"
- "Bundle this transaction with 0.001 SOL tip"
- "Send with MEV protection"

### Multi-Transaction Bundle

- "Bundle: first swap SOL→USDC, then USDC→JUP"
- "Atomic: create token then buy initial supply"
- "Bundle liquidation with position close"

### With Specific Tip

- "Jito bundle with 10,000 lamport tip"
- "High priority bundle (0.01 SOL tip)"
- "Submit with maximum priority"

## Tip Guidelines

| Priority | Tip (lamports) | Tip (SOL) | Use Case |
|----------|---------------|-----------|----------|
| Low | 1,000 | 0.000001 | Non-urgent |
| Normal | 10,000 | 0.00001 | Standard |
| High | 100,000 | 0.0001 | Competitive |
| Urgent | 1,000,000 | 0.001 | Time-critical |
| Extreme | 10,000,000+ | 0.01+ | Must land now |

**Dynamic tips:**
During high congestion, monitor successful bundle tips and adjust.

## API Usage

### Block Engine Endpoints

| Region | Endpoint |
|--------|----------|
| Amsterdam | `amsterdam.mainnet.block-engine.jito.wtf` |
| Frankfurt | `frankfurt.mainnet.block-engine.jito.wtf` |
| New York | `ny.mainnet.block-engine.jito.wtf` |
| Tokyo | `tokyo.mainnet.block-engine.jito.wtf` |

### Submit Bundle

```bash
scripts/solana-native.sh jito submit \
  --transactions tx1.bin,tx2.bin \
  --tip 10000
```

### Check Bundle Status

```bash
scripts/solana-native.sh jito status <bundle_id>
```

## TypeScript Example

```typescript
import { searcherClient } from 'jito-ts/dist/sdk/block-engine/searcher';
import { Bundle } from 'jito-ts/dist/sdk/block-engine/types';

const client = searcherClient(
  'ny.mainnet.block-engine.jito.wtf',
  authKeypair
);

// Create bundle
const bundle = new Bundle(
  [transaction1, transaction2],
  tipLamports
);

// Submit
const bundleId = await client.sendBundle(bundle);

// Check status
const status = await client.getBundleStatuses([bundleId]);
```

## Bundle Status

| Status | Meaning |
|--------|---------|
| Pending | Submitted, waiting for slot |
| Landed | Successfully included in block |
| Failed | Execution failed |
| Dropped | Not included (tip too low, expired) |

## Common Patterns

### Protected Swap

```
1. Build swap transaction
2. Add tip instruction
3. Submit as bundle
4. Swap cannot be sandwiched
```

### Atomic Arbitrage

```
1. Transaction 1: Buy on Raydium
2. Transaction 2: Sell on Orca
3. Bundle ensures both execute or neither
```

### Token Launch Bundle

```
1. Transaction 1: Create token
2. Transaction 2: Create pool
3. Transaction 3: Initial buy
4. All atomic - no snipers between steps
```

## Best Practices

1. **Simulate first** - Test bundle with simulateBundle
2. **Dynamic tips** - Adjust based on network conditions
3. **Handle failures** - Retry with higher tip if dropped
4. **Use regional endpoints** - Lower latency
5. **Monitor bundle rate** - Track landing success

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Bundle dropped | Increase tip |
| Simulation failed | Check transaction validity |
| Timeout | Try different block engine |
| Low landing rate | Tip below competitive threshold |

## Costs

| Item | Cost |
|------|------|
| Bundle submission | Free |
| Tips | Variable (you choose) |
| Transaction fees | Standard Solana fees |

**Note:** Tips are only paid if bundle lands. Failed/dropped bundles cost nothing.

## Resources

- **Jito Labs**: https://jito.wtf
- **Documentation**: https://docs.jito.wtf
- **TypeScript SDK**: https://github.com/jito-labs/jito-ts
- **Block Explorer**: https://explorer.jito.wtf
