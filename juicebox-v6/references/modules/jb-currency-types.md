---
name: jb-currency-types
description: |
  Juicebox V6 currency-ID system: well-known price-feed IDs (ETH=1, USD=2) vs token-derived
  accounting-context IDs (uint32(uint160(tokenAddress))). Use when: (1) setting
  ruleset.metadata.baseCurrency, (2) configuring JBAccountingContext for terminals, (3) denominating
  payout limits / surplus allowances (JBCurrencyAmount), (4) debugging JBPrices_PriceFeedNotFound
  reverts, (5) reasoning about cross-chain issuance consistency, (6) getting decimals right for
  currency-denominated amounts.
version: 6.0.0
---

# Juicebox V6 Currency Types

## Two currency-ID namespaces

Every currency in Juicebox is a `uint32` ID. Two namespaces share that space:

| Namespace | Values | Source | Typical use |
|-----------|--------|--------|-------------|
| Well-known IDs | `ETH = 1`, `USD = 2` | `JBCurrencyIds` (nana-core `src/libraries/JBCurrencyIds.sol`) | `baseCurrency` in ruleset metadata, payout-limit denominations, price-feed pairs |
| Token-derived IDs | `uint32(uint160(tokenAddress))` | Cast of the token's address | `JBAccountingContext.currency` for each token a terminal accepts, price-feed pairs |

Both namespaces feed the same `JBPrices` lookups. They are distinct: `JBCurrencyIds.ETH` (1) is **not** the native-token currency (61166) — converting between them goes through a registered 1:1 feed, not through ID equality.

Currency `0` is invalid everywhere: `JBPrices.addPriceFeedFor` rejects it, and `JBMultiTerminal` treats an accounting context with `currency == 0` as "token not accepted".

## NATIVE_TOKEN sentinel

From `JBConstants` (nana-core `src/libraries/JBConstants.sol`):

| Constant | Value |
|----------|-------|
| `NATIVE_TOKEN` | `0x000000000000000000000000000000000000EEEe` |
| `NATIVE_TOKEN_CURRENCY` | `uint32(uint160(NATIVE_TOKEN))` = `61166` |

`NATIVE_TOKEN` is the token-address sentinel for the chain's native token (ETH on all 8 supported chains). `NATIVE_TOKEN_CURRENCY` is its accounting-context currency, derived by the same cast every other token uses.

## Token-derived currency IDs per chain

Token addresses differ per chain, so token-derived IDs differ per chain. USDC (the token every `JBMultiTerminal` deployment is wired for alongside native ETH):

| Chain | USDC address | `uint32(uint160(address))` |
|-------|--------------|---------------------------|
| Ethereum (1) | 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 | 906423112 |
| Optimism (10) | 0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85 | 3499622277 |
| Base (8453) | 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 | 3181390099 |
| Arbitrum (42161) | 0xaf88d065e77c8cC2239327C5EDb3A432268e5831 | 646862897 |
| Sepolia (11155111) | 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238 | 932999736 |
| OP Sepolia (11155420) | 0x5fd84259d66Cd46123540766Be93DFE6D43130D7 | 3559993559 |
| Base Sepolia (84532) | 0x036CbD53842c5426634e7929541eC2318f3dCF7e | 2403192702 |
| Arb Sepolia (421614) | 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d | 3460737613 |

`NATIVE_TOKEN` is a constant address, so `NATIVE_TOKEN_CURRENCY` (61166) is the same on every chain.

## Where each field lives

`JBAccountingContext` (ABI order):

| Field | Type | Meaning |
|-------|------|---------|
| `token` | `address` | Token address (`JBConstants.NATIVE_TOKEN` for ETH) |
| `decimals` | `uint8` | Fixed-point decimals for this token's amounts (18 for ETH, 6 for USDC) |
| `currency` | `uint32` | Currency ID for price-feed lookups. Convention: `uint32(uint160(tokenAddress))` for tokens |

`JBRulesetMetadata.baseCurrency` (`uint32`) — the currency the ruleset's `weight` is denominated in for token issuance. Convention per the struct natspec: `uint32(uint160(tokenAddress))` for tokens, or `JBCurrencyIds.ETH` / `JBCurrencyIds.USD` for well-known currencies. Well-known IDs are identical on every chain; token-derived IDs are not — an omnichain project that needs the same issuance rate on every chain uses `1` or `2`.

`JBCurrencyAmount` (ABI order) — used in `JBFundAccessLimitGroup.payoutLimits` and `.surplusAllowances`:

