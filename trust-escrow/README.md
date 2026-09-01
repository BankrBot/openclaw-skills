# Trust Escrow

**Simple payment escrow for agent-to-agent transactions on Base.**

Lock funds until service is delivered, with automatic release and **full dispute resolution**. Supports ETH and ERC-20 tokens.

## Why?

Agents need to pay each other for work. Trust Escrow makes it safe:
- Payer locks payment before work begins
- Payee delivers service and marks onchain
- Funds auto-release after deadline or payer completes manually
- **Built-in arbitrator for dispute resolution** (funds never permanently locked)

**No third-party custody. No indefinite lockups. Just clean settlement.**

## Features

- ✅ ETH and ERC-20 token support
- ✅ Service delivery confirmation pattern
- ✅ Auto-release after deadline
- ✅ **Full dispute resolution with arbitrator** (CRITICAL FIX)
- ✅ No fee on dispute resolutions (full amount to decided party)
- ✅ 0.5% platform fee on normal completions
- ✅ Deployed on Base

## Security Fix (v1.1)

**🔴 CRITICAL:** Previous version had a funds lock vulnerability where disputes could permanently trap funds.

**✅ FIXED:** Added `resolveDispute()` function restricted to arbitrator:
- Arbitrator can decide refund (return to payer) or release (pay to payee)
- No platform fee taken on dispute resolutions
- Funds never permanently locked

## Quick Start

### Deploy Contract

```bash
export PRIVATE_KEY=0x...
export FEE_RECIPIENT=0x...  # Your wallet for fees
export ARBITRATOR=0x...     # Address for dispute resolution

./scripts/deploy.sh
```

### Create Escrow (ETH)

```bash
cast send $ESCROW_ADDRESS \
  "createEscrow(address,uint256,string)(uint256)" \
  $PAYEE_ADDRESS \
  $(($(date +%s) + 86400)) \
  "Custom skill development" \
  --value 0.01ether \
  --private-key $PRIVATE_KEY
```

### Payee Delivers Service

```bash
cast send $ESCROW_ADDRESS \
  "deliverService(uint256)" \
  $ESCROW_ID \
  --private-key $PAYEE_KEY
```

### Payer Completes (or auto-releases after deadline)

```bash
# Manual completion
cast send $ESCROW_ADDRESS \
  "completeEscrow(uint256)" \
  $ESCROW_ID \
  --private-key $PAYER_KEY

# Or wait for deadline, then anyone can call:
cast send $ESCROW_ADDRESS \
  "releaseAfterDeadline(uint256)" \
  $ESCROW_ID
```

## Dispute Resolution

### Raise Dispute (Either Party)

```bash
cast send $ESCROW_ADDRESS \
  "dispute(uint256)" \
  $ESCROW_ID \
  --private-key $PRIVATE_KEY
```

### Resolve Dispute (Arbitrator Only)

```bash
# Refund to payer (dispute in payer's favor)
cast send $ESCROW_ADDRESS \
  "resolveDispute(uint256,bool)" \
  $ESCROW_ID \
  true \
  --private-key $ARBITRATOR_KEY

# Release to payee (dispute in payee's favor)
cast send $ESCROW_ADDRESS \
  "resolveDispute(uint256,bool)" \
  $ESCROW_ID \
  false \
  --private-key $ARBITRATOR_KEY
```

## Contract Interface

### Core Functions

```solidity
// Create escrow with ETH
function createEscrow(
    address payee,
    uint256 deadline,
    string memory serviceDescription
) external payable returns (uint256)

// Create escrow with ERC-20
function createEscrowToken(
    address payee,
    uint256 amount,
    address token,
    uint256 deadline,
    string memory serviceDescription
) external returns (uint256)

// Payee marks service delivered
function deliverService(uint256 escrowId) external

// Payer completes escrow (releases payment)
function completeEscrow(uint256 escrowId) external

// Auto-release after deadline
function releaseAfterDeadline(uint256 escrowId) external

// Payer cancels before delivery
function cancelEscrow(uint256 escrowId) external

// Either party raises dispute
function dispute(uint256 escrowId) external

// Arbitrator resolves dispute (NEW)
function resolveDispute(uint256 escrowId, bool refund) external

// Change arbitrator (arbitrator only)
function setArbitrator(address newArbitrator) external
```

## Testing

Comprehensive Foundry test suite with **100% coverage**.

**56 test cases** covering:
- ETH and ERC-20 escrow creation
- Service delivery flow
- Completion with fee calculations
- Cancellation and refunds
- Auto-release after deadline
- Dispute raising and resolution
- Arbitrator management
- Fee withdrawal
- All edge cases and reverts

Run tests:

```bash
cd trust-escrow
forge install foundry-rs/forge-std --no-commit
forge install OpenZeppelin/openzeppelin-contracts --no-commit
forge test
forge coverage  # Verify 100% coverage
```

See `test/README.md` for detailed coverage report.

## Security

- ✅ Reentrancy protection on all state-changing functions
- ✅ Access control (payer/payee/arbitrator roles)
- ✅ Deadline enforcement
- ✅ **Dispute resolution (funds never permanently locked)**
- ✅ Cancel within cancellation window
- ✅ 100% test coverage

## Platform Fee

0.5% of payment amount goes to fee recipient on normal completions.

**No fee on dispute resolutions** - full amount goes to decided party.

## Use Cases

- Agent hiring (pay after delivery)
- Service marketplaces
- Cross-agent collaboration
- x402 payment integration
- Bounty systems

## License

MIT

## Built For

Base Autonomous Agent Stack - enabling agents to transact safely.

**#USDCHackathon - Agentic Commerce Track**
