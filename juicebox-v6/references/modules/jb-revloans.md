---
name: jb-revloans
description: |
  REVLoans contract mechanics for revnets. Use when: (1) implementing loan
  borrow/repay/reallocate flows, (2) calculating loan fees and prepaid amounts,
  (3) understanding collateral burn/remint mechanics, (4) building loan UIs,
  (5) explaining loan solvency or liquidation. Covers borrowFrom, repayLoan,
  reallocateCollateralFromLoan, liquidateExpiredLoansFrom, borrowableAmountFrom,
  permissions, and the exact fee schedule.
version: 6.0.0
---

# REVLoans Contract Mechanics

Revnet token holders borrow against their tokens instead of cashing out. The borrowable amount equals what a cash-out would return. Collateral is **burned** on borrow and re-minted on repayment. Each loan is an ERC-721 (`"REV Loans"` / `"$REVLOAN"`), transferable like any NFT — the NFT owner controls the loan.

`REVLoans` is a singleton at the same address on every chain (`references/shared/chain-config.json` → `REVLoans`). Loans exist per chain and cannot move cross-chain.

## Constants

```solidity
uint256 LOAN_LIQUIDATION_DURATION = 3650 days; // 10 years — then collateral is permanently lost
uint256 MIN_PREPAID_FEE_PERCENT   = 25;        // 2.5% of borrow amount (out of JBConstants.MAX_FEE = 1000)
uint256 MAX_PREPAID_FEE_PERCENT   = 500;       // 50%
uint256 REV_PREPAID_FEE_PERCENT   = 10;        // 1% to the $REV revnet (REV_ID)
```

Loan IDs are namespaced per revnet: `loanId = revnetId * 1e18 + loanNumber`. `revnetIdOfLoanWith(loanId)` returns `loanId / 1e18`. `totalLoansBorrowedFor[revnetId]` is a monotonic sequence counter — repaid/reallocated loans leave permanent ID gaps; do not use it to count active loans.

## Loan struct (`loanOf(loanId)`)

| Field | Type | Meaning |
|-------|------|---------|
| `amount` | `uint112` | debt, **includes fees taken at creation** — repayment returns the full amount |
| `collateral` | `uint112` | revnet tokens burned as collateral |
| `createdAt` | `uint48` | creation timestamp |
| `prepaidFeePercent` | `uint16` | fee prepaid at creation (25–500, out of 1000) |
| `prepaidDuration` | `uint32` | seconds of zero-extra-cost repayment: `prepaidFeePercent / 500 × 3650 days` |
| `sourceToken` | `address` | terminal token borrowed (`0x…EEEe` for native) |

## Fee model

At **borrow** time, from the drawn amount:
1. Terminal draw (`useAllowanceOf`) incurs the 2.5% protocol fee.
2. $REV fee: 1% of the borrow amount, paid to the $REV revnet (skipped if $REV has no terminal for the token — then the borrower keeps it).
3. Source fee: `prepaidFeePercent` (2.5%–50%) of the borrow amount, paid back into the source revnet itself.

The borrower receives `netPayout − revFee − sourceFee`; the recorded debt is the full borrow amount.

At **repay** time (`determineSourceFeeAmount`):
- Within `prepaidDuration`: zero extra cost — repay exactly the proportional debt.
- After it: a source fee ramps **linearly** from 0 to 100% of the unprepaid portion at 10 years, charged pro-rata to the principal being repaid:

```
prepaid       = amount × prepaidFeePercent / 1000
fullSourceFee = (amount − prepaid) × (elapsed − prepaidDuration) / (3650 days − prepaidDuration)
sourceFee     = fullSourceFee × principalBeingRepaid / amount
```

- Past 10 years: repay/reallocate revert (`REVLoans_LoanExpired`); only liquidation remains.

Prepaying more buys a longer free window: 2.5% → 6 months; 25% → 5 years; 50% → 10 years (never any extra cost).

## Permissions (JBPermissionIds)

| Action | Permission | ID |
|--------|-----------|-----|
| Open a loan for a holder | `OPEN_LOAN` | 37 |
| Reallocate a loan's collateral | `REALLOCATE_LOAN` | 38 (plus `OPEN_LOAN` if adding fresh collateral) |
| Repay a loan | `REPAY_LOAN` | 39 |
| REVLoans burns the holder's collateral | `BURN_TOKENS` | 11 — the holder must grant this to the REVLoans address via `JBPermissions.setPermissionsFor` before borrowing |

Callers acting on their own tokens/loans pass the permission checks implicitly. Delegated operators control `beneficiary`, so they can redirect funds — grant loan permissions only to fully trusted operators.

## Key functions

### borrowFrom — open a loan

```solidity
function borrowFrom(
    uint256 revnetId,
    address token,              // must have an accounting context on the canonical multi terminal
    uint256 minBorrowAmount,    // slippage floor, denominated in `token`
    uint256 collateralCount,    // revnet tokens to burn as collateral (must be > 0)
    address payable beneficiary,// receives borrowed funds + fee-payment tokens
    uint256 prepaidFeePercent,  // 25–500
    address holder              // whose tokens are burned; receives the loan NFT
) external returns (uint256 loanId, REVLoan memory loan);
```

