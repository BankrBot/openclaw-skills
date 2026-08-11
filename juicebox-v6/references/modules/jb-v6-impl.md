---
name: jb-v6-impl
description: |
  Deep implementation knowledge for Juicebox V6 internals. Use when: (1) debugging unexpected
  contract behavior, (2) understanding internal mechanics and edge cases (payment flow, cash-out
  bonding curve, ruleset transitions, reserved tokens, splits, fees, held fees), (3) reasoning
  about why something works a certain way, (4) building integrations or hooks that depend on
  internals (buyback hook, 721 hook, data hooks, split hooks), (5) verifying signatures, struct
  layouts, permission IDs, constants, or storage packing against source.
version: 6.0.0
---

# Juicebox V6 Implementation Deep Dive

Internal mechanics, edge cases, and exact encodings for integrators. Ground truth is the deployed `nana-*-v6` source. All contracts are Solidity 0.8.28.

## Deployment surface

Deployed on 8 chains: Ethereum (1), Optimism (10), Base (8453), Arbitrum (42161), and their Sepolias (11155111, 11155420, 84532, 421614). Core contracts are deployed with CREATE2 and share **one address on every chain**. Addresses come from `references/shared/chain-config.json`; the chain-invariant ones:

| Contract | Address (all chains) |
|---|---|
| JBController | `0x3fcec3572e84b624477bcff4e2cf1f7deab648f1` |
| JBMultiTerminal | `0x130f5dd2bd8805443cf41755253d778a75a67f53` |
| JBTerminalStore | `0x7497ae014a60561925b51c0a3b4ade7460b9927c` |
| JBRulesets | `0x26f2228a4e8b0079ed1c2a3d22f12ff7f83cdfba` |
| JBSplits | `0x28b3d11fcb8d2ad0a143c5b193cd9f2e4d43f4c3` |
| JBTokens | `0x1f80d8f057ee36b4c2656d107e4e4558b71ba7d9` |
| JBDirectory | `0x5aff29060e023e6fb87be5596652b33c65af535b` |
| JBProjects | `0x6017d1fba9dc279bfa0b03fd931c22e242ab3691` |
| JBPermissions | `0xf92ac1ab5a00033e35a3975739124f61928c36b0` |
| JBFundAccessLimits | `0xc93360158f187fc8fc8f1062a1b31d06f185dbab` |
| JBPrices | `0xad45e4627f068d1e6b21e5301870d807543a8401` |
| JBFeelessAddresses | `0x657d0e588fca6f8c49394c9ca8a1cf6505b10314` |
| JBERC20 (token implementation) | `0x6db9cf17222d8de2012fe13b9fa5bb7981fa0b17` |
| ERC2771Forwarder | `0x3ba60b60933916a7c87d0860dcee62a0ce34e3e2` |
| JBDeadline3Hours / 1Day / 3Days / 7Days | `0xd25264015483caa5c34643942d41f94bed5f1e92` / `0x3a15ac0bcf4f7dd48359a36b3e293254cf26d4ca` / `0xcda708c98fbdd15a7ff7f0c5c50f9371ca52c78f` / `0x540923f7b6166bf9713490719a2210aeebc9fca2` |
| JBBuybackHook | `0x77bee1ad2ac0ace98a9b5b58d75685c8b4d94948` (not on OP Sepolia) |
| JBBuybackHookRegistry | `0x72f55a54cd53410a5ff175508a5a384227081788` |
| JB721TiersHook (implementation) | `0xf4a5887170e4d7efb1c874ad88fc82ebf076b5ab` |
| JB721TiersHookDeployer | `0xb7b8ec35e2dd84afff04ee769c6189e7a4d44a78` |
| JB721TiersHookStore | `0x69913acf79dbba170d9efafe605ee62b42164f9c` |
| JBRouterTerminal | `0x0fbcbb3d10c8f524840d74ef81c1a9f161c418d7` (not on OP Sepolia) |
| JBRouterTerminalRegistry | `0xe0427f250fdb0379c8e98e884ee4570521208cbc` |
| JBProjectPayer (implementation) | `0x0de147532f522fe9f4559bd7f34774786424176e` |

`JBMultiTerminal`, `JBController`, `JBProjects`, `JBPermissions`, `JBPrices`, the buyback hook, the 721 hook, and the router terminal are `ERC2771Context` — meta-transactions route through the shared `ERC2771Forwarder`, and permission checks use `_msgSender()`.

## Constants

From `JBConstants`:

| Constant | Value | Meaning |
|---|---|---|
| `FEE_BENEFICIARY_PROJECT_ID` | `1` | Project that receives protocol fees |
| `MAX_CASH_OUT_TAX_RATE` | `10_000` | 100% cash-out tax (holders reclaim nothing) |
| `MAX_FEE` | `1000` | Fee denominator |
| `STANDARD_FEE` | `25` | Fee numerator → 25/1000 = **2.5%** |
| `MAX_RESERVED_PERCENT` | `10_000` | 100% of mints reserved |
| `MAX_WEIGHT_CUT_PERCENT` | `1_000_000_000` | 100% weight cut per cycle (9 decimals) |
| `SPLITS_TOTAL_PERCENT` | `1_000_000_000` | 100% for split percents (9 decimals) |
| `NATIVE_TOKEN` | `0x000000000000000000000000000000000000EEEe` | Sentinel for the chain's native token |
| `NATIVE_TOKEN_CURRENCY` | `uint32(uint160(NATIVE_TOKEN))` | Accounting-context currency of the native token |

Currency conventions — two distinct ID spaces:

- **Accounting-context currency** (`JBAccountingContext.currency`): `uint32(uint160(tokenAddress))` — derived from the token address.
- **Price-feed / base-currency IDs** (`JBCurrencyIds`): `ETH = 1`, `USD = 2`. Used as `baseCurrency` in ruleset metadata and for `JBPrices` lookups.

From `JBSplitGroupIds`: `RESERVED_TOKENS = 1`. Payout split groups use `uint256(uint160(tokenAddress))` as the group ID (native token payouts: `uint256(uint160(0xEEEe))`).

## Struct reference (ABI order)

```solidity
struct JBRulesetConfig {
    uint48 mustStartAtOrAfter;
    uint32 duration;
    uint112 weight;                       // 1 = sentinel: inherit previous ruleset's cut weight
    uint32 weightCutPercent;              // out of 1_000_000_000
    IJBRulesetApprovalHook approvalHook;
    JBRulesetMetadata metadata;
    JBSplitGroup[] splitGroups;
    JBFundAccessLimitGroup[] fundAccessLimitGroups;
}

struct JBRulesetMetadata {
    uint16 reservedPercent;               // out of 10_000
    uint16 cashOutTaxRate;                // out of 10_000
    uint32 baseCurrency;                  // JBCurrencyIds or uint32(uint160(token))
    bool pausePay;
    bool pauseCreditTransfers;
    bool allowOwnerMinting;
    bool allowSetCustomToken;
    bool allowTerminalMigration;
    bool allowSetTerminals;
    bool allowSetController;
    bool allowAddAccountingContext;
    bool allowAddPriceFeed;
    bool ownerMustSendPayouts;
    bool holdFees;
    bool scopeCashOutsToLocalBalances;    // omnichain data-hook signal; see cash-out section
    bool useDataHookForPay;
    bool useDataHookForCashOut;
    address dataHook;
    uint16 metadata;                      // 14 usable bits of app-specific data
}

struct JBRuleset {
    uint48 cycleNumber;
    uint48 id;            // == the block.timestamp when it was queued (or latestId + 1 on collision)
    uint48 basedOnId;
    uint48 start;
    uint32 duration;      // 0 = lasts forever, cycles never roll
    uint112 weight;
    uint32 weightCutPercent;
    IJBRulesetApprovalHook approvalHook;
    uint256 metadata;     // packed JBRulesetMetadata
}

struct JBSplit {
    uint32 percent;               // out of 1_000_000_000; 0 reverts
    uint64 projectId;
    address payable beneficiary;
    bool preferAddToBalance;
    uint48 lockedUntil;
    IJBSplitHook hook;
}

struct JBSplitGroup { uint256 groupId; JBSplit[] splits; }
struct JBTerminalConfig { IJBTerminal terminal; JBAccountingContext[] accountingContextsToAccept; }
struct JBAccountingContext { address token; uint8 decimals; uint32 currency; }
struct JBFundAccessLimitGroup { address terminal; address token; JBCurrencyAmount[] payoutLimits; JBCurrencyAmount[] surplusAllowances; }
struct JBCurrencyAmount { uint224 amount; uint32 currency; }
struct JBPermissionsData { address operator; uint64 projectId; uint8[] permissionIds; }
struct JBFee { uint224 amount; address beneficiary; uint48 unlockTimestamp; }   // amount = GROSS fee basis
struct JBTokenAmount { address token; uint8 decimals; uint32 currency; uint256 value; }
struct JBSplitHookContext { address token; uint256 amount; uint256 decimals; uint256 projectId; uint256 groupId; JBSplit split; }
```

