---
name: jb-ruleset
description: |
  Configure, queue, and read Juicebox rulesets. Use when: (1) designing token economics
  (weight, weight cut, reserved percent, cash out tax rate), (2) queueing future ruleset
  changes via JBController.queueRulesetsOf, (3) configuring approval hooks (JBDeadline)
  for governance-delayed changes, (4) reading current/upcoming/latest rulesets or
  decoding packed ruleset metadata, (5) understanding ruleset cycling, weight decay,
  and the weight cache.
version: 6.0.0
---

# Juicebox Rulesets

A ruleset defines how a project behaves during a period of time: token issuance weight, cash-out terms, payout rules, and permissions. Rulesets cycle automatically — when one's `duration` elapses, the next queued and approved ruleset takes effect. If nothing is queued, the current ruleset auto-cycles with its weight decayed by `weightCutPercent`.

`JBRulesets` stores and schedules rulesets. Only a project's controller can write to it, so all configuration goes through `JBController`.

## Contracts

Same address on every chain (ETH/OP/Base/Arb mainnet + sepolias). Source: `references/shared/chain-config.json`.

| Contract | Address | Role |
|----------|---------|------|
| `JBController` | `0x3fcec3572e84b624477bcff4e2cf1f7deab648f1` | Entry point: queue rulesets, read ruleset + decoded metadata |
| `JBRulesets` | `0x26f2228a4e8b0079ed1c2a3d22f12ff7f83cdfba` | Storage, scheduling, weight decay math |
| `JBDeadline3Hours` | `0xd25264015483caa5c34643942d41f94bed5f1e92` | Approval hook, `DURATION = 3 hours` |
| `JBDeadline1Day` | `0x3a15ac0bcf4f7dd48359a36b3e293254cf26d4ca` | Approval hook, `DURATION = 1 days` |
| `JBDeadline3Days` | `0xcda708c98fbdd15a7ff7f0c5c50f9371ca52c78f` | Approval hook, `DURATION = 3 days` |
| `JBDeadline7Days` | `0x540923f7b6166bf9713490719a2210aeebc9fca2` | Approval hook, `DURATION = 7 days` |

ABIs: `references/shared/abis/JBRulesets.json`, `references/shared/abis/JBController.json`.

## JBRuleset struct (read-only state)

ABI order. `JBRulesets` packs these into storage; view functions return the struct.

| Field | Type | Meaning |
|-------|------|---------|
| `cycleNumber` | `uint48` | Which cycle this is (starts at 1, increments every cycle, including auto-cycles) |
| `id` | `uint48` | Unix timestamp when the ruleset was queued. Stays the same across auto-cycles |
| `basedOnId` | `uint48` | `id` of the ruleset this one was based on (forms a linked list back through history) |
| `start` | `uint48` | When this ruleset became/becomes active (unix timestamp) |
| `duration` | `uint32` | Seconds the ruleset lasts. `0` = no auto-cycling; active until explicitly replaced |
| `weight` | `uint112` | Tokens minted per unit of `baseCurrency` paid, 18-decimal fixed point |
| `weightCutPercent` | `uint32` | Weight reduction per auto-cycle, out of `1_000_000_000` (`JBConstants.MAX_WEIGHT_CUT_PERCENT`) |
| `approvalHook` | `IJBRulesetApprovalHook` | Gates whether the *next* queued ruleset can take effect |
| `metadata` | `uint256` | Packed metadata — decode with `JBRulesetMetadataResolver.expandMetadata` (see below) |

Weight semantics (from `JBTerminalStore`): when the payment currency equals the ruleset's `baseCurrency`, `tokenCount = amount * weight / 10^amount.decimals`. Otherwise the amount is first converted to `baseCurrency` via `JBPrices`. Higher weight = more tokens per unit paid.

## JBRulesetConfig struct (what you queue)

Passed to `JBController.launchProjectFor`, `launchRulesetsFor`, and `queueRulesetsOf`. ABI order:

| Field | Type | Meaning |
|-------|------|---------|
| `mustStartAtOrAfter` | `uint48` | Earliest timestamp the ruleset can begin. `0` = as soon as possible |
| `duration` | `uint32` | Seconds per cycle. `0` = stays active until explicitly replaced |
| `weight` | `uint112` | Tokens per unit paid (18 decimals). `1` = inherit decayed weight from previous ruleset. `0` = no issuance |
| `weightCutPercent` | `uint32` | Decay per auto-cycle, out of `1_000_000_000` |
| `approvalHook` | `IJBRulesetApprovalHook` | Contract that must approve the *next* queued ruleset. `address(0)` = no gate |
| `metadata` | `JBRulesetMetadata` | Behavioral flags and parameters (below) |
| `splitGroups` | `JBSplitGroup[]` | Payout / reserved-token split configuration for this ruleset |
| `fundAccessLimitGroups` | `JBFundAccessLimitGroup[]` | Per-terminal payout limits and surplus allowances |

`queueFor` validation (in `JBRulesets`): `duration` must fit `uint32`, `weight` must fit `uint112`, `weightCutPercent <= 1_000_000_000`, `mustStartAtOrAfter + duration` must fit `uint48`, and a non-zero `approvalHook` must be a deployed contract that reports `IJBRulesetApprovalHook` support via ERC-165 — otherwise the queue reverts.

## JBRulesetMetadata struct

ABI order:

| Field | Type | Meaning |
|-------|------|---------|
| `reservedPercent` | `uint16` | Share of minted tokens reserved for the reserved split group, out of `10_000` (`MAX_RESERVED_PERCENT`) |
| `cashOutTaxRate` | `uint16` | Tax on cash-outs, out of `10_000` (`MAX_CASH_OUT_TAX_RATE`). `0` = proportional reclaim, `10_000` = no reclaim |
| `baseCurrency` | `uint32` | Currency the `weight` is denominated in: `uint32(uint160(tokenAddress))`, or `JBCurrencyIds.ETH = 1` / `JBCurrencyIds.USD = 2` |
| `pausePay` | `bool` | Project can't receive payments this ruleset |
| `pauseCreditTransfers` | `bool` | Token credit transfers disabled |
| `allowOwnerMinting` | `bool` | Owner (or `MINT_TOKENS` operator) can mint on demand |
| `allowSetCustomToken` | `bool` | Project can set a custom ERC-20 via `setTokenFor` |
| `allowTerminalMigration` | `bool` | Terminals can migrate to new implementations |
| `allowSetTerminals` | `bool` | Terminal list can be modified |
| `allowSetController` | `bool` | Controller can be changed |
| `allowAddAccountingContext` | `bool` | New token accounting contexts can be added to terminals |
| `allowAddPriceFeed` | `bool` | New price feeds can be registered in `JBPrices` |
| `ownerMustSendPayouts` | `bool` | Only the project owner can trigger payout distribution |
| `holdFees` | `bool` | Fees accumulate instead of processing immediately |
| `scopeCashOutsToLocalBalances` | `bool` | Omnichain cash-out math uses only local-chain balances |
| `useDataHookForPay` | `bool` | Call the data hook before recording payments |
| `useDataHookForCashOut` | `bool` | Call the data hook before recording cash outs |
| `dataHook` | `address` | Contract called before pay/cash-out to override token counts or add hooks |
| `metadata` | `uint16` | 14 bits of application-specific metadata (upper 2 bits ignored) |

### Bit packing (`JBRulesetMetadataResolver`)

`JBRuleset.metadata` is the struct packed into one `uint256`. `packRulesetMetadata` writes it; `expandMetadata(ruleset)` decodes it back to `JBRulesetMetadata`.

| Bits | Content |
|------|---------|
| 0–3 | Version (currently `1`) |
| 4–19 | `reservedPercent` |
| 20–35 | `cashOutTaxRate` |
| 36–67 | `baseCurrency` |
| 68–81 | 14 bool flags, one bit each, in struct order (`pausePay` = bit 68 … `useDataHookForCashOut` = bit 81) |
| 82–241 | `dataHook` address |
| 242–255 | Custom `metadata` (14 bits) |

`JBController` view functions return the decoded struct, so you rarely unpack by hand.

## Percentage scales

| Field | Type | Scale | 5% example |
|-------|------|-------|------------|
| `reservedPercent` | `uint16` | `10_000` = 100% | `500` |
| `cashOutTaxRate` | `uint16` | `10_000` = 100% | `500` |
| `weightCutPercent` | `uint32` | `1_000_000_000` = 100% | `50_000_000` |
| `JBSplit.percent` | `uint32` | `1_000_000_000` = 100% (`SPLITS_TOTAL_PERCENT`) | `50_000_000` |

## Weight decay