The borrow amount is **computed by the contract** — the collateral's current cash-out value, capped at the terminal's live surplus. `minBorrowAmount` protects against unfavorable movement. Reverts before the revnet's cash-out delay elapses (7 days after an existing revnet lands on a new chain), and reverts on a zero borrow amount.

### repayLoan — repay and reclaim collateral

```solidity
function repayLoan(
    uint256 loanId,
    uint256 maxRepayBorrowAmount,     // cap on what the caller will pay (source token units)
    uint256 collateralCountToReturn,  // collateral to get re-minted
    address payable beneficiary,      // receives re-minted collateral
    JBSingleAllowance calldata allowance // permit2, zeroed if using direct approval / native
) external payable returns (uint256 paidOffLoanId, REVLoan memory paidOffLoan);
```

Repay amount = `loan.amount − newBorrowAmount + sourceFee`, where `newBorrowAmount` re-values the *remaining* collateral on the current bonding curve. Partial repayment burns the old NFT and mints a **new loan ID** carrying the remainder (same `createdAt` — the liquidation clock does not reset). Excess payment is refunded to the caller. If the remaining collateral would support zero debt, the contract treats it as a full repay. Fee-on-transfer source tokens are rejected.

### reallocateCollateralFromLoan — extract appreciated headroom

```solidity
function reallocateCollateralFromLoan(
    uint256 loanId,
    uint256 collateralCountToTransfer, // collateral moved from the original loan
    address token,                     // must equal the existing loan's sourceToken
    uint256 minBorrowAmount,
    uint256 collateralCountToAdd,      // fresh collateral from the owner's balance (requires OPEN_LOAN)
    address payable beneficiary,
    uint256 prepaidFeePercent
) external returns (uint256 reallocatedLoanId, uint256 newLoanId, REVLoan memory, REVLoan memory);
```

Burns the original NFT and creates **two** loans: a reallocated loan keeping the original debt and `createdAt` with reduced collateral (the reduced collateral must still cover the debt), and a brand-new loan (fresh `createdAt`, fresh fees) borrowing against `collateralCountToTransfer + collateralCountToAdd`. Not payable.

### liquidateExpiredLoansFrom — clean up expired loans

```solidity
function liquidateExpiredLoansFrom(uint256 revnetId, uint256 startingLoanId, uint256 count) external;
```

Permissionless. Iterates loan **numbers** (not full IDs) within the revnet's namespace, burning loans older than 10 years. Collateral was already burned at deposit — liquidation just removes it from tracking, permanently. The borrower keeps the borrowed funds.

### borrowableAmountFrom — preview

```solidity
function borrowableAmountFrom(uint256 revnetId, uint256 collateralCount, uint256 decimals, uint256 currency)
    external view returns (uint256 borrowableNow, uint256 borrowableCapacity);
```

- `borrowableNow` — what a borrow can execute right now (capped at the terminal's live balance). Use for new borrows.
- `borrowableCapacity` — the economic ceiling including amounts already lent out. Use when valuing existing collateral (repay/reallocate headroom).

Internally: cash-out value via `JBCashOuts.cashOutFrom` with `effectiveSupply = totalSupply + totalCollateralOf` and `effectiveSurplus = terminalSurplus + totalBorrowedFrom` (plus remote supply/surplus unless the stage scopes cash-outs to local balances), at the **current stage's** `cashOutTaxRate`. Returns `(0, 0)` during a cash-out delay.

```typescript
// Headroom on an existing loan:
const [, capacity] = await revLoans.read.borrowableAmountFrom([revnetId, loan.collateral, decimals, currency])
const headroom = capacity > loan.amount ? capacity - loan.amount : 0n
// Actual extraction via reallocate is additionally bounded by the terminal's live surplus.
```

## Solvency and stage transitions

- Borrowable value tracks the current bonding curve. Stage transitions that raise `cashOutTaxRate` or cut issuance reduce the value of existing collateral; loans opened earlier may lose reallocation headroom (they never get margin-called — the only deadline is the 10-year liquidation).
- Collateral burn is what makes loans self-liquidating: defaults leave supply reduced and backing intact, raising the floor for remaining holders.

## Common mistakes

- Passing a borrow *amount* to `borrowFrom` — the contract computes the amount from collateral; the caller only sets `minBorrowAmount`.
- Forgetting the holder's `BURN_TOKENS` (11) grant to the REVLoans address — the collateral burn reverts.
- Treating `borrowableAmountFrom` as one value — it returns `(borrowableNow, borrowableCapacity)`; using capacity for a new borrow overestimates when the treasury is heavily lent out.
- Assuming the loan ID survives partial repayment or reallocation — both burn the old NFT and mint new IDs.
- Quoting "0.25%–5%" prepaid bounds or "5% annual interest". Correct: 2.5%–50% prepaid, then a linear ramp to 100% of the unprepaid portion at 10 years.
- Expecting `repayLoan` to accept the loan token — repayment is in the loan's `sourceToken` (the terminal token), sent as `msg.value` for native or pulled via approval/permit2 for ERC-20s.
