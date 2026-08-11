---
name: revnet-economics
description: |
  Economic thresholds and academic findings for revnets (CryptoEconLab research) mapped to
  Juicebox V6 contract mechanics. Use when: (1) explaining cash-out vs loan decision
  thresholds, (2) discussing loan solvency guarantees, (3) recommending revnet archetypes,
  (4) explaining price corridor dynamics, (5) citing academic sources for revnet mechanics.
  Includes the bonding curve formula, rational actor analysis, the three revnet archetypes,
  and the exact on-chain fee structure.
version: 6.0.0
---

# Revnet Economics

## Source papers

All academic findings from CryptoEconLab (cryptoeconlab.com/paper/pub-0):

1. **"Cryptoeconomics of Revnets"** (34 pages) — main whitepaper
2. **"Revnet Value Flows as a Continuous-Time Dynamical System"** (6 pages) — ODE formalization
3. **"Revnet Parameters Analysis"** (15 pages) — archetype recommendations

## Bonding curve formula

The cash-out curve is convex, implemented in `JBCashOuts.cashOutFrom` (nana-core):

```
C(q; S, B) = (q/S) × B × [(1 − r) + r × (q/S)]
```

| Symbol | Meaning | On-chain unit |
|--------|---------|---------------|
| `q` | tokens being cashed out | `cashOutCount` (18 decimals) |
| `S` | total supply | `totalSupply` (includes burned loan collateral) |
| `B` | treasury backing | `surplus` (cross-chain aggregated unless `scopeCashOutsToLocalBalances` is set) |
| `r` | cash-out tax rate | `cashOutTaxRate / 10_000` (`JBConstants.MAX_CASH_OUT_TAX_RATE = 10_000`) |

Edge cases in the implementation: `q >= S` returns the full surplus; `r = 10_000` returns 0 (REVDeployer rejects stages configured at the max, so cash-outs can never be fully disabled on a revnet).

Cashing out a larger fraction of supply returns proportionally more per token:

```
r = 0.5 (cashOutTaxRate = 5000)
- Cash out 1% of supply  → 0.505% of treasury (per-token value: 50.5%)
- Cash out 50% of supply → 37.5% of treasury  (per-token value: 75%)
- Cash out 100% of supply → 100% of treasury
```

## Price corridor

Revnet tokens trade within a bounded corridor: `P_floor ≤ P_AMM ≤ P_ceil`.

- **Floor (`P_floor`)** — cash-out value per token. Enforced by arbitrage: AMM price below floor → buy on AMM, cash out at floor. Monotonically non-decreasing while no cash-outs occur.
- **Ceiling (`P_ceil`)** — issuance price (`1 / weight` in base currency terms). Enforced by arbitrage: AMM price above ceiling → pay the revnet, sell tokens on AMM. Rises over time as issuance cuts (`issuanceCutPercent` every `issuanceCutFrequency` seconds) reduce the weight.
- Every revnet auto-deploys a Uniswap V4 buyback pool at the issuance price (1% fee tier, 2-day TWAP window), and the buyback hook routes payments through the pool whenever it beats issuance, tightening the corridor in practice.

> "These arbitrage mechanisms establish a self-enforcing price corridor that persists regardless of market conditions." — Cryptoeconomics of Revnets

## Loan solvency guarantee

**Theorem:** the revnet remains solvent for any sequence of loans, regardless of number, size, or defaults.

On-chain mechanics backing the proof (see `REVLoans`):

1. The borrowable amount equals the collateral's cash-out value (`JBCashOuts.cashOutFrom` over effective supply and surplus), capped at what the terminal can actually disburse.
2. Collateral tokens are **burned** at origination (`CONTROLLER.burnTokensOf`) — reducing live supply and raising the floor for remaining holders. Loan math adds the burned collateral back into the effective supply so pricing stays fair.
3. On repayment the treasury receives the funds back (`addToBalanceOf`) and collateral is re-minted to the beneficiary.
4. On default (10-year liquidation), the treasury keeps the borrowed funds' accounting and the collateral stays burned — floor rises for everyone else.

The `cashOutTaxRate` acts as an implicit margin buffer: with a 20% tax, borrowers extract only ~80% of their pro-rata surplus, leaving a ~20% cushion. A 0% tax means true 100% LTV.

## Rational actor thresholds

### Cash-out vs loan

Take a **loan instead of cashing out** when the cash-out tax rate exceeds ≈ **39.16%** (`cashOutTaxRate ≈ 3916`):

