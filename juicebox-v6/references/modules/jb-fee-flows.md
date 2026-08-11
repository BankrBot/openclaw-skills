---
name: jb-fee-flows
description: |
  Juicebox ecosystem fee flows and value capture. Use when: (1) explaining how protocol fees route
  to NANA (project 1), (2) explaining how revnet fees route to REV (project 3), (3) describing the
  NANA-REV feedback loop, (4) explaining what fee payers receive in return, (5) explaining layered
  fees on revnet cash outs and loans.
version: 6.0.0
---

# Ecosystem Fee Flows

How fees move through the Juicebox stack and who captures the value. Rates and mechanics are verified in `nana-core-v6` and `revnet-core-v6`; see `jb-protocol-fees` for the exact math.

## The protocol stack

```
LAYER 3: Individual revnets & projects
         (any project; NANA, CPN, and REV are themselves revnets)
              │ built on
              ▼
LAYER 2: Revnet framework (revnet-core-v6)
         Adds staged rulesets, loans, cash-out fee routing.
         REV (project 3) collects fees from all revnet cash outs & loans.
              │ built on
              ▼
LAYER 1: Juicebox protocol (nana-core-v6)
         NANA (project 1, JBConstants.FEE_BENEFICIARY_PROJECT_ID) collects
         the 2.5% protocol fee on qualifying outflows from every project.
```

Both fee recipients are revnets: **NANA is project 1** and **REV is project 3** on every chain (`REVDeployer.FEE_REVNET_ID == 3`).

## Layer 1: protocol fee → NANA

- **Rate**: 2.5% (`STANDARD_FEE = 25` out of `MAX_FEE = 1000`, `JBConstants`).
- **Applies to**: payouts to wallets/split hooks, cross-terminal project payouts, surplus allowance usage, cash outs with non-zero tax rate, terminal migration to non-feeless terminals.
- **Exempt**: same-terminal project-to-project payouts, feeless addresses (`JBFeelessAddresses`, per-project with a project-0 wildcard), project 1 itself.
- **Mechanism**: the terminal pays the fee into project 1's primary terminal for the token via `pay`. **The fee payer's beneficiary receives NANA tokens** minted per NANA's ruleset. Fees route through NANA's issuance machinery — value capture is via NANA token distribution (reserved splits, cash-out backing), not a separate treasury.
- **Fail-open**: a broken fee route forgives the fee back to the paying project (`FeeReverted`) rather than blocking the operation.

## Layer 2: revnet fees → REV

| Action | Fee | Notes |
|--------|-----|-------|
| Revnet cash out (`cashOutTaxRate != 0`) | 2.5% of the **token count** cashed out | REV receives that share's bonding-curve reclaim; skipped at zero tax, for feeless beneficiaries (suckers, router terminal), or when REV has no terminal for the token |
| Loan origination | 1% of borrowed amount (`REV_PREPAID_FEE_PERCENT = 10/1000`) | paid into REV; borrower's beneficiary receives REV tokens |
| Loan prepaid source fee | 2.5%–50% (borrower's choice) | goes **back into the source revnet** via `pay` — treasury revenue that mints source-revnet tokens to the borrower's beneficiary |
| Loan variable source fee | 0→100% of the un-prepaid remainder, linear after the prepaid window until year 10 | also treasury revenue to the source revnet |

Like the protocol fee, REV fees are paid via `pay` — **the fee payer receives REV tokens** in exchange.

## Layered fees in practice

Revnet cash out (non-zero tax), 1000 tokens:

```
1000 tokens
  ├─ 25 tokens (2.5% of count) ──► reclaimed for REV (project 3)   [revnet fee]
  └─ 975 tokens ──► bonding-curve reclaim
        └─ reclaim amount × 2.5% ──► NANA (project 1)              [protocol fee]
User receives: reclaim(975 tokens) × 0.975, plus REV-fee value accrues to REV.
```

Revnet loan of 1.0 (gross):

```
1.0 borrowed via useAllowanceOf
  ├─ 2.5% protocol fee ──► NANA (beneficiary gets NANA tokens)
  ├─ 1%   REV fee      ──► REV  (beneficiary gets REV tokens)
  └─ prepaid fee (2.5%–50%, chosen) ──► back into the source revnet
Borrower receives: 0.975 − 0.01 − prepaid.
```

## The feedback loop

```
ALL PROJECTS ──2.5% protocol fee──► NANA (project 1, a revnet)
ALL REVNETS ──cash-out & loan fees──► REV (project 3, a revnet)
NANA cash-outs/loans ──REV fees──► REV
REV outflows ──2.5% protocol fee──► NANA
```

- NANA is a revnet, so cashing out of NANA or borrowing against NANA tokens pays REV fees → REV.
- REV is a Juicebox project, so its qualifying outflows pay the 2.5% protocol fee → NANA.
- Every fee payment mints the recipient project's tokens to the fee payer, so fee flows continuously distribute NANA and REV ownership to active ecosystem participants while backing both tokens' cash-out value.

## Key distinction: internal vs external fees

- **Internal fees (prepaid + variable loan source fees)**: revenue to the borrower's own revnet treasury; create source-revnet tokens.
- **External fees (protocol fee, REV cash-out/loan fees)**: leave the project for NANA/REV; create NANA/REV tokens for the payer.

## Verification

- Fee constants: `nana-core-v6/src/libraries/JBConstants.sol` (`STANDARD_FEE`, `MAX_FEE`, `FEE_BENEFICIARY_PROJECT_ID`), `revnet-core-v6/src/REVLoans.sol` (prepaid fee bounds), `revnet-core-v6/src/REVOwner.sol` (cash-out fee split).
- Fee routing: `JBMultiTerminal.executeProcessFee` (protocol), `REVOwner.afterCashOutRecordedWith` (revnet cash-out), `REVLoans._addTo` / `_adjust` (loan fees).
- REV project ID: `REVDeployer.FEE_REVNET_ID() == 3` on every chain.

## Common mistakes

1. **Describing fees as burned or siphoned to a wallet.** Every fee is a `pay` into a project; the payer gets that project's tokens.
2. **Applying the revnet cash-out fee at zero tax rate.** Zero-tax revnet cash outs skip the REV fee (and normally the protocol fee too).
3. **Counting the loan prepaid fee as an external fee.** It returns to the borrower's own revnet treasury.
4. **Quoting fixed ownership percentages between ecosystem tokens.** Split configurations are governance-changeable; read current ruleset splits on-chain instead.
