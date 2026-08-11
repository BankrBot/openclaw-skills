---
name: jb-fund-access-limits
description: |
  Configure and query Juicebox fund access limits (payout limits, surplus allowances). Use when:
  (1) configuring project deployment and deciding payout limits — CRITICAL: empty
  fundAccessLimitGroups means ZERO payouts, not unlimited, (2) payoutLimitsOf or
  surplusAllowancesOf returns empty when values are expected, (3) detecting "unlimited"
  (uint224.max) values, (4) querying limits for ERC-20-accounting projects, (5) choosing between
  payout limits and surplus allowance.
version: 6.0.0
---

# Fund Access Limits

`JBFundAccessLimits` (`0xc93360158f187fc8fc8f1062a1b31d06f185dbab`, same on all chains) controls how much a project can withdraw from its terminals during each ruleset.

- **Payout limits** cap `sendPayoutsOf` distributions to splits/owner. Usage resets each ruleset **cycle**.
- **Surplus allowances** cap what the owner can pull from surplus via `useAllowanceOf`. Usage resets per ruleset **ID** (a new queued ruleset, not each cycle).

Limits are set only by the project's controller during `queueRulesetsOf`/`launchProjectFor` — they cannot be edited mid-ruleset.

## CRITICAL: empty groups = zero access

`fundAccessLimitGroups: []` means the project can pay out **nothing** and use **no** surplus allowance. For unlimited, explicitly pass `type(uint224).max`:

```
uint224.max = 26959946667150639794667015087019630673637144422540572481103610249215
```

Amounts are stored packed: bits 0–223 amount, bits 224–255 currency. Anything above `uint224.max` doesn't fit.

## Structs (ABI order)

```solidity
struct JBFundAccessLimitGroup {
    address terminal;                      // terminal these limits apply to
    address token;                         // token within that terminal
    JBCurrencyAmount[] payoutLimits;       // per-cycle payout caps
    JBCurrencyAmount[] surplusAllowances;  // per-ruleset owner surplus caps
}

struct JBCurrencyAmount {
    uint224 amount;    // fixed point, same decimals as the terminal token
    uint32 currency;   // denomination currency
}
```

Currency conventions:

| Currency | Value |
|----------|-------|
| `JBCurrencyIds.ETH` (price-feed ID) | `1` |
| `JBCurrencyIds.USD` (price-feed ID) | `2` |
| Accounting-context currency of a token | `uint32(uint160(tokenAddress))` |
| `NATIVE_TOKEN_CURRENCY` (`uint32(uint160(0x…EEEe))`) | `61166` |
| USDC accounting currency on Ethereum (`0xA0b8…eB48`) | `906423112` |

A limit's currency may differ from the held token (e.g. a USD-denominated limit on an ETH terminal); withdrawal-time conversion goes through `JBPrices`. **The limit `amount` is interpreted in the limit's own currency, using the terminal token's decimal precision** — a $500 limit on a 6-decimal USDC context is `500_000_000` with a USD currency.

## Configuration examples

```typescript
const UINT224_MAX = 26959946667150639794667015087019630673637144422540572481103610249215n
const JB_MULTI_TERMINAL = '0x130f5dd2bd8805443cf41755253d778a75a67f53'
const NATIVE_TOKEN = '0x000000000000000000000000000000000000EEEe'
const NATIVE_TOKEN_CURRENCY = 61166

// Unlimited payouts, native-token accounting
const unlimitedPayouts = [{
  terminal: JB_MULTI_TERMINAL,
  token: NATIVE_TOKEN,
  payoutLimits: [{ amount: UINT224_MAX, currency: NATIVE_TOKEN_CURRENCY }],
  surplusAllowances: [],
}]

// Unlimited payouts, USDC accounting (Ethereum)
const usdc = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const usdcCurrency = Number(BigInt(usdc) & 0xffffffffn) // 906423112
const unlimitedUsdcPayouts = [{
  terminal: JB_MULTI_TERMINAL,
  token: usdc,
  payoutLimits: [{ amount: UINT224_MAX, currency: usdcCurrency }],
  surplusAllowances: [],
}]
```

Validation rules enforced on-chain (`setFundAccessLimitsFor`):

1. At most one group per `(terminal, token)` pair — duplicates revert.
2. Within a group, limits/allowances must be sorted by **strictly increasing** currency — duplicates and unordered entries revert.
3. Zero amounts are skipped (equivalent to omitting the entry).
4. Multiple limits in different currencies are additive, each enforced independently within its reset window.

## Payout limits vs surplus allowance

| | Payout limit | Surplus allowance |
|---|---|---|
| Withdrawn via | `sendPayoutsOf` (anyone, to splits) | `useAllowanceOf` (owner / `USE_ALLOWANCE` permission, to a beneficiary) |
| Effect on cash outs | Reserves funds — reduces surplus, so reduces cash-out value immediately | Preserves cash-out value until actually used; owner and holders share the surplus first-come-first-served |
| Resets | Every ruleset cycle | Per ruleset ID |
| Typical use | Recurring distributions, guaranteed owner access | Owner escape hatch, revnet loans (REVLoans borrows via allowance) |

Zero payouts + surplus allowance is the revnet pattern; zero both locks all funds for holder cash outs.

## Querying

```solidity
// All limits for a (project, ruleset, terminal, token):
function payoutLimitsOf(uint256 projectId, uint256 rulesetId, address terminal, address token)
    external view returns (JBCurrencyAmount[] memory);
function surplusAllowancesOf(uint256 projectId, uint256 rulesetId, address terminal, address token)
    external view returns (JBCurrencyAmount[] memory);

// Single-currency lookups (0 if not configured for that currency):
function payoutLimitOf(uint256 projectId, uint256 rulesetId, address terminal, address token, uint256 currency)
    external view returns (uint256);
function surplusAllowanceOf(uint256 projectId, uint256 rulesetId, address terminal, address token, uint256 currency)
    external view returns (uint256);
```

Query discipline:

1. **`rulesetId`** must be the ID of the ruleset the limits were queued with. Use `JBController.currentRulesetOf(projectId).id` — cycled rulesets keep the queued ruleset's ID. If a project queued a new ruleset without new limits, walk back via `ruleset.basedOnId` until a ruleset with limits is found.
2. **`token`** must match the accounting token. ERC-20-accounting projects (e.g. USDC) return nothing when queried with the native token. Read the project's accounting contexts (`JBMultiTerminal.accountingContextsOf(projectId)`) and query per token.
3. **Detect unlimited** by comparing against `uint224.max`, or use a threshold (`> 10^30`) for display purposes.

## Common mistakes

1. **Empty `fundAccessLimitGroups` expecting unlimited.** It means zero. Use `uint224.max`.
2. **Unsorted or duplicate currencies in one group.** Reverts with `JBFundAccessLimits_InvalidPayoutLimitCurrencyOrdering` / `…SurplusAllowanceCurrencyOrdering`.
3. **Two groups for the same terminal+token.** Reverts with `JBFundAccessLimits_DuplicateFundAccessLimitGroup`.
4. **Querying with the native token for an ERC-20 project.** Keyed by exact token address.
5. **Wrong terminal address in the group.** Must be the terminal that will hold the funds (normally `JBMultiTerminal`), not a router/forwarding terminal.
6. **Assuming limits denominate in the held token.** The `currency` field controls the denomination; conversion happens at withdrawal via `JBPrices`.