When a ruleset with `duration > 0` ends and no replacement is queued, it auto-cycles: same `id`, `cycleNumber + 1`, and weight cut once per elapsed cycle:

```text
weight_n = weight_0 * ((MAX_WEIGHT_CUT_PERCENT - weightCutPercent) / MAX_WEIGHT_CUT_PERCENT) ^ n
```

where `n = (start_n - start_0) / duration`. `JBRulesets.deriveWeightFrom(...)` computes this iteratively (one `mulDiv` per elapsed cycle). A ruleset queued after a `duration = 0` base gets one cut applied: `weight * (MAX - cut) / MAX`.

Queueing a config with `weight = 1` inherits the decayed weight the auto-cycle would have produced — use it to change other parameters without resetting issuance. `weight = 0` means no issuance (payments mint nothing).

### Weight cache

Decay iteration is capped at 20,000 cycles per call. If more cycles elapsed (e.g. a 1-hour-duration ruleset left alone for years), reads that derive weight revert with `JBRulesets_WeightCacheRequired(projectId)` until the cache is advanced:

```solidity
// Permissionless. Advances at most 20,000 cycles per call — repeat until caught up.
JBRulesets.updateRulesetWeightCache(projectId, rulesetId);
```

The cache (`JBRulesetWeightCache { uint112 weight; uint168 weightCutMultiple; }`) stores a pre-computed weight at a cycle offset, and `deriveWeightFrom` resumes from it. Pass the `rulesetId` that `currentOf()` actually uses (if the latest queued ruleset was rejected by an approval hook, that's the base ruleset, not the rejected one). No-op for rulesets with `duration == 0` or `weightCutPercent == 0`.

## Unlimited rulesets (`duration = 0`)

- Never expires; never auto-cycles; weight never decays while active.
- A queued replacement takes effect as soon as possible (subject to `mustStartAtOrAfter` and the approval hook), not at a cycle boundary.
- `upcomingRulesetOf` returns an empty ruleset when the current ruleset has `duration = 0` and nothing is queued.

## Queueing rulesets

```solidity
// JBController — queue onto an existing project.
function queueRulesetsOf(
    uint256 projectId,
    JBRulesetConfig[] calldata rulesetConfigurations,
    string calldata memo
)
    external
    returns (uint256 rulesetId); // ID of the last ruleset queued
```

Caller must be the project owner or hold permission `QUEUE_RULESETS` (ID `2`). For a project with no rulesets yet, use `launchRulesetsFor(projectId, projectUri, rulesetConfigurations, terminalConfigurations, memo)` — owner or permission `LAUNCH_RULESETS` (ID `3`) plus `SET_TERMINALS` (and `SET_PROJECT_URI` if a URI is passed). `launchProjectFor` creates the project and queues in one payable call (`msg.value` must equal `JBProjects.creationFee()` exactly).

Multiple configs in one call queue sequentially: each is based on the one before it.

### Scheduling semantics

- A ruleset's `id` is `block.timestamp` at queue time (incremented by 1 if that ID is taken).
- `mustStartAtOrAfter = 0` means `block.timestamp`.
- The actual `start` is derived by `deriveStartFrom`: the first multiple of the base ruleset's `duration` after the base's start that is `>= mustStartAtOrAfter`. Cycles stay phase-aligned — you cannot start mid-cycle.
- If the base ruleset has an approval hook, the new ruleset cannot start before `id + approvalHook.DURATION()` — the queue silently pushes `start` out far enough to satisfy the deadline.
- If the base has `duration = 0`, the new ruleset starts at `mustStartAtOrAfter` directly.

## Approval hooks

The hook stored on ruleset N gates ruleset N+1: when a new ruleset is queued, its approval status is asked of `basedOn`'s `approvalHook`. `address(0)` = always approved.

```solidity
interface IJBRulesetApprovalHook is IERC165 {
    function DURATION() external view returns (uint256);
    function approvalStatusOf(uint256 projectId, JBRuleset memory ruleset) external view returns (JBApprovalStatus);
}
```

### JBApprovalStatus enum

| Value | Name | Meaning |
|-------|------|---------|
| 0 | `Empty` | No hook to consult (no base ruleset, or base has no hook) |
| 1 | `Upcoming` | Queued but not yet eligible for approval check |
| 2 | `Active` | Currently governing the project |
| 3 | `ApprovalExpected` | Provisionally approved; becomes `Approved` unless replaced first |
| 4 | `Approved` | Final for its scheduled cycle; later rulesets must derive from it |
| 5 | `Failed` | Rejected; the previous ruleset continues (auto-cycling with weight decay) |

A hook that reverts is treated as `Failed` (wrapped in try/catch, so a broken hook can't freeze the project). `currentOf` treats `Approved` and `Empty` as usable; anything else falls back to the ruleset's base.

### JBDeadline mechanics

`JBDeadline(duration)` requires a ruleset to be queued at least `DURATION` seconds before it starts:

| Condition | Status |
|-----------|--------|
| `ruleset.id > ruleset.start` | `Failed` |
| `ruleset.start - ruleset.id < DURATION` | `Failed` |
| `block.timestamp + DURATION < ruleset.start` | `ApprovalExpected` |
| otherwise | `Approved` |

Since `queueFor` already pushes `start` past `id + DURATION`, rulesets queued through `JBController` against a `JBDeadline`-gated base land in `ApprovalExpected`, then flip to `Approved` as the deadline passes. Use the pre-deployed `JBDeadline3Hours` / `1Day` / `3Days` / `7Days` instances (table above) instead of deploying your own.

If `DURATION` is longer than the cycle `duration` it governs, no queued ruleset can ever satisfy the deadline — the configuration is locked in perpetuity. Choose a deadline shorter than the shortest cycle it will gate.

## Reading rulesets

Prefer `JBController` — it returns the decoded metadata alongside the struct:

| Function | Returns | Notes |
|----------|---------|-------|
| `currentRulesetOf(projectId)` | `(JBRuleset, JBRulesetMetadata)` | Ruleset governing the project now. Simulates auto-cycles (correct `cycleNumber`, decayed `weight`) |
| `upcomingRulesetOf(projectId)` | `(JBRuleset, JBRulesetMetadata)` | Ruleset after the current one ends — explicit queue or simulated auto-cycle. Empty struct if none |
| `latestQueuedRulesetOf(projectId)` | `(JBRuleset, JBRulesetMetadata, JBApprovalStatus)` | Ruleset at the end of the queue, whether approved or not |
| `getRulesetOf(projectId, rulesetId)` | `(JBRuleset, JBRulesetMetadata)` | Specific stored ruleset by ID |

`JBRulesets` equivalents return the raw struct (packed `metadata` field): `currentOf`, `upcomingOf`, `latestQueuedOf` (also returns status), `getRulesetOf`, plus:

| Function | Returns | Notes |
|----------|---------|-------|
| `latestRulesetIdOf(projectId)` | `uint256` | ID of the latest queued ruleset. `0` = project has never queued one |
| `allOf(projectId, startingId, size)` | `JBRuleset[]` | Paginated history, newest first. `startingId = 0` starts from latest |
| `currentApprovalStatusForLatestRulesetOf(projectId)` | `JBApprovalStatus` | Approval status of the latest queued ruleset |
| `deriveWeightFrom(...)` / `deriveCycleNumberFrom(...)` / `deriveStartFrom(...)` | `uint256` | The scheduling math, exposed as public views |

`currentOf` returns an all-zero struct for projects with no rulesets. Across auto-cycles the `id` stays constant while `cycleNumber` advances — payout limits reset per cycle (keyed by `cycleNumber`), but data keyed by `rulesetId` does not.

## Configuration examples

### Unlimited ruleset, 10% reserved, no decay

```solidity
JBRulesetMetadata memory metadata = JBRulesetMetadata({
    reservedPercent: 1000,          // 10% of 10_000
    cashOutTaxRate: 0,              // proportional cash outs
    baseCurrency: uint32(uint160(JBConstants.NATIVE_TOKEN)), // == JBConstants.NATIVE_TOKEN_CURRENCY
    pausePay: false,
    pauseCreditTransfers: false,
    allowOwnerMinting: false,
    allowSetCustomToken: false,
    allowTerminalMigration: false,
    allowSetTerminals: false,
    allowSetController: false,
    allowAddAccountingContext: false,
    allowAddPriceFeed: false,
    ownerMustSendPayouts: false,
    holdFees: false,
    scopeCashOutsToLocalBalances: false,
    useDataHookForPay: false,
    useDataHookForCashOut: false,
    dataHook: address(0),
    metadata: 0
});

JBRulesetConfig[] memory configs = new JBRulesetConfig[](1);
configs[0] = JBRulesetConfig({
    mustStartAtOrAfter: 0,          // start ASAP
    duration: 0,                    // unlimited — replaced only by explicit queue
    weight: 1e18,                   // 1 token per unit of baseCurrency
    weightCutPercent: 0,
    approvalHook: IJBRulesetApprovalHook(address(0)),
    metadata: metadata,
    splitGroups: new JBSplitGroup[](0),
    fundAccessLimitGroups: new JBFundAccessLimitGroup[](0)
});

controller.queueRulesetsOf(projectId, configs, "Initial ruleset");
```

### Weekly cycles, 5% weight cut, 3-day notice on changes

```solidity
configs[0] = JBRulesetConfig({
    mustStartAtOrAfter: 0,
    duration: 7 days,
    weight: 1000e18,                // 1000 tokens per unit paid, cycle 1
    weightCutPercent: 50_000_000,   // 5% of 1_000_000_000, applied per auto-cycle
    approvalHook: IJBRulesetApprovalHook(0xCDA708C98FBdD15a7fF7F0c5c50f9371CA52c78f), // JBDeadline3Days
    metadata: metadata,
    splitGroups: splitGroups,
    fundAccessLimitGroups: fundAccessLimits
});
```

### Keep decayed issuance while changing other parameters

```solidity
configs[0] = JBRulesetConfig({
    mustStartAtOrAfter: 0,
    duration: 7 days,
    weight: 1,                      // sentinel: inherit the decayed weight
    weightCutPercent: 50_000_000,
    approvalHook: IJBRulesetApprovalHook(0xCDA708C98FBdD15a7fF7F0c5c50f9371CA52c78f),
    metadata: newMetadata,          // the actual change
    splitGroups: splitGroups,
    fundAccessLimitGroups: fundAccessLimits
});
```

### Split group IDs (for `splitGroups`)

| Group | `groupId` |
|-------|-----------|
| Reserved tokens | `1` (`JBSplitGroupIds.RESERVED_TOKENS`) |
| Payouts of a token | `uint256(uint160(tokenAddress))` |

## Common mistakes

- **Wrong percentage scale.** `reservedPercent` and `cashOutTaxRate` are `uint16` out of `10_000`; `weightCutPercent` and split `percent` are `uint32` out of `1_000_000_000`. Passing `500_000_000` where a `uint16` field is expected fails ABI encoding; passing `500` as a weight cut is 0.00005%, not 5%.
- **`weight = 1` is a sentinel**, not "1 wei of issuance" — it inherits the decayed weight from the previous ruleset. Use `0` for no issuance.
- **Expecting `rulesetId` to change each cycle.** Auto-cycles keep the same `id`; only `cycleNumber` and `start` advance. Payout limits reset per cycle, not per ruleset ID.
- **Thinking a ruleset's `approvalHook` gates itself.** It gates the *next* queued ruleset. The first ruleset a project ever queues is never subject to an approval hook.
- **`JBDeadline` `DURATION` longer than the cycle `duration`.** No queued change can ever be approved; the configuration is locked forever. Pick a deadline shorter than the shortest cycle.
- **Passing a non-contract or non-ERC165 address as `approvalHook`.** `queueFor` reverts with `JBRulesets_InvalidRulesetApprovalHook` — it requires deployed code that reports `IJBRulesetApprovalHook` support.
- **Expecting a queued ruleset to start exactly at `mustStartAtOrAfter`.** Starts snap to the base ruleset's cycle boundaries and are pushed past the approval hook's `DURATION`.
- **Wrong `groupId` for payout splits.** Payout groups are keyed by `uint256(uint160(tokenAddress))`; `1` is the reserved-token group.
- **`baseCurrency` mismatch with price feeds.** If payments arrive in a currency other than `baseCurrency`, issuance math needs a `JBPrices` feed for that pair. Use `uint32(uint160(token))` (accounting-context convention) or `JBCurrencyIds.ETH = 1` / `USD = 2`, matching the feeds the project registered.
- **Stale short-duration rulesets reverting reads.** A ruleset with a short `duration` and non-zero `weightCutPercent` left alone for >20,000 cycles makes weight-deriving reads revert with `JBRulesets_WeightCacheRequired` — call the permissionless `updateRulesetWeightCache(projectId, rulesetId)` (repeatedly, 20,000 cycles per call) to recover.
- **Using all 16 bits of the custom `metadata` field.** Only the low 14 bits are stored; the top 2 are masked off by `packRulesetMetadata`.