### Ruleset metadata bit packing (`JBRulesetMetadataResolver`)

| Bits | Field |
|---|---|
| 0–3 | version (packed as `1`) |
| 4–19 | `reservedPercent` |
| 20–35 | `cashOutTaxRate` |
| 36–67 | `baseCurrency` |
| 68–79 | flags in declaration order: `pausePay`(68), `pauseCreditTransfers`(69), `allowOwnerMinting`(70), `allowSetCustomToken`(71), `allowTerminalMigration`(72), `allowSetTerminals`(73), `allowSetController`(74), `allowAddAccountingContext`(75), `allowAddPriceFeed`(76), `ownerMustSendPayouts`(77), `holdFees`(78), `scopeCashOutsToLocalBalances`(79) |
| 80 | `useDataHookForPay` |
| 81 | `useDataHookForCashOut` |
| 82–241 | `dataHook` address |
| 242–255 | `metadata` (14 bits; upper 2 bits of the uint16 are masked off) |

## Permission IDs

`uint8` values from `@bananapus/permission-ids-v6/src/JBPermissionIds.sol`. IDs 1–39 exist; nothing above 39.

| ID | Name | Gates |
|---|---|---|
| 1 | ROOT | Everything (per scoped project) |
| 2 | QUEUE_RULESETS | `JBController.queueRulesetsOf` |
| 3 | LAUNCH_RULESETS | `JBController.launchRulesetsFor` |
| 4 | CASH_OUT_TOKENS | `JBMultiTerminal.cashOutTokensOf` |
| 5 | SEND_PAYOUTS | `JBMultiTerminal.sendPayoutsOf` (only when `ownerMustSendPayouts`) |
| 6 | MIGRATE_TERMINAL | `JBMultiTerminal.migrateBalanceOf` |
| 7 | SET_PROJECT_URI | `JBController.setUriOf` |
| 8 | DEPLOY_ERC20 | `JBController.deployERC20For` |
| 9 | SET_TOKEN | `JBController.setTokenFor` |
| 10 | MINT_TOKENS | `JBController.mintTokensOf` |
| 11 | BURN_TOKENS | `JBController.burnTokensOf` |
| 12 | CLAIM_TOKENS | `JBController.claimTokensFor` |
| 13 | TRANSFER_CREDITS | `JBController.transferCreditsFrom` |
| 14 | SET_CONTROLLER | `JBDirectory.setControllerOf` |
| 15 | SET_TERMINALS | `JBDirectory.setTerminalsOf` |
| 16 | ADD_TERMINALS | `JBDirectory.setPrimaryTerminalOf` (implicit terminal add) |
| 17 | SET_PRIMARY_TERMINAL | `JBDirectory.setPrimaryTerminalOf` |
| 18 | USE_ALLOWANCE | `JBMultiTerminal.useAllowanceOf` |
| 19 | SET_SPLIT_GROUPS | `JBController.setSplitGroupsOf` |
| 20 | ADD_PRICE_FEED | `JBController.addPriceFeedFor` |
| 21 | ADD_ACCOUNTING_CONTEXTS | `JBMultiTerminal.addAccountingContextsFor` |
| 22 | SET_TOKEN_METADATA | `JBController.setTokenMetadataOf` |
| 23 | SIGN_FOR_ERC20 | `JBERC20.isValidSignature` (ERC-1271) |
| 24 | ADJUST_721_TIERS | `JB721TiersHook.adjustTiers` |
| 25 | SET_721_METADATA | `JB721TiersHook.setMetadata` |
| 26 | MINT_721 | `JB721TiersHook.mintFor` |
| 27 | SET_721_DISCOUNT_PERCENT | `JB721TiersHook.setDiscountPercentOf` |
| 28 | SET_BUYBACK_TWAP | `JBBuybackHook.setTwapWindowOf` |
| 29 | SET_BUYBACK_POOL | `JBBuybackHook.setPoolFor` / `initializePoolFor` |
| 30 | SET_BUYBACK_HOOK | `JBBuybackHookRegistry.setHookFor` / `lockHookFor` |
| 31 | SET_ROUTER_TERMINAL | `JBRouterTerminalRegistry.setTerminalFor` / `lockTerminalFor` |
| 32 | MAP_SUCKER_TOKEN | `JBSucker.mapToken` |
| 33 | DEPLOY_SUCKERS | `JBSuckerRegistry.deploySuckersFor` |
| 34 | SET_SUCKER_PEER | non-symmetric explicit sucker peer registration |
| 35 | SUCKER_SAFETY | `JBSucker.enableEmergencyHatchFor` |
| 36 | SET_SUCKER_DEPRECATION | `JBSucker.setDeprecation` |
| 37 | OPEN_LOAN | `REVLoans.borrowFrom` |
| 38 | REALLOCATE_LOAN | `REVLoans.reallocateCollateralFromLoan` |
| 39 | REPAY_LOAN | `REVLoans.repayLoan` |

## Project creation and the creation fee

`JBController.launchProjectFor` is **payable** and requires `msg.value == PROJECTS.creationFee()` exactly, or it reverts with `JBController_InvalidCreationFee(value, requiredFee)`:

```solidity
function launchProjectFor(
    address owner,
    string calldata projectUri,
    JBRulesetConfig[] calldata rulesetConfigurations,
    JBTerminalConfig[] calldata terminalConfigurations,
    string calldata memo
) external payable returns (uint256 projectId);
```

