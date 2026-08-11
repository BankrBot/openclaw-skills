---
name: jb-multi-currency
description: |
  Juicebox V6 multi-currency accounting: JBPrices feed resolution, adding price feeds,
  accounting contexts per terminal token, and fund access limits denominated in mixed
  currencies. Use when: (1) configuring payout limits or surplus allowances in a currency
  other than the terminal token (e.g. USD limits on an ETH or USDC terminal),
  (2) calling sendPayoutsOf / useAllowanceOf and choosing the amount + currency parameters,
  (3) registering a project-specific price feed via JBController.addPriceFeedFor,
  (4) debugging JBPrices_PriceFeedNotFound or payouts that silently move 0 tokens,
  (5) reasoning about how pay/cash-out/payout convert between currencies via weight and
  baseCurrency, (6) picking the right feed adapter on L2s (sequencer-guarded Chainlink),
  (7) computing worked conversions across 6-decimal and 18-decimal tokens.
version: 6.0.0
---

# Juicebox V6 Multi-Currency Accounting

A project can hold tokens in one denomination (native ETH, USDC) while denominating its
issuance weight and fund access limits in another (USD, ETH). `JBPrices` resolves every
cross-currency conversion at read time. This skill covers the price-feed registry, the
deployed feeds, and how terminals consume conversions.

## Two currency namespaces

Every currency is a `uint32` ID. Two namespaces share the space (full detail in the
`jb-currency-types` skill):

| Namespace | Values | Used for |
|-----------|--------|----------|
| Well-known IDs (`JBCurrencyIds`) | `ETH = 1`, `USD = 2` | `ruleset.metadata.baseCurrency`, payout-limit / surplus-allowance denominations, price-feed pairs |
| Token-derived IDs | `uint32(uint160(tokenAddress))` | `JBAccountingContext.currency` for each token a terminal accepts, price-feed pairs |

| Constant (`JBConstants`) | Value |
|--------------------------|-------|
| `NATIVE_TOKEN` | `0x000000000000000000000000000000000000EEEe` |
| `NATIVE_TOKEN_CURRENCY` | `uint32(uint160(NATIVE_TOKEN))` = `61166` |

`JBCurrencyIds.ETH` (1) and `NATIVE_TOKEN_CURRENCY` (61166) are **different IDs**. Never
treat them as interchangeable and never skip a `pricePerUnitOf` call because two IDs "mean
the same thing" — the conversion between 1 and 61166 goes through a registered 1:1 feed
(`JBMatchingPriceFeed`, below), and `pricePerUnitOf` only short-circuits when the two IDs
are numerically equal. Currency `0` is rejected everywhere (`JBPrices_ZeroPricingCurrency`,
`JBPrices_ZeroUnitCurrency`, `JBTerminalStore_ZeroAccountingContextCurrency`).

## JBPrices — the conversion registry

`JBPrices` is at `0xad45e4627f068d1e6b21e5301870d807543a8401` on all 8 chains
(`references/shared/chain-config.json`).

```solidity
function pricePerUnitOf(uint256 projectId, uint256 pricingCurrency, uint256 unitCurrency, uint256 decimals)
    public view returns (uint256 price);
```

Returns the price of **one `unitCurrency` unit, denominated in `pricingCurrency`**, as a
fixed-point number with `decimals` decimals. Example: `pricePerUnitOf(0, USD, NATIVE_TOKEN_CURRENCY, 18)`
returns ~`2500e18` when 1 ETH = 2,500 USD.

Resolution order (first non-zero price wins):

| Step | Feed list checked | Direction |
|------|-------------------|-----------|
| 0 | none — `pricingCurrency == unitCurrency` | returns `10 ** decimals` immediately |
| 1 | `projectId` feeds for `(pricingCurrency, unitCurrency)` | direct |
| 2 | `projectId` feeds for `(unitCurrency, pricingCurrency)` | inverse, derived as `10**decimals * 10**decimals / feedPrice` |
| 3 | project `0` (protocol default) feeds, direct | direct |
| 4 | project `0` feeds, inverse | inverse |

