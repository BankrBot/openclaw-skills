---
name: jb-protocol-fees
description: |
  Juicebox and Revnet protocol fee structures and UI integration. Use when: (1) calculating net
  amounts after fees for payouts, surplus allowance, or cash outs, (2) building cash out or loan
  UIs for revnets, (3) determining when the 2.5% protocol fee applies and who is exempt,
  (4) working with held fees (28-day hold, processing, returning), (5) displaying fee breakdowns.
version: 6.0.0
---

# Juicebox & Revnet Protocol Fees

## Fee overview

| Fee | Rate | Defined in | Recipient |
|-----|------|-----------|-----------|
| Protocol fee | 2.5% (`STANDARD_FEE = 25` / `MAX_FEE = 1000`) | `JBConstants` (nana-core-v6) | Project #1 — NANA (`JBConstants.FEE_BENEFICIARY_PROJECT_ID = 1`) |
| Revnet cash-out fee | 2.5% of the **token count** being cashed out | `JBFees.standardFeeAmountFrom` used in `REVOwner.beforeCashOutRecordedWith` | REV revnet (project #3, `FEE_REVNET_ID`) |
| REV loan fee | 1% of borrowed amount (`REV_PREPAID_FEE_PERCENT = 10` / 1000) | `REVLoans` | REV revnet (project #3) |
| Loan prepaid source fee | 2.5%–50% of borrowed amount, borrower's choice (`MIN_PREPAID_FEE_PERCENT = 25`, `MAX_PREPAID_FEE_PERCENT = 500`, / 1000) | `REVLoans` | Source revnet (paid back into its treasury via `pay`) |
| Loan variable source fee | 0–100% of the un-prepaid remainder, linear ramp after the prepaid window until 10 years (`LOAN_LIQUIDATION_DURATION = 3650 days`) | `REVLoansSourceFees` | Source revnet |

The fee rate is a protocol constant, not a per-terminal storage value. There is no `FEE()` getter on the terminal; read `JBConstants.STANDARD_FEE`.

## Fee math (`JBFees`, nana-core-v6)

```solidity
// Fee from a known gross amount: amount * 25 / 1000. The standard variant is pre-reduced to 1/40.
function feeAmountFrom(uint256 amountBeforeFee, uint256 feePercent) internal pure returns (uint256);
function standardFeeAmountFrom(uint256 amountBeforeFee) internal pure returns (uint256); // amount / 40

// Fee needed on top of a desired net amount: mulDiv(net, 1000, 975) - net (standard: mulDiv(net, 40, 39) - net).
function feeAmountResultingIn(uint256 amountAfterFee, uint256 feePercent) internal pure returns (uint256);
function standardFeeAmountResultingIn(uint256 amountAfterFee) internal pure returns (uint256);
```

```typescript
const JB_FEE = 0.025
const net   = (gross: number) => gross * 0.975       // amount after fee
const gross = (net: number)   => net * 40 / 39       // amount needed to net `net`
```

## When the protocol fee applies (`JBMultiTerminal`)

| Operation | Fee? |
|-----------|------|
| Payouts (`sendPayoutsOf`) to wallet addresses and to the project owner remainder | Yes |
| Payouts to split hooks | Yes, unless the hook is feeless |
| Payouts to another project whose resolved terminal is the **same** terminal contract | **No** — funds never leave the terminal (intra-terminal `pay`/`addToBalance`) |
| Payouts to another project on a **different** terminal | Yes, unless the recipient terminal is feeless |
| Surplus allowance (`useAllowanceOf`) | Yes, unless the caller resolves feeless |
| Cash outs with `cashOutTaxRate != 0` | Yes — on the full reclaim amount, unless the beneficiary is feeless |
| Cash outs with `cashOutTaxRate == 0` | Only up to the project's `feeFreeSurplusOf[projectId][token]` balance — a round-trip-prevention accumulator, not a routine fee |
| Cash-out hook payloads | Yes, unless the hook is feeless |
| Terminal migration (`migrateBalanceOf`) to a non-feeless terminal | Yes (project #1 exempt) |

Feeless status lives in `JBFeelessAddresses` (`0x657d0e588fca6f8c49394c9ca8a1cf6505b10314`), managed by the protocol multisig, and is **per-project**: `isFeelessFor(addr, projectId, caller)`. `projectId = 0` is the all-projects wildcard. An optional owner-set `feelessHook` can widen (never shrink) the feeless set and may scope grants by the outer caller.

## What the fee buys

The fee is paid into project #1's primary terminal for the token via `pay`, with the operation's beneficiary as the pay beneficiary — **the fee payer receives NANA (project #1) tokens** per NANA's current ruleset. If the beneficiary is `address(0)`, the fee is added to project #1's balance without minting.

Fee processing is fail-open: if the fee route reverts, the fee is forgiven, credited back to the paying project's balance, tracked in `feeFreeSurplusOf`, and surfaced via a `FeeReverted` event. Payouts never get stuck on a broken fee route.

## Held fees

- If the ruleset's `holdFees` metadata flag is set, fees on payouts and allowance usage are recorded (`JBFee { uint224 amount; address beneficiary; uint48 unlockTimestamp }`) instead of processed.
- Hold duration: 28 days (`_FEE_HOLDING_SECONDS = 2_419_200`).
- `processHeldFeesOf(projectId, token, count)` is permissionless once unlocked; it finalizes the fee payment to project #1.
- `addToBalanceOf(..., shouldReturnHeldFees: true, ...)` returns held fees proportional to the amount added — projects that bring funds back before processing don't pay fees on the round trip.
- `heldFeesOf(projectId, token, count)` reads pending records.

## Revnet cash-out fee (revnet-core-v6)

Applied in `REVOwner.beforeCashOutRecordedWith` (the data hook every revnet uses):

1. Skipped entirely when `cashOutTaxRate == 0`, when REV has no terminal for the token, or when the beneficiary is feeless (suckers and the router terminal are feeless — cross-chain and routed flows pay no revnet fee).
2. Otherwise 2.5% of the **cash-out token count** is carved out (`JBFees.standardFeeAmountFrom(cashOutCount)`); the fee revnet receives the bonding-curve reclaim of that token share via an `afterCashOutRecordedWith` hook payment into REV (project #3). The fee payer receives REV tokens.
3. The remaining 97.5% of tokens cash out normally — and the terminal's 2.5% **protocol fee** applies on top of the outbound reclaim (recipient: NANA).

Cash-outs from a revnet with non-zero tax therefore bear both fees: ~2.5% revnet fee (in token count) + 2.5% protocol fee (on the reclaimed funds).

## Revnet loan fees (REVLoans, `0x056265c31157748818f0910d1859acd2f7d427de`)

At borrow time, from the gross borrowed amount:

1. **Protocol fee (2.5%)** — the borrow pulls funds via `useAllowanceOf`, which deducts the standard fee (→ NANA; the borrower's beneficiary receives the minted NANA tokens).
2. **REV fee (1%)** — `feeAmountFrom(amount, 10)` paid into REV (project #3); beneficiary receives REV tokens. Skipped (kept by borrower) if REV has no terminal for the token.
3. **Prepaid source fee (2.5%–50%, borrower's choice)** — paid back **into the source revnet** via `pay`; beneficiary receives source-revnet tokens.

Prepaid duration: `prepaidFeePercent / 500 × 3650 days` (50% prepaid → the full 10 years; 2.5% → 6 months).

After the prepaid window, repaying/reallocating incurs a variable source fee that ramps linearly:

```
prepaid          = loan.amount × prepaidFeePercent / 1000
fullSourceFee(t) = (loan.amount − prepaid) × (t − prepaidDuration) / (3650 days − prepaidDuration)
sourceFee        = fullSourceFee × amountBeingRepaid / loan.amount
```

At 10 years the loan expires (`REVLoans_LoanExpired`) and the collateral is liquidatable. `prepaidFeePercent` below 25 (2.5%) or above 500 (50%) reverts.

## UI display patterns

```
Payout:   100.00 → "97.50 after 2.5% protocol fee" (fee payer receives NANA tokens)
Cash out: quote via JBTerminalStore.previewCashOutFrom (runs data hooks; revnet fee included),
          then apply the 2.5% protocol fee to the returned reclaimAmount when cashOutTaxRate != 0.
Loan:     borrow 1.0 → borrower receives 1.0 × 0.975 − 0.01 (REV) − prepaid; unlock cost grows
          linearly after the prepaid window.
```

Custom UI fees are fine — apply them after protocol fees, route to your own address, and display separately.

## Common mistakes

1. **Re-applying fees the chain already applied.** On-chain amounts (`useAllowanceOf` return, `cashOutTokensOf` return) are already net. UI math is for previews only.
2. **Treating same-terminal project-to-project payouts as fee-bearing.** They're free; only cross-terminal or wallet egress pays.
3. **Assuming zero-tax cash-outs are always fee-free.** The `feeFreeSurplusOf` accumulator (funds credited back from forgiven/returned fees) is fee-eligible even at zero tax.
4. **Assuming non-zero-tax cash-outs escape the protocol fee.** Any `cashOutTaxRate != 0` puts the full reclaim in fee scope unless the beneficiary is feeless.
5. **Modeling the revnet cash-out fee as a value percentage.** It's 2.5% of the *token count*; the fee revnet gets that share's bonding-curve reclaim.
6. **Forgetting the loan's protocol-fee leg.** Total at borrow ≈ 2.5% (NANA) + 1% (REV) + prepaid (source revnet, ≥2.5%).
7. **Checking feeless status globally.** V6 feeless grants are per-project (`isFeelessFor(addr, projectId, caller)`); project 0 is the wildcard.
