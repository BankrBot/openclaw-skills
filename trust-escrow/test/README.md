# TrustEscrow Tests

Comprehensive Foundry tests providing 100% coverage of the TrustEscrow contract.

## Setup

Install Foundry (if not already installed):

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

Install dependencies:

```bash
cd trust-escrow
forge install foundry-rs/forge-std --no-commit
forge install OpenZeppelin/openzeppelin-contracts --no-commit
```

## Run Tests

```bash
# Run all tests
forge test

# Run with verbosity
forge test -vvv

# Run with gas report
forge test --gas-report

# Run with coverage
forge coverage
```

## Coverage Report

The test suite covers:

### ✅ ETH Escrow Creation
- Happy path
- Zero amount rejection
- Invalid payee rejection (zero address & self)
- Past deadline rejection

### ✅ ERC-20 Escrow Creation
- Happy path with token transfer
- Zero amount rejection
- Invalid token rejection
- Invalid payee rejection
- Past deadline rejection

### ✅ Service Delivery
- Payee marking delivery
- Non-payee rejection
- Inactive escrow rejection
- Duplicate delivery rejection

### ✅ Escrow Completion
- ETH payment with platform fee
- ERC-20 payment with platform fee
- Non-payer rejection
- Non-active escrow rejection
- Undelivered service rejection

### ✅ Escrow Cancellation
- ETH refund
- ERC-20 refund
- Non-payer rejection
- Non-active escrow rejection
- Post-delivery rejection

### ✅ Auto-Release After Deadline
- Happy path with fee collection
- Non-active escrow rejection
- Undelivered service rejection
- Pre-deadline rejection

### ✅ Dispute Flow
- Payer raising dispute
- Payee raising dispute
- Non-active escrow rejection
- Unauthorized party rejection

### ✅ Dispute Resolution
- Refund to payer (no fee)
- Payment to payee (no fee)
- Non-arbitrator rejection
- Non-disputed escrow rejection

### ✅ Arbitrator Management
- Arbitrator change
- Non-arbitrator rejection
- Zero address rejection

### ✅ Fee Withdrawal
- Platform fee withdrawal
- Non-recipient rejection

## Test Count

56 test cases covering all functions, branches, and edge cases.
