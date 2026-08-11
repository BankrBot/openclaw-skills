---
name: revnet-modeler
description: |
  Revnet simulation and planning tool for modeling token dynamics before deployment.
  Use when: (1) planning revnet stage parameters, (2) visualizing treasury/token dynamics
  over time, (3) comparing scenarios (loans, cash-outs, investments), (4) interpreting
  chart outputs, (5) sanity-checking simulation math against Juicebox V6 contract behavior.
version: 6.0.0
---

# Revnet Modeler: Simulation Tool

Interactive simulator for revnet tokenomics. Use it to iterate on stage parameters before an immutable deployment.

## Tool location

```
https://github.com/mejango/rev-sim  (open index.html in a browser; runs fully client-side)
```

## Economic levers per stage

Each simulated stage maps 1:1 to a `REVStageConfig` in the deployment:

| Lever | Contract field | Unit |
|-------|----------------|------|
| Stage start | `startsAtOrAfter` | unix timestamp (strictly increasing across stages) |
| Initial issuance rate | `initialIssuance` | tokens per base-currency unit, 18-decimal fixed point |
| Issuance cut % | `issuanceCutPercent` | out of 1,000,000,000 (`JBConstants.MAX_WEIGHT_CUT_PERCENT`) |
| Issuance cut frequency | `issuanceCutFrequency` | seconds (becomes the ruleset duration; keep ≥ 24h) |
| Split % | `splitPercent` | out of 10,000 (becomes the ruleset `reservedPercent`) |
| Cash-out tax rate | `cashOutTaxRate` | out of 10,000; must be < 10,000 |
| Auto-issuances | `autoIssuances[]` | per-chain `{chainId, count, beneficiary}` premints, claimable once the stage starts |

## Event types

| Event | Treasury effect |
|-------|-----------------|
| `investment` / `revenue` | + backing, + supply (payment mints tokens at the current weight) |
| `loan` | − backing (net of fees; debt tracked off-treasury) |
| `payback-loan` | + backing (repayment + any time-based source fee) |
| `cashout` | − backing, − supply (bonding curve + 2.5% token-count fee when tax ≠ 0) |

Events are labeled by participant (e.g. "Team", "Investor A").

## Charts

| Group | Charts | Key insight |
|-------|--------|-------------|
| Treasury & value | Treasury Backing, Cash Out Value, Issuance Price, Cash Flows | floor/ceiling dynamics, event impact |
| Tokens | Token Distribution, Ownership %, Token Valuations, Token Performance | dilution and participant ROI |
| Loans | Loan Potential, Loan Status, Outstanding Loans, Tokens Backing Loans % | available liquidity and leverage exposure |
| Fees | Fee Flows | internal vs external fee destinations |

## Key formulas (validate against contracts)

### Cash-out value (must match `JBCashOuts.cashOutFrom`)

```javascript
function cashOutValue(tokensToCash, totalSupply, backing, cashOutTax /* 0..1 */) {
  const proportionalShare = backing * tokensToCash / totalSupply
  const taxMultiplier = (1 - cashOutTax) + (tokensToCash * cashOutTax / totalSupply)
  return proportionalShare * taxMultiplier
}
```

`totalSupply` must include tokens burned as loan collateral (the contracts add `totalCollateralOf` back), and `backing` must include outstanding borrowed amounts.

### Loan fees (must match `REVLoans`)

```javascript
// At borrow time, out of MAX_FEE = 1000:
const sourceFee = borrowAmount * prepaidFeePercent / 1000  // 25..500 → 2.5%..50%, to the revnet itself
const revFee    = borrowAmount * 10 / 1000                 // 1%, to the $REV revnet
// Plus the 2.5% protocol fee on the terminal draw (useAllowanceOf).
// The loan's recorded debt is the FULL borrowAmount; the borrower nets borrowAmount minus all fees.

// Prepaid window: zero extra repayment cost for
const prepaidDuration = prepaidFeePercent / 500 * TEN_YEARS  // 2.5% → 6 months, 50% → 10 years

// After the window, the source fee on repayment ramps linearly:
const prepaid = loanAmount * prepaidFeePercent / 1000
const fullSourceFee = (loanAmount - prepaid) * (elapsed - prepaidDuration) / (TEN_YEARS - prepaidDuration)
// charged pro-rata to the principal being repaid; at 10 years the loan liquidates and collateral is lost
```

### Borrowable amount

Borrowable = cash-out value of the collateral at the current stage's `cashOutTaxRate`, capped at the terminal's live surplus. Model the cap: a revnet whose treasury is mostly lent out cannot source new loans until repayments arrive.

## Pre-built scenarios

`conservative-growth`, `hypergrowth`, `bootstrap-scale`, `vc-fueled`, `community-driven`, `boom-bust` — each with `-with-loans` and `-with-exits` variants.

## Interpreting results

- **Treasury health**: healthy = backing grows and floor price rises; warning = flat backing with many cash-outs; critical = heavy loan draw-down with no repayments.
- **Token distribution**: balanced = no holder > 50%; watch early-holder dilution across stage transitions.
- **Loan exposure**: < 20% of supply as collateral = safe; > 50% = systemic risk (stage transitions that raise `cashOutTaxRate` shrink borrowable value per collateral token).

## Planning workflow

1. Set stages matching the fundraising/growth plan.
2. Add events for expected investments, revenue, loans, exits.
3. Run and review charts.
4. Iterate on parameters — deployment is immutable, the simulator is the only cheap iteration loop.
5. Stress-test against boom-bust variants before deploying.

## Common mistakes

- Modeling loan interest as a flat annual rate. The contract cost model is the prepaid window + linear ramp to 100% of the unprepaid portion at 10 years.
- Ignoring the borrowable cap: loans draw real terminal balance, so simultaneous large loans can exhaust local surplus even when collateral value is ample.
- Excluding burned collateral from supply when computing cash-out values — the contracts count it.
- Forgetting stage transitions re-price existing loans: a higher `cashOutTaxRate` or lower issuance in a later stage reduces headroom for loans opened earlier.