Within each list, feeds are tried in registration order; a feed that reverts or returns
zero is skipped and the next backup is tried. If nothing produces a non-zero price, the
call reverts with `JBPrices_PriceFeedNotFound(projectId, pricingCurrency, unitCurrency)`.

Feed lists are **append-only**: feeds can never be changed or removed, only appended as
backups. Index 0 stays the primary feed forever. Adding the same feed address twice for
the same exact pair reverts with `JBPrices_PriceFeedAlreadyAdded`.

Views (from `references/shared/abis/JBPrices.json`):

| Function | Returns |
|----------|---------|
| `priceFeedFor(projectId, pricingCurrency, unitCurrency)` | primary feed for the exact pair, or `address(0)`. No inverse/default fallback |
| `priceFeedCountFor(projectId, pricingCurrency, unitCurrency)` | number of feeds for the exact pair only |
| `priceFeedAt(projectId, pricingCurrency, unitCurrency, index)` | feed at index (reverts out-of-bounds) |
| `pricePerUnitOf(projectId, pricingCurrency, unitCurrency, decimals)` | resolved price with full fallback path |

## Deployed protocol-default feeds (project 0)

Four pairs are registered on project 0 on every chain:

| pricingCurrency | unitCurrency | Feed | Meaning |
|-----------------|--------------|------|---------|
| `USD` (2) | `NATIVE_TOKEN_CURRENCY` (61166) | Chainlink ETH/USD adapter | USD price of 1 native token |
| `USD` (2) | `ETH` (1) | same Chainlink ETH/USD adapter | USD price of 1 ETH (valid because all 8 chains are ETH-native) |
| `ETH` (1) | `NATIVE_TOKEN_CURRENCY` (61166) | `JBMatchingPriceFeed` | 1:1 — the native token *is* ETH |
| `USD` (2) | `uint32(uint160(USDC))` | Chainlink USDC/USD adapter | USD price of 1 USDC |

Only the USD→X directions (plus ETH→native) are registered; the opposite directions
(e.g. native priced in USDC) resolve through the inverse-derivation step at read time.

Feed adapter addresses per chain (`references/shared/chain-config.json`):

| Chain | ETH/USD adapter | USDC/USD adapter |
|-------|-----------------|------------------|
| Ethereum (1) | `JBChainlinkV3PriceFeed__ETH_USD` `0xc60d1f83e6e116f2621c331885634e13e5e8e008` | `JBChainlinkV3PriceFeed__USDC_USD` `0x58be5fc7076e405ed7f10b15a636be576a1cc341` |
| Optimism (10) | `JBChainlinkV3SequencerPriceFeed__ETH_USD` `0xb5dacddc67b7c36dae9166cdf5fcf61388d76f47` | `JBChainlinkV3SequencerPriceFeed__USDC_USD` `0xf4318bbcbdb98516f4e133e5f5d17764cce98d5d` |
| Base (8453) | `JBChainlinkV3SequencerPriceFeed__ETH_USD` `0x79ab3a63920a47bc9e0f0e4aec201663ffe83102` | `JBChainlinkV3SequencerPriceFeed__USDC_USD` `0x5896aaf909cf6829704dfc1ddb14ac5d9f755592` |
| Arbitrum (42161) | `JBChainlinkV3SequencerPriceFeed__ETH_USD` `0x2467973afef252612c602dad3d4a03cb9a8368ea` | `JBChainlinkV3SequencerPriceFeed__USDC_USD` `0xe61f419e86530c5e626382578302295932450801` |
| Sepolia (11155111) | `JBChainlinkV3PriceFeed__ETH_USD` `0xa5f6f2a2abc1d4712d3c3eb2b46cccc974095f6f` | `JBChainlinkV3PriceFeed__USDC_USD` `0x24c73c0be8130eff157cdb8cfc0bd33fc33a76ca` |
| OP Sepolia (11155420) | `JBChainlinkV3PriceFeed__ETH_USD` `0xe66f4648bae4b43225f64ed0af1c94eaad776e52` | `JBChainlinkV3PriceFeed__USDC_USD` `0x974a8cf0ce0443c59b662b4087459e1c9b184280` |
| Base Sepolia (84532) | `JBChainlinkV3PriceFeed__ETH_USD` `0xeeb6784193659320ec5361821217fcf9bb53fb28` | `JBChainlinkV3PriceFeed__USDC_USD` `0x5696a3785b721757a3343dbfcf6e2433837512c4` |
| Arb Sepolia (421614) | `JBChainlinkV3PriceFeed__ETH_USD` `0x68b4e18b141553801b2632f244ae7e64e9f11d56` | `JBChainlinkV3PriceFeed__USDC_USD` `0x77c8b5431764499f64f281ebbccf5f7e7604548f` |

