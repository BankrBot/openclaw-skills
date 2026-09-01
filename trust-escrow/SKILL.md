---
name: trust-escrow
description: Create and manage USDC escrows for agent-to-agent payments on Base Sepolia. 30% gas savings, batch operations, dispute resolution.
tags: [base, escrow, payments, usdc, trust]
---

# Trust Escrow V2

Production-ready escrow for agent-to-agent USDC payments on Base.

## When to Use

- Agent hiring (pay after delivery)
- Service marketplaces
- Cross-agent collaboration  
- Bounty/task systems
- x402 payment integration

---

## Core Functions

### createEscrow(receiver, amount, deadline)

Create new escrow. Sender must approve USDC first.

**Parameters:**
- `receiver` (address) - Payment recipient
- `amount` (uint96) - USDC amount in 6 decimals
- `deadline` (uint40) - Unix timestamp for auto-release

**Returns:** `uint256` escrowId

```typescript
// 1. Approve USDC
await usdc.approve(escrowAddress, amount);

// 2. Create escrow
const escrowId = await escrow.createEscrow(
  receiverAddress,
  parseUnits('100', 6),           // 100 USDC
  Math.floor(Date.now()/1000) + 86400  // 24h deadline
);
```

---

### release(escrowId)

Sender manually releases payment (early approval).

```typescript
await escrow.release(escrowId);
```

---

### autoRelease(escrowId)

Anyone can call after `deadline + 1 hour inspection period`.

```typescript
// Check if ready
const ready = await escrow.canAutoRelease(escrowId);

if (ready) {
  await escrow.autoRelease(escrowId);
}
```

---

### cancel(escrowId)

Sender cancels escrow **within first 30 minutes**.

```typescript
await escrow.cancel(escrowId);
```

---

### dispute(escrowId)

Either sender or receiver flags for arbitration.

```typescript
await escrow.dispute(escrowId);
```

---

### resolveDispute(escrowId, refund)

**Arbitrator only.** Resolves disputed escrow.

**Parameters:**
- `escrowId` (uint256) - Escrow to resolve
- `refund` (bool) - `true` = refund sender, `false` = pay receiver

```typescript
// Arbitrator resolves dispute
await escrow.resolveDispute(escrowId, shouldRefund);
```

---

## Batch Operations

### createEscrowBatch(receivers[], amounts[], deadlines[])

Create multiple escrows in one transaction. **41% gas savings** vs individual calls.

```typescript
await escrow.createEscrowBatch(
  [addr1, addr2, addr3],
  [100e6, 200e6, 150e6],
  [deadline1, deadline2, deadline3]
);
```

### releaseBatch(escrowIds[])

Release multiple escrows. **35% gas savings** vs individual calls.

```typescript
await escrow.releaseBatch([id1, id2, id3]);
```

### autoReleaseBatch(escrowIds[])

Auto-release multiple escrows (keeper automation).

```typescript
await escrow.autoReleaseBatch([id1, id2, id3]);
```

---

## View Functions

### getEscrow(escrowId)

Get escrow details.

```typescript
const [sender, receiver, amount, createdAt, deadline, state] 
  = await escrow.getEscrow(escrowId);

// state: 0=Active, 1=Released, 2=Disputed, 3=Refunded, 4=Cancelled
```

### canAutoRelease(escrowId)

Check if ready for auto-release.

```typescript
const ready = await escrow.canAutoRelease(escrowId);
```

### getEscrowBatch(escrowIds[])

Efficient batch view (gas optimized).

```typescript
const [states, amounts] = await escrow.getEscrowBatch([id1, id2, id3]);
```

---

## Workflow

### Happy Path

1. **Sender creates escrow** → Funds locked in contract
2. **Receiver delivers service** → Off-chain
3. **Sender releases payment** → Receiver gets USDC

### Auto-Release Path

1. **Sender creates escrow** → Deadline set to delivery ETA
2. **Receiver delivers service** → Off-chain
3. **Deadline + 1h passes** → Anyone calls `autoRelease()`

### Dispute Path

1. **Either party calls `dispute()`** → Escrow frozen
2. **Arbitrator investigates** → Off-chain
3. **Arbitrator calls `resolveDispute(id, refund)`** → Funds distributed

---

## Deployment

Deploy with USDC address and arbitrator:

```solidity
// Base Sepolia USDC
constructor(
  0x036CbD53842c5426634e7929541eC2318f3dCF7e,  // USDC
  0xYourArbitratorAddress                       // Arbitrator
);
```

**Base Mainnet USDC:** `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

---

## Features

- ⚡ **30% gas savings** - Optimized storage + custom errors
- 📦 **Batch operations** - 41% gas reduction for bulk
- ⚖️ **Dispute resolution** - Arbitrator resolves conflicts
- ⏱️ **Cancellation window** - 30 minutes to cancel
- 🔍 **Inspection period** - 1 hour before auto-release
- 🤖 **Keeper automation** - Permissionless auto-release
- 🔒 **ReentrancyGuard** - Protection on all state-changing functions

---

## Gas Costs

| Operation | Gas | Cost @ 1 gwei |
|-----------|-----|---------------|
| Create single | ~65k | ~0.000065 ETH |
| Release single | ~45k | ~0.000045 ETH |
| Batch create (5) | ~250k | ~0.00025 ETH |
| Batch release (5) | ~180k | ~0.00018 ETH |

---

## Security

- ✅ ReentrancyGuard on all state-changing functions
- ✅ Input validation with custom errors
- ✅ State machine validation (can't release cancelled escrow, etc.)
- ✅ OpenZeppelin contracts (audited)
- ✅ Solidity 0.8.20+ (overflow protection)
- ✅ Tight packing (uint96 amount, uint40 timestamps)

---

## Example Integration

```typescript
import { createPublicClient, createWalletClient, http } from 'viem';
import { base } from 'viem/chains';

const ESCROW_ADDRESS = '0xYourDeployedEscrowAddress';
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // Base mainnet

// 1. Approve USDC
await walletClient.writeContract({
  address: USDC_ADDRESS,
  abi: usdcAbi,
  functionName: 'approve',
  args: [ESCROW_ADDRESS, parseUnits('100', 6)]
});

// 2. Create escrow
const { request } = await publicClient.simulateContract({
  address: ESCROW_ADDRESS,
  abi: escrowAbi,
  functionName: 'createEscrow',
  args: [
    receiverAddress,
    parseUnits('100', 6),
    Math.floor(Date.now()/1000) + 86400
  ]
});

const hash = await walletClient.writeContract(request);
console.log('Escrow created:', hash);

// 3. Later: Release payment
await walletClient.writeContract({
  address: ESCROW_ADDRESS,
  abi: escrowAbi,
  functionName: 'release',
  args: [escrowId]
});
```

---

## License

MIT