- The fee is forwarded to `JBProjects.createFor{value: creationFee}(owner)`; `JBProjects` forwards it to `creationFeeReceiver`. `JBProjects.createFor` itself is payable and also enforces `msg.value == creationFee` exactly (no overpayment).
- The fee is owner-configurable via `JBProjects.setCreationFee(fee, receiver)` but hard-capped at `MAX_CREATION_FEE = 0.001 ether`. `creationFee` can be 0 (then send 0 value).
- While the fee transfer runs, a transient `originalPayer` is exposed on both `JBController` and `JBProjects` (`IJBPayerTracker`), so a `pay`-routing fee receiver (e.g. a `JBProjectPayer`) credits the true payer rather than the controller.
- Anyone can call `launchProjectFor` for any owner — it mints the project ERC-721 (via `_safeMint`) to `owner`, stores `uriOf[projectId]`, sets the controller in the directory, configures terminals, then queues rulesets.
- Project IDs come from `JBProjects.count`: `projectId = ++count`.
- `launchRulesetsFor(projectId, projectUri, rulesetConfigs, terminalConfigs, memo)` is the non-payable variant for projects that already exist but have no rulesets. It requires `LAUNCH_RULESETS` **and** `SET_TERMINALS` (plus `SET_PROJECT_URI` when a URI is passed), or the caller is the hardcoded `OMNICHAIN_RULESET_OPERATOR`. Reverts with `JBController_RulesetsAlreadyLaunched` if any ruleset exists.
- `queueRulesetsOf(projectId, rulesetConfigs, memo)` requires `QUEUE_RULESETS` (or `OMNICHAIN_RULESET_OPERATOR`).

`JBController.OMNICHAIN_RULESET_OPERATOR` is an immutable trust boundary: that address can queue/launch rulesets for any project without `JBPermissions` checks. Approval hooks still apply.

## Payment flow internals

### `JBMultiTerminal.pay`

```solidity
function pay(
    uint256 projectId,
    address token,
    uint256 amount,           // ignored for native token; msg.value used instead
    address beneficiary,
    uint256 minReturnedTokens, // 18-decimal project tokens
    string calldata memo,
    bytes calldata metadata
) external payable returns (uint256 beneficiaryTokenCount);
```

Execution order:

```
pay()
  → snapshot beneficiary's total balance (credits + ERC-20)
  → _acceptFundsFor()             // native msg.value, ERC-20 allowance, or Permit2 (permit data in `metadata`)
  → _pay()
      → STORE.recordPaymentFrom()
          → ruleset must exist (cycleNumber != 0) and !pausePay
          → data hook consulted if useDataHookForPay && dataHook != 0 → (weight, hookSpecifications)
          → hook spec amounts subtracted from the balance credit; sum may not exceed the payment
          → weightRatio = amount.currency == baseCurrency
                ? 10**amount.decimals
                : PRICES.pricePerUnitOf(projectId, amount.currency, baseCurrency, amount.decimals)
          → tokenCount = mulDiv(amount.value, weight, weightRatio)
      → controller.mintTokensOf(..., useReservedPercent: true)   // if tokenCount != 0
      → emit Pay
      → _fulfillPayHookSpecificationsFor()   // funds forwarded to each hook (allowance or msg.value), then
                                             // hook.afterPayRecordedWith(context) — sequential, no try/catch
  → beneficiaryTokenCount = balanceAfter − balanceBefore
  → revert JBMultiTerminal_UnderMin if < minReturnedTokens
```

Details that matter:

- `beneficiaryTokenCount` is measured as a **balance delta** on `TOKENS.totalBalanceOf` — not the minted count returned by the controller.
- **Data hook is trusted**: it can return any weight (overriding the ruleset) and route any portion of the payment to pay hooks. Pay/cash-out data-hook calls are NOT wrapped in try-catch; a reverting data hook or pay hook reverts the entire payment. (Split-hook calls, fee processing, and leftover-payout transfers ARE wrapped in try-catch.)
- Hook specifications with `noop: true` are informational only, must carry `amount == 0` (`JBTerminalStore_NoopHookSpecHasAmount`), and don't trigger the hook. The buyback hook uses noop specs as its public preview API — never strip them.
- Zero weight → tokens aren't minted but the payment is still accepted and recorded.
- ERC-20 acceptance measures a balance delta (`_acceptingToken` transient guard blocks reentrant transfers), so fee-on-transfer tokens credit only what actually arrived.
- `previewPayFor(projectId, token, amount, beneficiary, metadata)` simulates the whole path view-only and splits the result via `controller.previewMintOf`.

### `addToBalanceOf`

```solidity
function addToBalanceOf(uint256 projectId, address token, uint256 amount,
    bool shouldReturnHeldFees, string calldata memo, bytes calldata metadata) external payable;
```

Adds funds without minting tokens. With `shouldReturnHeldFees = true`, held fees are unlocked proportionally (see Held fees) and the returned fee is credited to the balance on top of `amount`.

## Cash out mechanics

### `cashOutTokensOf`

```solidity
function cashOutTokensOf(
    address holder,
    uint256 projectId,
    uint256 cashOutCount,       // 18-decimal project tokens to burn
    address tokenToReclaim,     // terminal token to receive
    uint256 minTokensReclaimed, // terminal-token decimals
    address payable beneficiary,
    bytes calldata metadata
) external returns (uint256 reclaimAmount);
```

Caller must be `holder` or an operator with `CASH_OUT_TOKENS`.

### Bonding curve (`JBCashOuts.cashOutFrom`)

```
if cashOutCount == 0                     → 0
if cashOutTaxRate == MAX (10_000)        → 0        (tokens still burn!)
if cashOutCount >= totalSupply           → surplus  (full supply reclaims everything)

base = surplus × cashOutCount / totalSupply
if cashOutTaxRate == 0                   → base     (proportional)
else → base × [(MAX − rate) + rate × cashOutCount / totalSupply] / MAX
```

| Tax rate | Effect |
|---|---|
| 0 | Linear: proportional share of surplus |
| 0 < r < 10_000 | Convex penalty; small cash-outs approach proportional value, leftover boosts remaining holders |
| 10_000 | Reclaim = 0; surplus locked; tokens burned anyway |

`JBCashOuts.minCashOutCountFor(surplus, desiredOutput, totalSupply, cashOutTaxRate)` is the inverse (binary search in the general case; reverts `JBCashOuts_DesiredOutputNotAchievable` at 100% tax).

### Surplus semantics

- **Pricing** uses the project's surplus across **all terminals and all tokens** (`JBSurplus.currentSurplusOf` over `DIRECTORY.terminalsOf(projectId)`), converted into the reclaim token's accounting context. `totalSupply` is `controller.totalTokenSupplyWithReservedTokensOf(projectId)` = credits + ERC-20 supply + pending reserved tokens.
- **Settlement** is capped at the reclaim token's **local surplus in the calling terminal** (`JBTerminalStore_InadequateTerminalStoreBalance` if `reclaimAmount + hook spec amounts > local token surplus`). Aggregate surplus can price a cash-out it cannot fund locally.
- Per-token surplus = balance − remaining current-cycle payout limit (converted via `JBPrices` when limit currency differs). Funds under the payout limit are NOT cash-out-able.
- `scopeCashOutsToLocalBalances` does **not** change the store's math. It is a flag passed through to omnichain data hooks in `JBBeforeCashOutRecordedContext`, telling them to use only local-chain balances instead of cross-chain aggregates.
- The data hook (when `useDataHookForCashOut`) has absolute control: it returns `(cashOutTaxRate, cashOutCount, totalSupply, surplusValue, hookSpecifications)` and can override every input to the curve. The result is still capped at the passed-in surplus.
- Cash-out count > total supply reverts `JBTerminalStore_InsufficientTokens`.

### Cash-out fees

- **Nonzero `cashOutTaxRate`** → the 2.5% protocol fee applies to the **entire reclaim amount** of every cash out (unless the beneficiary is feeless).
- **`cashOutTaxRate == 0`** → fee applies **only up to `feeFreeSurplusOf[projectId][token]`**, then that counter is decremented. This prevents the round-trip fee bypass (fee-free intra-terminal payout → zero-tax cash out) while leaving genuinely fee-free surplus fee-free.
- `feeFreeSurplusOf` lifecycle: incremented on fee-free same-terminal payouts (and on forgiven fees); after any outflow it's capped at remaining balance (non-fee-free funds leave first); cleared on terminal migration; persists across rulesets; no admin reset.
- Cash-out fees are always processed immediately (never held), and burn happens before funds move.