`JBMatchingPriceFeed` is `0xa37213cbc60cdc9111849d31536471a0f084ece0` on all chains.

## Feed adapter contracts

All feeds implement one function: `currentUnitPrice(uint256 decimals) → uint256`.

| Contract | Behavior |
|----------|----------|
| `JBChainlinkV3PriceFeed` | Reads `FEED.latestRoundData()`. Reverts if the round is incomplete (`updatedAt == 0` or `answeredInRound < roundId`), the update is older than `THRESHOLD` seconds, or the price is `<= 0`. Rescales from the Chainlink feed's decimals to the requested `decimals` via `JBFixedPointNumber.adjustDecimals` |
| `JBChainlinkV3SequencerPriceFeed` | Extends the above for L2s: first reads `SEQUENCER_FEED.latestRoundData()` and reverts if the round is uninitialized (`startedAt == 0`), the sequencer is down (`answer != 0`), or it came back up less than `GRACE_PERIOD_TIME` seconds ago. Deployed on OP/Base/Arb mainnets; the testnets use the plain feed |
| `JBMatchingPriceFeed` | Always returns `10 ** decimals` (1:1). Registered for pairs where no conversion is needed, e.g. `(ETH, NATIVE_TOKEN_CURRENCY)` |

Deployed staleness thresholds (from `nana-core-v6/script/DeployPeriphery.s.sol`): ETH/USD
adapters use `THRESHOLD = 3600` seconds; USDC/USD adapters use `THRESHOLD = 86400` seconds.

When a feed reverts (stale price, sequencer down), `JBPrices` skips it and tries backups;
if none exist, `pricePerUnitOf` reverts — which propagates into any pay, payout, surplus,
or cash-out path that needed that conversion.

## Adding a project-specific price feed

Projects register feeds through their controller, which forwards to `JBPrices`:

```solidity
// JBController (0x3fcec3572e84b624477bcff4e2cf1f7deab648f1, all chains)
function addPriceFeedFor(uint256 projectId, uint256 pricingCurrency, uint256 unitCurrency, IJBPriceFeed feed) external;
```

Authorization, in order:

| Gate | Rule |
|------|------|
| Caller | Project owner, or operator with permission `ADD_PRICE_FEED` (ID `20`, `JBPermissionIds`) |
| Ruleset flag | If a current ruleset exists (`ruleset.id != 0`), its metadata must have `allowAddPriceFeed == true`, else `JBController_AddingPriceFeedNotAllowed`. If no current ruleset exists, the call is allowed unconditionally (pre-launch / gap state) |
| `JBPrices` itself | `projectId == 0` (defaults) → only the `JBPrices` owner. `projectId != 0` → only that project's controller. So projects cannot call `JBPrices.addPriceFeedFor` directly — always go through the controller |

Feeds are stored only for the exact `(pricingCurrency, unitCurrency)` direction given;
the opposite direction is derived by inversion at read time. Because feeds are
append-only and permanent, adding a feed is irreversible — a later feed for the same pair
only acts as a backup when earlier feeds fail.