| Field | Type | Meaning |
|-------|------|---------|
| `amount` | `uint224` | Amount, using the **terminal token's** decimal precision (18 for an ETH terminal, 6 for USDC) — even when `currency` is USD |
| `currency` | `uint32` | Either namespace |

## How JBPrices resolves a conversion

`JBPrices.pricePerUnitOf(projectId, pricingCurrency, unitCurrency, decimals)` returns the price of one `unitCurrency` unit denominated in `pricingCurrency`, as a fixed-point number with `decimals` decimals. Resolution order:

| Step | Check |
|------|-------|
| 1 | `pricingCurrency == unitCurrency` → return `10 ** decimals` (only exact ID equality short-circuits) |
| 2 | Project's direct feeds for the exact pair, in registration order |
| 3 | Project's inverse feeds (opposite pair), inverted at read time |
| 4 | Project 0 (`DEFAULT_PROJECT_ID`) direct feeds — the protocol defaults |
| 5 | Project 0 inverse feeds |
| 6 | Revert `JBPrices_PriceFeedNotFound` |

Feed lists are append-only: index 0 is the primary, later entries are backups. A feed that reverts or returns zero is skipped in favor of the next backup. Project-specific feeds are added via `addPriceFeedFor` by the project's controller (requires the ruleset flag `allowAddPriceFeed`); project 0 defaults are added by the `JBPrices` owner.

Conversions between distinct IDs always go through a feed — even when the two currencies "match" conceptually. `ETH` (1) ↔ `NATIVE_TOKEN_CURRENCY` (61166) resolves through the registered `JBMatchingPriceFeed`, which returns `10 ** decimals` (1:1). Do not treat the two IDs as interchangeable, and do not build logic that skips the feed lookup.

## Where conversions run

Payment recording (`JBTerminalStore._recordPaymentFrom`): the issuance denominator is

```solidity
uint256 weightRatio = amount.currency == ruleset.baseCurrency()
    ? 10 ** amount.decimals
    : PRICES.pricePerUnitOf({
        projectId: projectId,
        pricingCurrency: amount.currency,      // the paid token's accounting-context currency
        unitCurrency: ruleset.baseCurrency(),
        decimals: amount.decimals
    });

tokenCount = mulDiv(amount.value, weight, weightRatio); // weight is 18-decimal fixed point
```

Payout limits and surplus allowances (`JBTerminalStore.recordPayoutFor` / `recordUsedAllowanceOf`): a limit denominated in `currency` converts to the terminal token via `pricePerUnitOf(projectId, currency, accountingContext.currency, 18)` at 18-decimal fidelity. If the limit currency equals the accounting-context currency exactly, no feed is consulted. A conversion that rounds to zero returns zero paid out without consuming the limit.

Decimals rules:

| Value | Decimals |
|-------|----------|
| Ruleset `weight` | Always 18 |
| Amounts of a terminal token | `JBAccountingContext.decimals` (18 native, 6 USDC) |
| `sendPayoutsOf` / payout-limit amounts in any currency | Same decimals as the token's accounting context (a USD limit on a USDC terminal uses 6 decimals) |
| `pricePerUnitOf` return | Caller-specified `decimals` argument |

## Deployed price feeds

Addresses from `references/shared/chain-config.json`. `JBPrices` is `0xad45e4627f068d1e6b21e5301870d807543a8401` on all chains. `JBMatchingPriceFeed` (returns `10 ** decimals`, i.e. 1:1, for same-valued pairs) is `0xa37213cbc60cdc9111849d31536471a0f084ece0` on all chains. The Chainlink adapters differ per chain: mainnet Ethereum and all sepolias use `JBChainlinkV3PriceFeed` (staleness + completeness + positive-price checks); Optimism, Base, and Arbitrum mainnets use `JBChainlinkV3SequencerPriceFeed` (adds L2 sequencer-uptime check with a grace period).