`previewCashOutFrom(holder, projectId, cashOutCount, tokenToReclaim, beneficiary, metadata)` simulates the store path; `STORE.currentReclaimableSurplusOf` computes reclaim values from either explicit inputs or live state.

## Ruleset mechanics

### Queuing and IDs

- `rulesetId` = the `block.timestamp` at queue time (or `latestId + 1` if a same-second queue collided). This is why `JBDeadline` can compare `ruleset.id` to `ruleset.start`.
- `queueFor` validates: `duration ≤ uint32.max`, `weight ≤ uint112.max`, `weightCutPercent ≤ 1e9`, `mustStartAtOrAfter + duration ≤ uint48.max`, and that a non-zero `approvalHook` is a deployed contract supporting `IJBRulesetApprovalHook` (ERC-165 probed in try/catch).
- `JBController._queueRulesets` additionally validates `reservedPercent ≤ 10_000` and `cashOutTaxRate ≤ 10_000`, then sets split groups and fund access limits per config.
- `mustStartAtOrAfter == 0` → treated as `block.timestamp`.

### Approval hooks

`JBApprovalStatus`: `Empty, Upcoming, Active, ApprovalExpected, Approved, Failed`. The approval hook checked for a ruleset is the one on the ruleset it is `basedOn` (no base → `Empty`). A reverting approval hook is treated as `Failed` (try/catch), so it can't permanently freeze a project.

`JBDeadline(DURATION)` logic:

```
ruleset.id > ruleset.start                 → Failed   (queued after start)
ruleset.start − ruleset.id < DURATION      → Failed   (queued too late)
block.timestamp + DURATION < ruleset.start → ApprovalExpected
otherwise                                  → Approved
```

Pre-deployed instances: 3 hours, 1 day, 3 days, 7 days. If `DURATION` exceeds the cycle duration, no queued ruleset can ever pass — the current configuration is locked in perpetuity.

### Current-ruleset resolution (`JBRulesets.currentOf`)