- `cashOutTaxRate < 3916` → cash out (bonding-curve penalty is cheaper than loan fees)
- `cashOutTaxRate ≥ 3916` → borrow (avoid the tax, keep upside exposure)

The threshold assumes standard fee parameters; recompute if comparing against a large prepaid fee choice.

### Loan vs hold

Borrow when expected return on the borrowed capital exceeds `R > (1 − a) / a`, where `a` is the effective loan-to-value ratio.

## On-chain fee structure

| Fee | Rate | Basis | Recipient |
|-----|------|-------|-----------|
| Protocol fee | 2.5% (`JBConstants.STANDARD_FEE = 25` / `MAX_FEE = 1000`) | funds leaving a treasury (loan draws via `useAllowanceOf`, payouts) | protocol fee project (NANA, project 1) |
| Loan prepaid source fee | 2.5%–50%, borrower's choice (`prepaidFeePercent` 25–500 / 1000) | borrow amount | the source revnet's own treasury |
| Loan $REV fee | 1% (`REV_PREPAID_FEE_PERCENT = 10` / 1000) | borrow amount | $REV revnet (`REVLoans.REV_ID`) |
| Loan time-based source fee | ramps linearly from 0 (end of prepaid window) to 100% of the unprepaid portion at 10 years | unpaid principal | the source revnet's own treasury |
| Cash-out fee | 2.5% of the cashed-out **token count** (`JBFees.standardFeeAmountFrom`) | tokens being cashed out | fee revnet (`REVOwner.FEE_REVNET_ID`); skipped entirely when `cashOutTaxRate == 0` or the beneficiary is feeless |

The prepaid fee buys a zero-extra-cost repayment window proportional to the percent paid: `prepaidDuration = prepaidFeePercent / 500 × 10 years` (2.5% → 6 months, 50% → the full 10 years). All loans liquidate at 10 years (`LOAN_LIQUIDATION_DURATION = 3650 days`), permanently destroying the collateral.

## Three revnet archetypes

Stage parameters use `REVStageConfig` field names: `splitPercent` out of 10,000; `cashOutTaxRate` out of 10,000; `issuanceCutPercent` out of 1,000,000,000; `initialIssuance` is tokens per unit of base currency (18-decimal fixed point).

### 1. Token launchpad (speculative)

High initial issuance, steep cuts, low tax — price appreciation through supply scarcity.

```
initialIssuance:      1_000_000e18   (1M tokens per base-currency unit)
issuanceCutPercent:   100_000_000    (10% per period)
issuanceCutFrequency: 604_800        (7 days)
cashOutTaxRate:       0
splitPercent:         2_000          (20% to operator splits, decreasing in later stages)
```

### 2. Stable-commerce (loyalty / stablecoin)

Stable issuance, no cuts, high tax — treasury retention over speculation.

```
initialIssuance:      100e18
issuanceCutPercent:   0
cashOutTaxRate:       8_000          (80%)
splitPercent:         1_000          (10%)
```

### 3. Periodic fundraising

Multiple stages mirroring funding rounds. Stage `startsAtOrAfter` timestamps must be strictly increasing; stages are immutable after deployment.

```
Stage 1 (seed):     90 days,  initialIssuance 500_000e18, splitPercent 3_000
Stage 2 (series A): 180 days, initialIssuance 250_000e18, splitPercent 2_000
Stage 3 (public):   open-ended, initialIssuance 100_000e18, issuanceCutPercent 50_000_000 (5%), splitPercent 1_000
```

## Dynamical system behavior

The floor price follows `dP_floor/dt = f(inflows, outflows, supply changes)`:

- Monotonically non-decreasing while no cash-outs occur
- Payments raise backing (and supply, unless routed through the buyback pool)
- Cash-outs remove backing and supply; with non-zero tax, the floor still rises for remaining holders
- Loan defaults raise the floor (backing kept, supply reduction is permanent)

## Common mistakes

- Quoting a "5% annual interest after grace period" loan model. The actual cost model is the linear source-fee ramp: 0 during the prepaid window, then rising to 100% of the unprepaid portion at the 10-year liquidation.
- Treating the cash-out fee as a percentage of reclaimed value. It is 2.5% of the **token count** being cashed out; the fee revnet receives that share's bonding-curve reclaim.
- Assuming cash-outs can be disabled. `REVDeployer` rejects any stage with `cashOutTaxRate >= 10_000`.
- Forgetting burned loan collateral in supply math. Cash-out and loan pricing both use `totalSupply + totalCollateralOf[revnetId]`, plus remote supply/surplus unless `scopeCashOutsToLocalBalances` is set.
