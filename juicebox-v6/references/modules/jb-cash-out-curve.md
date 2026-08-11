---
name: jb-cash-out-curve
description: |
  Juicebox cash-out calculations using the bonding curve formula. Use when: (1) displaying cash-out
  values in UI, (2) explaining reclaim amounts to users, (3) calculating what share of surplus a
  cash out returns. The simple "X% of proportional share" is WRONG — the return depends on what
  fraction of supply is being cashed out.
version: 6.0.0
---

# Cash-Out Bonding Curve

## Problem

For a 10% cash-out tax it's tempting to display "cashing out returns 90% of your proportional share". That's wrong. The reclaim follows a bonding curve where the fraction of supply being cashed out changes the per-token return.

## The formula (`JBCashOuts.cashOutFrom`, nana-core-v6)

```
reclaim = (surplus × count / supply) × [ (MAX − r) + r × count / supply ] / MAX
```

Where:

| Symbol | Meaning |
|--------|---------|
| `surplus` | terminal-token surplus available for cash outs |
| `count` | project tokens being cashed out (18-decimal fixed point) |
| `supply` | total project token supply, including reserved (18-decimal fixed point) |
| `r` | `cashOutTaxRate`, basis points out of `MAX = JBConstants.MAX_CASH_OUT_TAX_RATE = 10_000` |

Edge cases handled on-chain:

- `count == 0` → 0
- `r == 10_000` (100% tax) → 0 — cash outs effectively disabled
- `count >= supply` → entire surplus
- `r == 0` → pure proportional: `surplus × count / supply`

Normalized (with `f = count/supply` and `r` as a 0–1 decimal): `reclaimFraction = f × ((1 − r) + r × f)`.

The inverse exists on-chain too: `JBCashOuts.minCashOutCountFor(surplus, desiredOutput, totalSupply, cashOutTaxRate)` binary-searches the minimum token count yielding at least `desiredOutput`.

## Key insight

The return depends on **how much of the supply** is cashed out, not just the tax rate. Small cash outs at non-zero tax get less than proportional; the shortfall stays in the treasury and improves the floor for remaining holders. The curve rewards holding.

## Example

10% tax (`r = 0.1`), cashing out 10% of supply (`f = 0.1`):

```
reclaimFraction = 0.1 × ((1 − 0.1) + 0.1 × 0.1) = 0.1 × 0.91 = 0.091   // 9.1% of surplus
```

## Code

```typescript
// WRONG:
const retained = 100 - cashOutTaxRate / 100

// CORRECT — mirror JBCashOuts.cashOutFrom:
function calculateCashOutReturn(
  tokensToCashOut: number,
  totalSupply: number,
  surplus: number,
  cashOutTaxRate: number // 0-10000 basis points
): number {
  if (tokensToCashOut === 0 || cashOutTaxRate >= 10000) return 0
  if (tokensToCashOut >= totalSupply) return surplus
  const r = cashOutTaxRate / 10000
  const f = tokensToCashOut / totalSupply
  return surplus * f * ((1 - r) + r * f)
}
```

Verification values:

| r | f | reclaimFraction |
|---|---|-----------------|
| 0 | any | `f` (linear) |
| 1 | any | `f²` (quadratic) |
| 0.1 | 0.1 | 0.091 |
| 0.1 | 0.5 | 0.475 |

## On-chain quoting (preferred for UIs)

`JBTerminalStore` (`0x7497ae014a60561925b51c0a3b4ade7460b9927c`):

```solidity
// Pure curve math against explicit inputs (does NOT run data hooks):
function currentReclaimableSurplusOf(uint256 projectId, uint256 cashOutCount, uint256 totalSupply, uint256 surplus)
    external view returns (uint256);

// Aggregates surplus across terminals/tokens, reads supply and tax rate itself:
function currentReclaimableSurplusOf(uint256 projectId, uint256 cashOutCount, IJBTerminal[] memory terminals,
    address[] memory tokens, uint256 decimals, uint256 currency) public view returns (uint256);

// Full simulation INCLUDING data hooks (revnets, buyback hook, cross-chain supply adjustments):
function previewCashOutFrom(address terminal, address holder, uint256 projectId, uint256 cashOutCount,
    address tokenToReclaim, bool beneficiaryIsFeeless, bytes calldata metadata)
    external view returns (JBRuleset memory ruleset, uint256 reclaimAmount, uint256 cashOutTaxRate,
    JBCashOutHookSpecification[] memory hookSpecifications);
```

Use `previewCashOutFrom` for revnets — their data hook overrides supply/surplus with omnichain-adjusted values and carves out the REV fee; the plain views can't see that.

## Fees stack on top

The curve output is not what the user receives:

- Protocol fee: 2.5% off the reclaim when `cashOutTaxRate != 0` and the beneficiary isn't feeless (zero-tax cash outs are fee-free except for the round-trip `feeFreeSurplusOf` guard).
- Revnets additionally carve 2.5% of the cash-out **token count** for REV before the curve applies to the rest.

See `jb-protocol-fees`.

## Common mistakes

1. **Linear "100% − tax" messaging.** Use the curve; show a concrete example ("cashing out 10% of supply returns ~9.1% of surplus at a 10% tax").
2. **Forgetting `cashOutTaxRate == 10_000` disables cash outs.** Show a "cash outs disabled" state.
3. **Using total supply without reserved tokens.** On-chain math uses `totalTokenSupplyWithReservedTokensOf`.
4. **Quoting revnets with the pure-math views.** Data hooks change supply, surplus, and fees — use `previewCashOutFrom`.
5. **Displaying the curve output as the receive amount.** Apply the protocol fee (and revnet fee) for the net figure.