| Chain | ETH/USD feed | USDC/USD feed |
|-------|--------------|---------------|
| Ethereum (1) | 0xc60d1f83e6e116f2621c331885634e13e5e8e008 | 0x58be5fc7076e405ed7f10b15a636be576a1cc341 |
| Optimism (10) | 0xb5dacddc67b7c36dae9166cdf5fcf61388d76f47 | 0xf4318bbcbdb98516f4e133e5f5d17764cce98d5d |
| Base (8453) | 0x79ab3a63920a47bc9e0f0e4aec201663ffe83102 | 0x5896aaf909cf6829704dfc1ddb14ac5d9f755592 |
| Arbitrum (42161) | 0x2467973afef252612c602dad3d4a03cb9a8368ea | 0xe61f419e86530c5e626382578302295932450801 |
| Sepolia (11155111) | 0xa5f6f2a2abc1d4712d3c3eb2b46cccc974095f6f | 0x24c73c0be8130eff157cdb8cfc0bd33fc33a76ca |
| OP Sepolia (11155420) | 0xe66f4648bae4b43225f64ed0af1c94eaad776e52 | 0x974a8cf0ce0443c59b662b4087459e1c9b184280 |
| Base Sepolia (84532) | 0xeeb6784193659320ec5361821217fcf9bb53fb28 | 0x5696a3785b721757a3343dbfcf6e2433837512c4 |
| Arb Sepolia (421614) | 0x68b4e18b141553801b2632f244ae7e64e9f11d56 | 0x77c8b5431764499f64f281ebbccf5f7e7604548f |

Default (project 0) feed registrations on every chain:

| pricingCurrency | unitCurrency | Feed |
|-----------------|--------------|------|
| USD (2) | `NATIVE_TOKEN_CURRENCY` (61166) | ETH/USD Chainlink adapter |
| USD (2) | ETH (1) | ETH/USD Chainlink adapter |
| ETH (1) | `NATIVE_TOKEN_CURRENCY` (61166) | `JBMatchingPriceFeed` (1:1) |
| USD (2) | `uint32(uint160(USDC))` (per chain) | USDC/USD Chainlink adapter |

Inverse directions (e.g. pricing in 61166 per unit of USD) derive automatically from these at read time.

## Example: USD-based omnichain project accepting native ETH and USDC

```javascript
const rulesetMetadata = {
  baseCurrency: 2, // JBCurrencyIds.USD — identical ID on every chain
  // ...
};

const accountingContexts = [
  {
    token: "0x000000000000000000000000000000000000EEEe", // JBConstants.NATIVE_TOKEN
    decimals: 18,
    currency: 61166, // NATIVE_TOKEN_CURRENCY — same on every chain
  },
  {
    token: USDC_ADDRESS[chainId],                  // differs per chain
    decimals: 6,
    currency: Number(BigInt(USDC_ADDRESS[chainId]) & 0xffffffffn), // uint32(uint160(token)) — differs per chain
  },
];
```

A payment of native ETH resolves issuance through the default `(USD, 61166)` feed; a USDC payment resolves through the default `(USD, uint32(USDC))` feed. Both are priced per USD, so 1 USD of either token mints the same count.

## Common mistakes

| Mistake | Reality |
|---------|---------|
| Treating ETH (1) and `NATIVE_TOKEN_CURRENCY` (61166) as the same ID | Different IDs. Conversion between them goes through `JBMatchingPriceFeed` at 1:1; ID-equality checks against one do not match the other. |
| "The base currency matches the token, so skip the price feed" | Only exact `uint32` equality short-circuits (`pricingCurrency == unitCurrency` → `10 ** decimals`). Any distinct pair — including conceptually equivalent ones — resolves through `pricePerUnitOf`, and reverts with `JBPrices_PriceFeedNotFound` if no feed is registered. |
| Reusing one USDC currency ID across chains | Token-derived IDs come from the local token address; every chain's USDC ID is different (see table). Only well-known IDs (1, 2) are chain-invariant. |
| Setting a token-derived `baseCurrency` on an omnichain project and expecting identical issuance everywhere | The ID differs per chain, so each chain's ruleset references a different currency. Use `JBCurrencyIds.ETH`/`USD` for chain-invariant interpretation. |
| Denominating a USD payout limit with 18 decimals on a USDC terminal | Limit amounts use the terminal token's accounting-context decimals: 5 USD on a USDC terminal is `5_000_000` (6 decimals), not `5e18`. |
| Using currency `0` | Rejected by `JBPrices.addPriceFeedFor`; `JBMultiTerminal` reads `currency == 0` as "no accounting context / token not accepted". |
| Replacing a bad price feed | Feeds are append-only and immutable once added. A later feed for the same exact pair is only a backup, consulted when earlier feeds revert or return zero. |
| Expecting `USDC ↔ USD` to be hardcoded 1:1 | USDC's ID is token-derived and distinct from USD (2); conversion uses the chain's USDC/USD Chainlink feed, so a depeg changes the rate. A `baseCurrency = 2` project issues per actual dollar, not per USDC. |