Project-specific feeds **shadow** the protocol defaults: step 1/2 of the resolution order
runs before project 0 is consulted. A project can therefore override the default ETH/USD
pricing for its own conversions without affecting anyone else.

## Accounting contexts — what a terminal holds

Each token a terminal accepts for a project has one `JBAccountingContext` (ABI order):

| Field | Type | Meaning |
|-------|------|---------|
| `token` | `address` | Token address (`JBConstants.NATIVE_TOKEN` for ETH) |
| `decimals` | `uint8` | Fixed-point decimals for this token's amounts (18 for ETH, 6 for USDC) |
| `currency` | `uint32` | Currency ID for price-feed lookups. Convention: `uint32(uint160(token))` |

Registered at launch (via `launchProjectFor` / `launchRulesetsFor` terminal configs) or
later via `JBMultiTerminal.addAccountingContextsFor(projectId, contexts)` — callable by
the project owner, an operator with `ADD_ACCOUNTING_CONTEXTS` (ID `21`), or the project's
controller. `JBTerminalStore.recordAccountingContextOf` validates each context:

- If a current ruleset exists, its `allowAddAccountingContext` metadata flag must be true.
- One context per token, immutable once set (`JBTerminalStore_AccountingContextAlreadySet`).
- `decimals` must be ≤ 36 and match reality: 18 for `NATIVE_TOKEN`, `IERC20Metadata.decimals()`
  for deployed ERC-20s (tokens whose `decimals()` reverts bypass the check — caller's responsibility).
- `currency` must be non-zero.

The accounting context's `currency` and `decimals` drive every conversion below.

## Fund access limits in multiple currencies

`JBFundAccessLimits` is at `0xc93360158f187fc8fc8f1062a1b31d06f185dbab` on all chains.
Limits are set by the controller during `queueRulesetsOf` / `launchProjectFor` via
`setFundAccessLimitsFor` and are immutable for that ruleset.

`JBCurrencyAmount` (ABI order):

| Field | Type | Meaning |
|-------|------|---------|
| `amount` | `uint224` | The limit amount, fixed-point **with the terminal token's decimals** |
| `currency` | `uint32` | The currency the amount is denominated in |

`JBFundAccessLimitGroup` (ABI order):

| Field | Type | Meaning |
|-------|------|---------|
| `terminal` | `address` | Terminal these limits apply to |
| `token` | `address` | Token within that terminal |
| `payoutLimits` | `JBCurrencyAmount[]` | Max distributable to splits per ruleset **cycle**, per currency |
| `surplusAllowances` | `JBCurrencyAmount[]` | Max the owner can pull from surplus per **ruleset**, per currency |

Rules enforced by `setFundAccessLimitsFor`:

- At most one group per `(terminal, token)` pair (`JBFundAccessLimits_DuplicateFundAccessLimitGroup`).
- Within a group, limits must be sorted by **strictly ascending currency** — this is how
  duplicates are prevented (`JBFundAccessLimits_InvalidPayoutLimitCurrencyOrdering` / `...SurplusAllowanceCurrencyOrdering`).
- Zero-amount entries are dropped, not stored.
- An **empty `fundAccessLimitGroups` array means zero access, not unlimited**. For
  unlimited, use `type(uint224).max` as the amount.

A single token can carry limits in several currencies at once (e.g. `10,000 USD` +
`5 ETH` on the native-token terminal). Each is tracked and consumed **independently** in
its own currency; together they are additive against the balance. Usage counters:
payout-limit usage is keyed by `ruleset.cycleNumber` (resets every cycle); surplus-allowance
usage is keyed by `ruleset.id` (resets only when a new ruleset is queued).

Reads: `payoutLimitOf(projectId, rulesetId, terminal, token, currency)` returns the limit
for one currency (0 if none); `payoutLimitsOf(...)` returns all of them. Same shape for
`surplusAllowanceOf` / `surplusAllowancesOf` (`references/shared/abis/JBFundAccessLimits.json`).

## The decimals trap

**Limit amounts (and the `amount` parameter of `sendPayoutsOf` / `useAllowanceOf`) are
denominated in the limit's `currency` but expressed with the terminal token's
accounting-context `decimals`.**

| Limit | Terminal token | On-chain `amount` |
|-------|----------------|-------------------|
| 1,000 USD | ETH (18 decimals) | `1_000e18` |
| 1,000 USD | USDC (6 decimals) | `1_000e6` |
| 5 ETH (currency 1) | ETH (18 decimals) | `5e18` |

The same "$1,000" is a different integer depending on which terminal token it gates.
Encoding a USD limit for a USDC terminal with 18 decimals makes it 10¹² times too large.

This holds because `JBTerminalStore`'s conversion is decimal-preserving: it multiplies by
`10 ** 18` and divides by an 18-decimal price, so the output keeps the input's decimals —
and the output must be a terminal-token amount.

## How terminals convert

### Pay → token issuance (weight × baseCurrency)

`ruleset.weight` is the number of project tokens (18-decimal) minted per unit of
`ruleset.metadata.baseCurrency`. In `JBTerminalStore._recordPaymentFrom`:

```solidity
uint256 weightRatio = amount.currency == ruleset.baseCurrency()
    ? 10 ** amount.decimals
    : PRICES.pricePerUnitOf({
        projectId: projectId,
        pricingCurrency: amount.currency,        // the paid token's accounting-context currency
        unitCurrency: ruleset.baseCurrency(),
        decimals: amount.decimals
    });
tokenCount = mulDiv(amount.value, weight, weightRatio);
```

Worked example — pay 1 ETH to a USD-based project (`baseCurrency = 2`,
`weight = 1_000e18`, ETH at 2,500 USD):

- `amount = {value: 1e18, currency: 61166, decimals: 18}`
- No direct `(61166, 2)` feed exists; resolution falls through to project 0's `(2, 61166)`
  ETH/USD feed and inverts: `weightRatio = 1e18 * 1e18 / 2500e18 = 4e14` (1 USD = 0.0004 ETH)
- `tokenCount = 1e18 * 1_000e18 / 4e14 = 2.5e24` → 2,500,000 project tokens (= $2,500 × 1,000/USD)

### Payouts (`sendPayoutsOf`)

```solidity
// JBMultiTerminal (0x130f5dd2bd8805443cf41755253d778a75a67f53, all chains)
function sendPayoutsOf(uint256 projectId, address token, uint256 amount, uint256 currency, uint256 minTokensPaidOut)
    external returns (uint256 amountPaidOut);
```

`currency` must match a currency of one of the current ruleset's payout limits for this
`(terminal, token)` — otherwise the looked-up limit is 0 and nothing moves. `amount` is
denominated in `currency` with the token's accounting-context decimals (trap above).

`JBTerminalStore.recordPayoutFor` behavior:

1. **Caps instead of reverting**: `amount` is clamped to the remaining payout limit for
   this currency this cycle (`payoutLimit - usedPayoutLimit`). Requesting more than
   remains pays out only the remainder.
2. Converts to terminal-token units when `currency != accountingContext.currency`:
   `amountPaidOut = mulDiv(amount, 10**18, pricePerUnitOf(projectId, currency, accountingContext.currency, 18))`.
3. If the conversion rounds to zero, returns 0 **without consuming any payout limit**.
4. Reverts if `amountPaidOut` exceeds the terminal balance; otherwise consumes `amount`
   (in the limit currency) from the cycle's used counter.

Use `minTokensPaidOut` (terminal-token units) as the slippage guard — the exchange rate
between the limit currency and the token moves between simulation and execution.

Worked examples (ETH at 2,500 USD, USDC at 0.9998 USD):

| Limit | Terminal | Call | Paid out |
|-------|----------|------|----------|
| 1,000 USD | ETH | `sendPayoutsOf(id, NATIVE_TOKEN, 1_000e18, 2, min)` | `1_000e18 * 1e18 / 2500e18 = 4e17` → 0.4 ETH |
| 1,000 USD | USDC | `sendPayoutsOf(id, USDC, 1_000e6, 2, min)` | `1_000e6 * 1e18 / 0.9998e18 ≈ 1_000.2e6` → ~1,000.2 USDC |
| 5 ETH (currency 1) | ETH | `sendPayoutsOf(id, NATIVE_TOKEN, 5e18, 1, min)` | via `(1, 61166)` `JBMatchingPriceFeed`: exactly `5e18` ETH |

Note the third row: currency `1` ≠ currency `61166`, so a conversion *is* performed — it
just resolves 1:1 through the matching feed.

### Surplus allowances (`useAllowanceOf`)

Same conversion shape (`recordUsedAllowanceOf`), but: requires `USE_ALLOWANCE` permission
from the owner; the converted amount must fit within the token's **surplus** (balance
minus all remaining payout limits, each converted to the token's currency); usage is
checked against `surplusAllowanceOf` for that exact currency and reverts (rather than
caps) when exceeded.

### Surplus and cash outs

`_tokenSurplusFrom` computes, per token: balance (adjusted to target decimals/currency)
minus each remaining payout limit, each converted via `pricePerUnitOf(projectId,
payoutLimit.currency, targetCurrency, 18)`. Cash outs reclaim from this surplus — so a
USD-denominated payout limit shrinks the ETH surplus by a live-exchange-rate amount, and
cash-out values move with the feed price even when the balance is static. All conversions
share `_MAX_FIXED_POINT_FIDELITY = 18` decimals of precision.

## Common mistakes

1. **Wrong decimals for currency-denominated amounts**: encoding a 1,000 USD limit on a
   USDC terminal as `1_000e18` instead of `1_000e6`. The amount always uses the terminal
   token's accounting-context decimals, regardless of the denomination currency.
2. **Treating `ETH = 1` and `NATIVE_TOKEN_CURRENCY = 61166` as the same ID**: they are
   distinct; conversion between them goes through the registered `JBMatchingPriceFeed`.
   Setting `JBAccountingContext.currency = 1` for the native token breaks the convention
   every deployed default feed assumes.
3. **Passing an unconfigured `currency` to `sendPayoutsOf`**: the limit lookup returns 0
   and the call pays out nothing (no revert). Pass the exact currency the payout limit
   was stored with, and set `minTokensPaidOut` to catch silent zero-payouts.
4. **Assuming an empty fund access limit array means unlimited**: it means **zero**
   access. Unlimited is `amount = type(uint224).max`.
5. **Unsorted multi-currency limits**: `payoutLimits` / `surplusAllowances` within a
   group must be in strictly ascending `currency` order or `setFundAccessLimitsFor`
   reverts.
6. **Calling `JBPrices.addPriceFeedFor` directly for a project**: it reverts — only the
   project's controller may call it. Go through `JBController.addPriceFeedFor`, which
   needs owner/`ADD_PRICE_FEED` (ID 20) authorization and, when a current ruleset exists,
   the `allowAddPriceFeed` metadata flag.
7. **Expecting to replace or remove a feed**: feeds are append-only and permanent. A new
   feed for the same pair is only a backup used when earlier feeds revert or return zero.
8. **Reading `priceFeedFor` to decide whether a conversion will work**: it checks only the
   exact pair on the exact project — no inverse derivation, no project-0 fallback. Use
   `pricePerUnitOf` to test the full resolution path.
9. **Forgetting feed failure modes**: Chainlink adapters revert on stale prices
   (1h ETH/USD, 24h USDC/USD) and, on OP/Base/Arb mainnets, during sequencer outages and
   the post-recovery grace period. With no backup feed, every dependent pay, payout,
   surplus, and cash-out path reverts until the feed recovers.
10. **Hardcoding one chain's USDC currency ID**: token-derived IDs differ per chain
    because the token address differs. Compute `uint32(uint160(address))` from the
    chain's actual USDC address (per-chain table in the `jb-currency-types` skill).