1. Find the "currently approvable" ruleset (started, not expired; walks `basedOnId` backwards).
2. If it's `Approved`/`Empty`, use it; otherwise fall back to its base (latest approved configuration), walking back as needed.
3. If the resolved base has `duration == 0`, it IS the current ruleset. Otherwise the current ruleset is a **simulated cycled copy** of the base: unqueued cycles are synthesized on the fly with derived `start`, `cycleNumber`, and cut `weight` (they're never stored).

`upcomingOf` returns the next ruleset (queued and approvable, or a simulated next cycle); it returns an empty struct when the current ruleset has `duration == 0` (nothing rolls over).

### Cycle number and start derivation

```
cycleNumber = baseCycleNumber + (start − baseStart) / baseDuration     (duration > 0)
            = baseCycleNumber + 1                                       (base duration == 0)
start       = smallest multiple of baseDuration ≥ mustStartAtOrAfter, aligned to baseStart + baseDuration
```

### Weight cut

```
weight(n cycles later) = baseWeight × ((1e9 − weightCutPercent) / 1e9)^n     // applied iteratively with mulDiv
```

- **`weight == 1` sentinel** in a queued config: inherit the previous ruleset's fully-cut weight (as of the new start) instead of setting a literal weight. `weight == 0` is a literal zero (no tokens minted).
- Iteration limit: if the number of elapsed cycles (`weightCutMultiple`) exceeds `20_000` past the cache, `deriveWeightFrom` reverts with `JBRulesets_WeightCacheRequired`. Anyone can call `updateRulesetWeightCache(projectId, rulesetId)` (permissionless) to advance the cached `JBRulesetWeightCache {uint112 weight; uint168 weightCutMultiple}` in steps of ≤ 20,000 cycles. Pass the ruleset ID that `currentOf()` actually resolves to (the approved base, not a rejected latest).
- Ruleset intrinsics are packed in one slot: weight bits 0–111, `basedOnId` 112–159, `start` 160–207, `cycleNumber` 208–255. User properties: approvalHook 0–159, duration 160–191, weightCutPercent 192–223.

## Reserved token distribution

Accumulation: every mint with `useReservedPercent: true` splits `tokenCount` via

```
beneficiaryTokenCount = mulDiv(tokenCount, 10_000 − reservedPercent, 10_000)
pendingReservedTokenBalanceOf[projectId] += tokenCount − beneficiaryTokenCount
```

Nothing is minted for reserves until `JBController.sendReservedTokensToSplitsOf(projectId)` — **permissionless**, reverts `JBController_NoReservedTokens` when pending balance is 0.

Distribution flow:

```
sendReservedTokensToSplitsOf()
  → tokenCount = pendingReservedTokenBalanceOf; reset to 0
  → TOKENS.mintFor(controller, projectId, tokenCount)      // minted to the controller itself
  → for each split in group RESERVED_TOKENS (1), using the CURRENT ruleset's splits:
      splitCount = mulDiv(tokenCount, split.percent, 1e9)
      1. split.hook set → ERC-20: forceApprove the hook, call processSplitWith (try/catch;
         unconsumed allowance is revoked and BURNED). Credits: transferred directly to the hook.
      2. else split.projectId != 0 →
         - split.projectId == source project → revert JBController_ReservedTokenSplitProjectSameAsOwner
         - pay the destination project's primary terminal for the token (try/catch;
           on failure tokens transfer to the beneficiary instead)
         - if the project has no ERC-20 or destination has no terminal for it → send to beneficiary
      3. else beneficiary == 0xdead → BURN (documented burn sentinel)
      4. else → send to split.beneficiary (or msg.sender if beneficiary == 0)
  → leftover (splits < 100%) → project owner
```

`JBController.migrate` (called by the directory during controller migration) reverts with `JBController_PendingReservedTokens` if pending reserves haven't been distributed.

### `mintTokensOf` permissions

`mintTokensOf(projectId, tokenCount, beneficiary, memo, useReservedPercent)` may be called by: the project owner / `MINT_TOKENS` operator (**only if** the current ruleset has `allowOwnerMinting`), any of the project's terminals, the ruleset's data hook, or an address the data hook approves via `hasMintPermissionFor(projectId, ruleset, addr)`. Terminals and the data hook bypass the `allowOwnerMinting` check.

## Splits system

### Storage packing (`JBSplits`)

Two packed words per split (values from `_setSplitsOf`):

```
word 1: percent            bits 0–31
        projectId          bits 32–95    (uint64)
        beneficiary        bits 96–255
word 2 (only stored when non-default):
        preferAddToBalance bit 0
        lockedUntil        bits 1–48     (uint48)
        hook               bits 49–208
```

### Rules

- Split group percents must each be > 0 (`JBSplits_ZeroSplitPercent`) and sum to ≤ `SPLITS_TOTAL_PERCENT` (`JBSplits_TotalPercentExceeds100`). Sum < 100% is fine: the leftover goes to the project owner (payouts, reserved tokens).
- **Locked splits** must be preserved (same `percent`, `projectId`, `beneficiary`, `hook`, `preferAddToBalance`) in any new set for the same ruleset+group, with the same multiplicity for duplicates; `lockedUntil` can only be extended (`split.lockedUntil >= old.lockedUntil`). Violations revert `JBSplits_PreviousLockedSplitsNotIncluded`.
- **Fallback**: `splitsOf(projectId, rulesetId, groupId)` falls back to `rulesetId = 0` when no splits are set for the given ruleset. Setting splits at `rulesetId = 0` defines project-wide defaults.
- **Routing**: `JBSplits.setSplitGroupsOf` is controller-only, so mid-ruleset split changes go through `JBController.setSplitGroupsOf(projectId, rulesetId, splitGroups)` which enforces owner/`SET_SPLIT_GROUPS`. Exception (self-managed groups): a group whose `groupId`'s lower 160 bits equal `msg.sender` AND whose upper 96 bits are non-zero can be set directly on `JBSplits` by that address (used by hooks managing their own split groups). Protocol group IDs (reserved = 1, payout = token address, upper bits zero) always require the controller.

```typescript
// Change payout splits mid-ruleset (rulesetId = the active ruleset's id, or 0 for the default group)
const controller = await publicClient.readContract({
  address: JB_DIRECTORY, abi: JB_DIRECTORY_ABI, functionName: 'controllerOf', args: [projectId],
})
await walletClient.writeContract({
  address: controller, abi: JB_CONTROLLER_ABI, functionName: 'setSplitGroupsOf',
  args: [projectId, rulesetId, splitGroups],
})
```

The same controller routing applies to project metadata: `JBController.setUriOf(projectId, uri)` (owner or `SET_PROJECT_URI`); there is no setter on `JBProjects`. Each chain stores its own `uriOf` — update every chain for omnichain projects.

### Payout split execution (`executePayout`)

- Split hook path: hook must pass `supportsInterface(IJBSplitHook)`. Non-feeless hooks receive the amount **net of the 2.5% fee**; funds are made pullable, and partial pulls are handled by `JBPayoutSplitGroupLib`.
- Project path: pays the destination project's primary terminal for the token — `pay(...)` (mints destination tokens to `split.beneficiary`, or the original caller if unset) or `addToBalanceOf(...)` when `preferAddToBalance`. Same-terminal transfers are **fee-free** (value never leaves the contract) and tracked in `feeFreeSurplusOf`.
- **A payout split pointing back at the paying project reverts** (`JBMultiTerminal_MintNotAllowed`) — self-payout would mint the project's own tokens against its own surplus, bypassing `allowOwnerMinting`.
- Direct path (no hook, no projectId): transfer to `split.beneficiary`, or to the original `sendPayoutsOf` caller when the beneficiary is zero (a "wildcard split" — usable to incentivize keeper calls). Fee applies unless the recipient is feeless.
- Each split payout runs in try/catch — a reverting split returns its funds to the project balance instead of blocking the whole distribution.

## Fund access limits

- Packing: `amount` in bits 0–223 (`uint224`), `currency` in bits 224–255, stored as an array per (project, ruleset, terminal, token). Zero-amount entries are not stored.
- Within a group, `payoutLimits` and `surplusAllowances` must be sorted by **strictly increasing currency** (duplicate currencies impossible); duplicate (terminal, token) groups revert.
- **An empty `fundAccessLimitGroups` array means ZERO payouts and zero allowance** — not unlimited. Use `amount = type(uint224).max` for unlimited.
- Limits are set only at queue time via the controller (`setFundAccessLimitsFor` is controller-only); they are immutable for a queued ruleset.

### Lifecycle: payout limits reset per cycle; allowances don't

```solidity
// JBTerminalStore
usedPayoutLimitOf[terminal][projectId][token][rulesetCycleNumber][currency]   // resets each cycle
usedSurplusAllowanceOf[terminal][projectId][token][rulesetId][currency]       // persists across cycles
```

- A cycling ruleset refreshes its payout limit every cycle → recurring distributions (salaries/vesting) need ONE cycling ruleset, not N queued rulesets.
- Surplus allowance is a one-time budget per ruleset ID; implicit cycle rollover does not reset it. Only queuing a new ruleset does.
- `recordPayoutFor` **caps** the requested amount at the remaining limit instead of reverting; a cross-currency conversion that rounds to zero consumes no limit and pays nothing.
- Payout limits also **shield funds from cash-outs**: surplus = balance − remaining payout limit.

## Fees

### Math (`JBFees`)

```
fee (forward)  = amount × 25 / 1000 = amount / 40          // 2.5% OF the gross, deducted from it
fee (backward) = mulDiv(amountAfterFee, 40, 39) − amountAfterFee   // gross-up from a net amount
```

`feeAmountFrom(amount, feePercent)` / `feeAmountResultingIn(amountAfterFee, feePercent)` are the generic forms over `MAX_FEE = 1000`.

### Applicability

Fees apply to fund egress: payouts to non-feeless recipients, payout split hooks, leftover payout to the owner, `useAllowanceOf`, terminal migration to a non-feeless terminal, and cash outs (full amount at nonzero tax; up to `feeFreeSurplusOf` at zero tax). Exempt: same-terminal project-to-project payouts, feeless addresses (`JBFeelessAddresses` — owner-set global or per-project flags, plus an optional `IJBFeelessHook` delegate), and the fee project (#1) itself on migration. For `useAllowanceOf`, the fee is skipped if the project owner **or** the beneficiary is feeless; the fee-project tokens minted by the fee go to the caller-chosen `feeBeneficiary`.

### Fee processing is fail-open

`_processFee` wraps `executeProcessFee` in try/catch. On failure the fee is **forgiven**: credited back to the paying project's balance, `feeFreeSurplusOf` incremented, `FeeReverted` emitted. Fees route to project #1's primary terminal for the token via `pay(...)` (minting project-1 tokens to the fee beneficiary), or via `addToBalanceOf` when the beneficiary is `address(0)`.

### Held fees

When ruleset metadata has `holdFees` (payouts and allowance only — never cash-outs):

- The **gross basis amount** (not the fee) is pushed as `JBFee{uint224 amount, address beneficiary, uint48 unlockTimestamp}`; unlock = `block.timestamp + 2_419_200` (28 days).
- `processHeldFeesOf(projectId, token, count)` — permissionless — processes unlocked fees in order, computing the fee as `amount / 40` at processing time; stops at the first still-locked entry; deletes entries before the external call (reentrancy-safe) and forgives (not retries) failures.
- `addToBalanceOf(..., shouldReturnHeldFees: true)` refunds held fees against the deposited amount: an entry is fully released when the deposit covers its original **net** payout (`gross − gross/40`); a partial deposit shrinks the stored gross using the back-calculated fee (`mulDiv(x,40,39) − x`) so dust repayments can't short the fee project. Returned fees are added to the project's recorded balance.
- Held-fee storage lives in the terminal but the mutation logic is `JBHeldFees`, an **external library reached via DELEGATECALL** (EIP-170 size management). `heldFeesOf(projectId, token, count)` views live entries.
- Terminal migration does NOT move held fees; they remain processable on the old terminal (backed by the terminal's token balance).

## Terminal operations

```solidity
function sendPayoutsOf(uint256 projectId, address token, uint256 amount, uint256 currency,
    uint256 minTokensPaidOut) external returns (uint256 amountPaidOut);

function useAllowanceOf(uint256 projectId, address token, uint256 amount, uint256 currency,
    uint256 minTokensPaidOut, address payable beneficiary, address payable feeBeneficiary,
    string calldata memo) external returns (uint256 netAmountPaidOut);

function migrateBalanceOf(uint256 projectId, address token, IJBTerminal to)
    external returns (uint256 balance);

function addAccountingContextsFor(uint256 projectId, JBAccountingContext[] calldata accountingContexts) external;
```

- `sendPayoutsOf` is permissionless unless the ruleset sets `ownerMustSendPayouts` (then `SEND_PAYOUTS` required). `currency` must match a configured payout-limit currency; `amount` is denominated in that currency and auto-capped at the remaining limit. Leftover after splits goes to the owner (fee applies; transfer failure returns funds to the balance and emits `PayoutTransferReverted`).
- `useAllowanceOf` requires owner or `USE_ALLOWANCE`. Draws from local token surplus only; reverts if `usedAmount > surplus` or the allowance (keyed by ruleset ID) is exhausted/zero.
- `migrateBalanceOf` requires `MIGRATE_TERMINAL` and `allowTerminalMigration` in the ruleset; destination must accept the token; migration to self reverts. A 2.5% fee applies unless the destination is feeless (this also settles the `feeFreeSurplusOf` liability, which is cleared).
- `addAccountingContextsFor` requires owner / `ADD_ACCOUNTING_CONTEXTS` / the controller, and `allowAddAccountingContext` in the current ruleset (validated in the store).

## Core infrastructure

### JBDirectory

```solidity
mapping(uint256 projectId => IERC165) public controllerOf;
mapping(address addr => bool) public isAllowedToSetFirstController;
```

- `setControllerOf(projectId, controller)`: owner / `SET_CONTROLLER`, or an allowlisted address setting the **first** controller. Requires the current controller's `setControllerAllowed(projectId)` (i.e. ruleset `allowSetController`) when one exists. Migration lifecycle when replacing a controller: `newController.beforeReceiveMigrationFrom` → `oldController.migrate` (runs while the directory still points at the old controller) → store new controller → `newController.afterReceiveMigrationFrom`.
- `setTerminalsOf(projectId, terminals)`: owner / `SET_TERMINALS` / the controller; requires `allowSetTerminals` unless called by the controller; replaces the whole array; duplicate terminals revert.
- `setPrimaryTerminalOf(projectId, token, terminal)`: requires `SET_PRIMARY_TERMINAL`; the terminal must accept the token; if it isn't registered yet it's added implicitly (additionally requires `ADD_TERMINALS` and `allowSetTerminals`).
- `primaryTerminalOf(projectId, token)` resolution: explicitly-set primary (if still registered) → first registered terminal accepting the token → `address(0)`.

### JBPermissions

- `permissionsOf[operator][account][projectId]` is a 256-bit bitmap; bit N = permission ID N. Project ID 0 is the **wildcard** granting the permission across all of the account's projects.
- `setPermissionsFor(account, JBPermissionsData{operator, projectId, permissionIds})` — `permissionIds` is `uint8[]`, so IDs are 0–255 by type; ID 0 is reserved and reverts. Setting replaces the whole bitmap for that (operator, account, projectId) — an empty array clears all permissions.
- A non-account caller may set permissions only if it has ROOT for that specific project, and even then it cannot grant ROOT and cannot touch the wildcard project (prevents privilege escalation).
- `hasPermission(operator, account, projectId, permissionId, includeRoot, includeWildcardProjectId)`: ROOT short-circuits (project-scoped or wildcard) when `includeRoot`; otherwise checks the specific bit on the project and (optionally) the wildcard. `hasPermissions` requires ALL listed IDs; an empty array returns true (vacuous truth).

### JBTokens (credits + ERC-20 dual balance)

```solidity
mapping(address holder => mapping(uint256 projectId => uint256)) public creditBalanceOf;
mapping(uint256 projectId => uint256) public totalCreditSupplyOf;
mapping(uint256 projectId => IJBToken) public tokenOf;
mapping(IJBToken token => uint256) public projectIdOf;
```

All mutating functions are controller-only (`onlyControllerOf`); integrators go through `JBController` (`deployERC20For`, `setTokenFor`, `claimTokensFor`, `transferCreditsFrom`, `mintTokensOf`, `burnTokensOf`, `setTokenMetadataOf`).

- `mintFor`: mints ERC-20 directly when a token exists, otherwise credits. Total supply (credits + ERC-20) is capped at `type(uint208).max`.
- `burnFrom`: burns **credits first**, then ERC-20; reverts if `count > tokenBalance + creditBalance`.
- `totalSupplyOf(projectId)` = credits + ERC-20 `totalSupply()` — the cash-out denominator. WARNING: an externally-minted custom token inflates this and dilutes cash-outs.
- `deployERC20For(projectId, name, symbol, salt)`: EIP-1167 clone of the canonical `JBERC20`. Non-zero salt → `cloneDeterministic` with `keccak256(abi.encode(msg.sender, salt))` — deterministic (and hence same-address cross-chain when the caller and salt match). Controller-side permission: owner / `DEPLOY_ERC20`.
- `setTokenFor(projectId, token)` requirements: token non-zero, project has no token, token not assigned to another project, `token.decimals() == 18`, `token.canBeAddedTo(projectId)` returns true. Controller-side: owner / `SET_TOKEN` plus ruleset `allowSetCustomToken` (checked when a ruleset exists).
- Custom token requirements: 18 decimals; `mint(address,uint256)` and `burn(address,uint256)` callable by `JBTokens` without approval; transfer restrictions must exempt mint/burn; setting a token does not migrate credits — holders convert via `JBController.claimTokensFor(holder, projectId, tokenCount, beneficiary)` (caller must be the holder or a `CLAIM_TOKENS` operator of the holder).
- `pauseCreditTransfers` in ruleset metadata blocks `transferCreditsFrom` (checked in the controller).

### JBPrices

- Feeds are stored per `(projectId, pricingCurrency, unitCurrency)` as **append-only lists**: adding another feed for the same pair appends a fallback; feeds can never be modified or removed. A feed that reverts or returns 0 is skipped in favor of the next.
- `addPriceFeedFor(projectId, pricingCurrency, unitCurrency, feed)`: project 0 (`DEFAULT_PROJECT_ID`) = protocol-wide defaults, owner-only; any other project = controller-only (reached via `JBController.addPriceFeedFor`, which needs owner / `ADD_PRICE_FEED` and ruleset `allowAddPriceFeed` — allowed unconditionally before the first ruleset). Zero currencies and zero feed revert. Only exact-direction duplicates are rejected; an opposite-direction feed may coexist.
- `pricePerUnitOf(projectId, pricingCurrency, unitCurrency, decimals)` resolution order:
  1. same currency → `10**decimals`
  2. project's direct feeds (in order, skipping unusable)
  3. project's inverse feeds: `mulDiv(10**decimals, 10**decimals, inversePrice)`
  4. default (project 0) direct feeds
  5. default inverse feeds
  6. revert `JBPrices_PriceFeedNotFound`

### JBProjects

ERC-721 (`"Juicebox Projects"` / `"JUICEBOX"`); token ID = project ID; `count` is both counter and last ID. `tokenURI` delegates to an owner-set `tokenUriResolver` (empty string when unset — no revert). `createFor(owner)` is public/payable (exact `creationFee`), so projects can be minted without the controller — but then rulesets must be launched separately.

## Metadata encoding (`JBMetadataResolver`)

The `bytes metadata` argument of `pay`/`cashOutTokensOf` is a multiplexed container read by every hook:

```
[ 32B reserved for protocol ]                      // word 0
[ lookup table: (bytes4 id, uint8 wordOffset)* ]   // padded to 32B words, 5 bytes per entry
[ data blobs, each padded to 32B ]
```

- `getId(purpose, target) = bytes4(bytes20(target) ^ bytes20(keccak256(bytes(purpose))))`. Hooks key their entries by their own address (`getId("pay")` inside the hook = `getId("pay", hookAddress)`).
- `getDataFor(id, metadata)` → `(bool found, bytes data)`; `addToMetadata` appends an entry. Minimum parseable length is 37 bytes; malformed tables revert.
- **Permit2**: `JBMultiTerminal._acceptFundsFor` reads an entry keyed by `getId("permit2", terminalAddress)` decoding to `JBSingleAllowance {uint256 sigDeadline; uint160 amount; uint48 expiration; uint48 nonce; bytes signature}`; a failed `PERMIT2.permit` is caught (event `Permit2AllowanceFailed`). The subsequent pull prefers a sufficient direct ERC-20 allowance; otherwise it uses `PERMIT2.transferFrom` (amount must fit `uint160`).
- Building metadata off-chain: reserve word 0, then table `[id1‖offset1, id2‖offset2, …]` zero-padded to a word, then each `abi.encode(...)` blob (already 32-byte aligned).

## Buyback hook (`JBBuybackHook`, Uniswap V4)

One canonical hook serves all projects. It is the project's ruleset `dataHook` with `useDataHookForPay` (and optionally `useDataHookForCashOut`); `JBBuybackHookRegistry` manages which hook a project uses (`SET_BUYBACK_HOOK` permission; choice can be permanently locked).

### Configuration

- `setPoolFor(projectId, poolKey, twapWindow, terminalToken)` / `setPoolFor(projectId, fee, tickSpacing, twapWindow, terminalToken)` / `initializePoolFor(projectId, fee, tickSpacing, twapWindow, terminalToken, sqrtPriceX96)` — all gated by `SET_BUYBACK_POOL`. Terminal token is normalized to `address(0)` for native. **Pool keys are immutable once set** (`JBBuybackHook_PoolAlreadySet`). `initializePoolFor` initializes the V4 pool and then verifies the on-chain `sqrtPriceX96` equals the caller's expectation — defense against front-run pool initialization at a poisoned price.
- `setTwapWindowOf(projectId, terminalToken, newWindow)` — `SET_BUYBACK_TWAP`; window must be within `MIN_TWAP_WINDOW = 5 minutes` … `MAX_TWAP_WINDOW = 2 days`.
- The V4 `poolManager` and oracle hook are set once per chain by the deployer (`setChainSpecificConstants`) to keep the CREATE2 address unified.

### Pay-side routing (`beforePayRecordedWith`)

Payer metadata entry, keyed by `getId("pay", buybackHookAddress)`:

```solidity
abi.encode(uint256 amountToSwapWith, uint256 minimumSwapAmountOut)
```

- `amountToSwapWith == 0` → use the full payment. `amountToSwapWith > totalPaid` reverts.
- `minimumSwapAmountOut != 0` → treated as an explicit user quote (hard settlement floor). `0` → the hook derives a minimum from the pool TWAP (sigmoid slippage tolerance: `minSlippage = max(poolFee + 1%, 2%)`, saturating toward `8_800/10_000` = 88% max as estimated price impact grows; cold-start spot fallback uses a 3% tolerance with bounded impact).
- Route decision: `tokenCountWithoutHook = mulDiv(amountToSwapWith, weight, weightRatio)` (identical math to the terminal). If the pool has no live liquidity or minting meets/exceeds the minimum → **noop spec** (mint path; spec still returned with diagnostic metadata: twapTick, liquidity, poolId, raw quote — this is the public preview API). Otherwise returns `weight = 0` and a hook spec forwarding `amountToSwapWith` to itself.
- With no configured pool or no liquidity, an explicit minimum that direct minting can't satisfy reverts `JBBuybackHook_SpecifiedSlippageExceeded` rather than silently under-delivering.

### Pay-side execution (`afterPayRecordedWith`)

- Swap runs via `poolManager.unlock` with a price limit derived from the issuance rate — the pool fills only while it beats minting; unconsumed input stays for minting. The whole swap is in try/catch: **swap failure falls back to minting** and never reverts the payment (unless an explicit user minimum then can't be met).
- Project tokens received from the swap are **burned and re-minted through the controller** so the reserved percent applies to swapped tokens too.
- Leftover terminal tokens (partial fill) are returned to the project via `addToBalanceOf` and minted at the issuance rate; fee-on-transfer deltas are measured on both hops.
- Same-terminal split pays that forward a net-of-fee amount scale the TWAP-derived floors proportionally; explicit user minima never scale.

### Cash-out-side routing (`beforeCashOutRecordedWith` / `afterCashOutRecordedWith`)

Metadata entry keyed by `getId("cashOut", buybackHookAddress)`:

```solidity
abi.encode(uint256 minimumSwapAmountOut, bool skip)
```

- `skip = true` forces the terminal bonding-curve path (the slippage floor still applies to the direct reclaim — an unmeetable floor reverts).
- Fallback to the terminal path when: `skip`, no pool set, no project token, or `cashOutCount == 0`.
- Otherwise the hook compares the AMM quote against the **net** direct reclaim (accounting for the 2.5% fee semantics incl. `feeFreeSurplusOf` at zero tax) and additionally requires the direct path be locally settleable by the selected terminal. If the AMM wins, it returns `cashOutTaxRate = MAX_CASH_OUT_TAX_RATE` and `surplus = 0` so the terminal reclaims nothing directly, and the hook sells the burned tokens through the pool itself.

## 721 tiers hook (`JB721TiersHook`)

Deployed as EIP-1167 **clones** via `JB721TiersHookDeployer.deployHookFor`; tier state lives in the shared `JB721TiersHookStore`. The hook is data hook + pay hook + cash-out hook, and is `JBOwnable` (project-based ownership with `JBPermissions` delegation).

- **`METADATA_ID_TARGET` is the implementation address** (immutable, baked into clone bytecode) — NOT the clone's own address. All clones share the same metadata IDs.

### Tier structs

```solidity
struct JB721TierConfig {          // input to initialize/adjustTiers
    uint104 price;                // in the hook's pricing context (currency + decimals set at init)
    uint32 initialSupply;
    uint32 votingUnits;
    uint16 reserveFrequency;      // 1 reserve accrues per N minted
    address reserveBeneficiary;
    bytes32 encodedIpfsUri;
    uint24 category;              // tiers must be added sorted by category ascending
    uint8 discountPercent;        // denominator 200: 200 = 100% off (free mint)
    JB721TierConfigFlags flags;   // allowOwnerMint, useReserveBeneficiaryAsDefault, transfersPausable,
                                  // useVotingUnits, cantBeRemoved, cantIncreaseDiscountPercent, cantBuyWithCredits
    uint32 splitPercent;
    JBSplit[] splits;
}

struct JB721Tier {                // returned by the store
    uint32 id;
    uint104 price;
    uint32 remainingSupply;
    uint32 initialSupply;
    uint104 votingUnits;
    uint16 reserveFrequency;
    address reserveBeneficiary;
    bytes32 encodedIpfsUri;
    uint24 category;
    uint8 discountPercent;
    JB721TierFlags flags;         // allowOwnerMint, transfersPausable, cantBeRemoved,
                                  // cantIncreaseDiscountPercent, cantBuyWithCredits
    uint32 splitPercent;
    string resolvedUri;
}
```

### Payment processing

Payer metadata entry keyed by `getId("pay", METADATA_ID_TARGET)`:

```solidity
abi.encode(bool allowOverspending, uint16[] tierIdsToMint)
```

Flow (`_processPayment` → `_mintAndUpdateCredits`):

- Payment value is normalized into the hook's pricing context via `JBPrices` (invalid conversion → payment passes through without minting).
- **Credits are per-beneficiary** (`payCreditsOf[beneficiary]`), combined with the payment only when `payer == beneficiary`.
- Overspending allowed only if the collection's `preventOverspending` flag is off AND the payer didn't disallow it. Leftover then accrues as pay credits; otherwise leftover reverts `JB721TiersHook_Overspending`.
- Tiers with `cantBuyWithCredits` must be covered entirely by fresh payment value (`JB721TiersHook_CantBuyWithCredits`).
- Discounts reduce the price paid (`price − price × discountPercent / 200`) but do **not** reduce cash-out weight (always the full tier price).
- Credits are lost if the project switches hooks; they can't be withdrawn, only spent.

### Cash out

- Project-token `cashOutCount` must be 0 — the hook reverts `JB721Hook_UnexpectedTokenCashedOut` if fungible tokens are cashed alongside NFTs.
- Metadata entry keyed by `getId("cashOut", METADATA_ID_TARGET)`: `abi.encode(uint256[] tokenIds)`.
- The hook overrides the bonding-curve inputs: `cashOutCount = cashOutWeightOf(tokenIds)` (sum of tier prices), `totalSupply = totalCashOutWeight()` (all outstanding NFTs + pending reserves). The ruleset's `cashOutTaxRate` still applies.
- `afterCashOutRecordedWith` burns the NFTs after verifying `context.holder` owns each.

### Reserves, minting, tiers

- Reserve mints are NOT inline: they **accrue** per tier based on `reserveFrequency` as sales happen; anyone calls `mintPendingReservesFor(tierId, count)` (or the batch variant) to mint them to the tier's reserve beneficiary (or the collection default). Pausable per-ruleset via a bit in the ruleset metadata's 14-bit app-specific `metadata` field (`JB721TiersRulesetMetadataResolver.mintPendingReservesPaused`).
- `mintFor(tierIds, beneficiary)` (owner / `MINT_721`) force-mints from tiers with `allowOwnerMint`.
- `adjustTiers(tiersToAdd, tierIdsToRemove)` (owner / `ADJUST_721_TIERS`): added tiers get sequential IDs and must be category-sorted; removed tiers stop minting but existing NFTs stay valid; `cantBeRemoved` tiers can't be removed.
- `setDiscountPercentOf(tierId, discountPercent)` (owner / `SET_721_DISCOUNT_PERCENT`); `cantIncreaseDiscountPercent` restricts direction.
- WARNING: `useReserveBeneficiaryAsDefault` in a tier config overwrites the hook-wide default reserve beneficiary, affecting all tiers without a tier-specific one.

## Other periphery

- **JBRouterTerminal / JBRouterTerminalRegistry** (`nana-router-terminal-v6`): a universal forwarding terminal that accepts any token and converts it to whatever the destination project accepts (direct forward, Uniswap V3/V4 swap, or recursive JB cash-out routing), always picking the path yielding the most project tokens. The registry maps projects to their chosen router terminal with an owner-managed default; projects opt in via `SET_ROUTER_TERMINAL` and can permanently lock the choice. It implements `IJBPayerTracker` so refunds and credit cash-outs resolve to the original payer.
- **JBProjectPayer** (`nana-project-payer-v6`): EIP-1167-cloned relay that auto-pays a configured project when it receives funds (`receive()`), with owner-set defaults (project ID, beneficiary, memo, metadata, pay-vs-addToBalance). Also an `IJBPayerTracker`. `JBProjects.creationFeeReceiver` can be one of these, which is why `originalPayer` tracking exists.

## Common mistakes

1. **Sending the wrong `msg.value` to `launchProjectFor`** — it must equal `PROJECTS.creationFee()` exactly (not ≥). Query the fee first; it can change (≤ 0.001 ETH).
2. **Treating empty `fundAccessLimitGroups` as "unlimited"** — it means ZERO payouts and zero allowance. Unlimited requires `type(uint224).max`.
3. **Expecting surplus allowance to reset each cycle** — payout limits reset per cycle number; allowances are keyed by ruleset ID and only reset when a new ruleset is queued.
4. **Assuming zero cash-out tax means zero fee (or vice versa)** — nonzero `cashOutTaxRate` puts the 2.5% fee on EVERY cash out; zero tax is fee-free only beyond the project's `feeFreeSurplusOf` counter.
5. **Using the V2-style fee formula `amount × 25 / 1025`** — the V6 fee is a flat `amount / 40` (2.5% of gross, deducted from it); grossing up uses `mulDiv(net, 40, 39) − net`.
6. **Calling `JBSplits.setSplitGroupsOf` or expecting a URI setter on `JBProjects`** — both go through the project's controller (`JBController.setSplitGroupsOf`, `JBController.setUriOf`); fetch `controllerOf` from `JBDirectory`, don't hardcode.
7. **`sendPayoutsOf` amount is denominated in the payout-limit `currency`, not in raw token units** — it's a fixed-point number using the token accounting context's decimals but expressed in `currency`. For a USD limit on 6-decimal USDC, "$100" is `100e6` of USD, converted to USDC at record time via `JBPrices`.
8. **Confusing base-currency IDs with accounting-context currencies** — `baseCurrency` uses `JBCurrencyIds` (`ETH=1`, `USD=2`) or `uint32(uint160(token))`; accounting contexts always use `uint32(uint160(token))`. If they differ, a price feed must exist or every pay/payout reverts `JBPrices_PriceFeedNotFound`.
9. **Forgetting the `weight == 1` sentinel** — queuing a ruleset with weight 1 inherits the previous ruleset's cut weight; a literal "1 wei" weight is not expressible.
10. **Not populating the weight cache for long-idle cycling projects** — past 20,000 elapsed cycles, weight derivation reverts `JBRulesets_WeightCacheRequired` until someone calls `updateRulesetWeightCache` (permissionless, possibly multiple times).
11. **Queuing a ruleset too close to its start with a `JBDeadline` approval hook** — `start − queuedTimestamp < DURATION` → `Failed`, and the protocol silently falls back to cycling the last approved ruleset.
12. **Omitting locked splits (or shrinking their locks) when updating split groups** — reverts `JBSplits_PreviousLockedSplitsNotIncluded`; every locked split must reappear with identical fields and `lockedUntil` ≥ old, with the same multiplicity.
13. **Pointing a payout split at the paying project itself** — reverts (`JBMultiTerminal_MintNotAllowed`); same for reserved-token splits (`JBController_ReservedTokenSplitProjectSameAsOwner`).
14. **Assuming reserved tokens mint on every payment** — they accrue in `pendingReservedTokenBalanceOf` until anyone calls `sendReservedTokensToSplitsOf`; the pending amount also counts in the cash-out `totalSupply` denominator, and controller migration is blocked while it's non-zero.
15. **Building 721-hook metadata IDs from the clone address** — use the implementation address (`METADATA_ID_TARGET`), shared by all clones. Buyback-hook IDs use the hook's own (canonical) address.
16. **Stripping `noop: true` hook specifications when relaying buyback data-hook output** — the noop spec is the protocol's preview API for routing decisions and carries `amount: 0` by rule.
17. **Setting `minReturnedTokens`/`minTokensReclaimed` to 0 in production** — pays/cash-outs then accept any execution (sandwichable when a buyback pool or data hook is involved).
18. **Assuming a project's terminal balance is cash-out-able** — surplus excludes the remaining payout limit; and settlement is capped by the reclaim token's local surplus in that terminal even though pricing uses cross-terminal surplus.
19. **Expecting a failed fee or failed split hook to revert the payout** — fee routing and split hooks are fail-open (try/catch): fees are forgiven back to the project (`FeeReverted`), failed split payouts return to the balance.
20. **Custom tokens with fewer/more than 18 decimals, or burn-with-approval semantics** — `setTokenFor` requires exactly 18 decimals and `JBTokens` calls `mint`/`burn` directly; approvals-based burns break cash outs.
