---
name: jb-revnet-deploy
description: |
  Deploy and operate a revnet with `REVDeployer` and `REVOwner`. Use when: (1) encoding a
  `REVDeployer.deployFor` call (structs, salts, timestamps, creation fee), (2) deploying the
  same revnet on several chains with matching addresses and config hashes, (3) acting as a
  revnet operator (`setOperatorOf`, `deploySuckersFor`, `autoIssueFor`, split changes),
  (4) answering what can and cannot change after launch, (5) debugging a `REVDeployer_*` or
  `REVOwner_*` revert. Economics live in `revnet-economics`, `revnet-modeler`, `jb-revloans`;
  chain coverage policy lives in `revnet-omnichain-default`.
version: 6.0.0
---

# Revnet deployment and operation

A revnet is a Juicebox V6 project whose `JBProjects` NFT is held by `REVOwner` forever. `REVDeployer.deployFor` creates the project, queues every stage as a ruleset in one `launchRulesetsFor`, deploys the ERC-20, seeds Uniswap V4 buyback pools, deploys suckers, deploys a tiered-721 hook, then hands the NFT to `REVOwner`. No one holds an owner key afterwards; the only human role is the **operator**, a `JBPermissions` grant scoped to `(REVOwner, revnetId)`.

| Contract | Address (all 8 chains) | Role |
|---|---|---|
| `REVDeployer` | `references/shared/chain-config.json` → `REVDeployer` | `deployFor`, `deploySuckersFor`, `hashedEncodedConfigurationOf` |
| `REVOwner` | `references/shared/chain-config.json` → `REVOwner` | project owner, pay/cash-out data hook, operator registry, auto-issuance |
| `REVLoans` | `references/shared/chain-config.json` → `REVLoans` | loans (see `jb-revloans`) |

Constants: `CASH_OUT_DELAY = 604_800` (7 days), `DEFAULT_BUYBACK_POOL_FEE = 10_000` (1%), `DEFAULT_BUYBACK_TICK_SPACING = 200`, `DEFAULT_BUYBACK_TWAP_WINDOW = 2 days`.

## `deployFor` overloads

```solidity
// 6-arg: use this one.
function deployFor(uint256 revnetId, REVConfig configuration, JBAccountingContext[] accountingContextsToAccept,
    REVSuckerDeploymentConfig suckerDeploymentConfiguration, REVDeploy721TiersHookConfig tiered721HookConfiguration,
    REVCroptopAllowedPost[] allowedPosts) external payable returns (uint256 revnetId, IJB721TiersHook hook);
// 4-arg: convenience overload with a hard-coded 721 store.
function deployFor(uint256 revnetId, REVConfig configuration, JBAccountingContext[] accountingContextsToAccept,
    REVSuckerDeploymentConfig suckerDeploymentConfiguration) external payable returns (uint256 revnetId, IJB721TiersHook hook);
```

| Argument | Rule |
|---|---|
| `revnetId` | `0` creates a new project: `msg.value` must equal `JBProjects.creationFee()`. Non-zero converts an existing **blank** project (no controller, no rulesets); caller must be `JBProjects.ownerOf(revnetId)`, `msg.value` must be `0` (`REVDeployer_ProjectCreationFeeNotNeeded`), and the NFT is transferred to `REVOwner` irreversibly. |
| `accountingContextsToAccept` | Terminal tokens for `JBMultiTerminal`. `currency` is token-keyed: `uint32(uint160(token))` (native `0x…EEEe` → `61166`). Also becomes the loan source token set. |
| `suckerDeploymentConfiguration` | `salt == bytes32(0)` skips sucker deployment entirely. |
| `tiered721HookConfiguration` | Always deployed; ownership is transferred to `REVOwner`. `issueTokensForSplits` is forced `false`. |
| `allowedPosts` | Non-empty grants `CTPublisher` `ADJUST_721_TIERS` on the revnet and configures Croptop posting criteria. |

Why the 4-arg overload is a footgun: it builds the store as `tiersConfig.currency = baseCurrency, tiersConfig.decimals = 18` and grants the operator all four 721 permissions unconditionally. A USD-based revnet (`baseCurrency = 2`) then prices every store tier with 18 decimals when USD amounts in Juicebox carry 6, so a `$10` tier encodes as `1e19` and is mispriced by twelve orders of magnitude. The empty-store 6-arg call is the same thing with the decimals set right: pass `tiersConfig: {tiers: [], currency: baseCurrency, decimals: <decimals of the pricing currency>}` and the `preventOperator*` flags you mean. Viem cannot disambiguate the two overloads when arrays are empty; filter the ABI to the 6-input `deployFor` before `encodeFunctionData`/`simulateContract`.

## Structs (ABI order)

| `REVConfig` | Type | Notes |
|---|---|---|
| `description` | `REVDescription` | `{string name; string ticker; string uri; bytes32 salt}` — `uri` is the project metadata URI |
| `baseCurrency` | `uint32` | `JBCurrencyIds`: ETH `1`, USD `2`. Never the token-keyed context currency. Issuance is priced in this |
| `operator` | `address` | initial operator; `address(0)` launches with no operator, permanently |
| `scopeCashOutsToLocalBalances` | `bool` | `false` = cash-outs price against cross-chain surplus + supply |
| `stageConfigurations` | `REVStageConfig[]` | ≥ 1 (`REVDeployer_StagesRequired`) |

| `REVStageConfig` | Type | Becomes / rule |
|---|---|---|
| `startsAtOrAfter` | `uint48` | `mustStartAtOrAfter`. Stage 0 may be `0` (→ `block.timestamp`); every stage must be strictly later than the previous effective start (`REVDeployer_StageTimesMustIncrease`) |
| `autoIssuances` | `REVAutoIssuance[]` | `{uint32 chainId; uint104 count; address beneficiary}`; zero beneficiary reverts |
| `splitPercent` | `uint16` | `reservedPercent`, out of `10_000`; `> 0` requires non-empty `splits` (`REVDeployer_MustHaveSplits`) |
| `splits` | `JBSplit[]` | `{uint32 percent; uint64 projectId; address payable beneficiary; bool preferAddToBalance; uint48 lockedUntil; IJBSplitHook hook}`, `percent` out of `1_000_000_000`; reserved-token group only. Not in the config hash |
| `initialIssuance` | `uint112` | ruleset `weight`, tokens per base-currency unit, 18 decimals. `1` = inherit the previous stage's decayed weight; `0` = no issuance |
| `issuanceCutFrequency` | `uint32` | ruleset `duration` (seconds); `0` = the stage never cycles, so no cuts |
| `issuanceCutPercent` | `uint32` | `weightCutPercent`, out of `1_000_000_000` |
| `cashOutTaxRate` | `uint16` | out of `10_000`; must be `< 10_000` (`REVDeployer_CashOutsCantBeTurnedOffCompletely`). Max usable value is `9_999` |
| `extraMetadata` | `uint16` | ruleset `metadata.metadata` verbatim (14 usable bits) |

Fixed per stage by the deployer: `approvalHook = 0`, `allowOwnerMinting = true`, `useDataHookForPay/CashOut = true`, `dataHook = REVOwner`, one `RESERVED_TOKENS` split group, loan fund-access limits for every accepted token.

| `extraMetadata` bit | Effect |
|---|---|
| 0 | tiered-721 hook `pauseTransfers` |
| 1 | tiered-721 hook `pauseMintPendingReserves` |
| 2 | allow `REVDeployer.deploySuckersFor` while this stage is current. Set `4` on every stage unless you intend a revnet that can never reach a new chain |

`REVSuckerDeploymentConfig {JBSuckerDeployerConfig[] deployerConfigurations; bytes32 salt}` with `JBSuckerDeployerConfig {IJBSuckerDeployer deployer; bytes32 peer; JBTokenMapping[] mappings}` and `JBTokenMapping {address localToken; uint32 minGas; bytes32 remoteToken}`. `peer = bytes32(0)` means the same-address deterministic peer; canonical deployments use `minGas: 200_000`.

`REVDeploy721TiersHookConfig {REVBaseline721HookConfig baseline721HookConfiguration; bytes32 salt; bool preventOperatorAdjustingTiers; bool preventOperatorUpdatingMetadata; bool preventOperatorMinting; bool preventOperatorIncreasingDiscountPercent}`; `REVBaseline721HookConfig {string name; string symbol; string baseUri; IJB721TokenUriResolver tokenUriResolver; string contractUri; JB721InitTiersConfig tiersConfig; REV721TiersHookFlags flags}`; `REV721TiersHookFlags {bool noNewTiersWithReserves; bool noNewTiersWithVotes; bool noNewTiersWithOwnerMinting; bool preventOverspending}`. Each `prevent*` flag left `false` adds the matching permission (`ADJUST_721_TIERS`, `SET_721_METADATA`, `MINT_721`, `SET_721_DISCOUNT_PERCENT`) to the operator set.

`REVCroptopAllowedPost {uint24 category; uint104 minimumPrice; uint32 minimumTotalSupply; uint32 maximumTotalSupply; uint32 maximumSplitPercent; address[] allowedAddresses}`.

## Config hash and cross-chain determinism

`hashedEncodedConfigurationOf[revnetId] = keccak256(abi.encode(baseCurrency, scopeCashOutsToLocalBalances, name, ticker, description.salt) ‖ per stage (effectiveStart, splitPercent, initialIssuance, issuanceCutFrequency, issuanceCutPercent, cashOutTaxRate, extraMetadata) ‖ per non-zero auto-issuance (chainId, beneficiary, count))`. Splits, `uri`, `operator`, accounting contexts, and the 721 config are **not** in it.

Every deterministic address folds `(salt, configHash, msg.sender)`:

| Artifact | CREATE2 salt |
|---|---|
| ERC-20 | `keccak256(abi.encode(description.salt, configHash, sender))` |
| 721 hook | `keccak256(abi.encode(tiered721HookConfiguration.salt, configHash, sender))` (4-arg overload: `bytes32(0)`) |
| Suckers | `keccak256(abi.encode(configHash, suckerConfig.salt, sender))`, re-hashed by `JBSuckerRegistry` with `REVDeployer` as caller |

Rules for a same-address multi-chain deploy: identical `REVConfig` bytes, identical salts, identical sender on every chain (an EOA, or a Safe replayed to the same address), and an explicit stage-0 `startsAtOrAfter`. If chain A used `0`, chain B must pass A's `block.timestamp` — pick one `deployStart` up front (production clients use `now + 600`, or a scheduled time) and use it everywhere. Include the **full** `autoIssuances` list with every chain's rows on every chain: the hash covers all rows; `REVOwner` records only rows whose `chainId == block.chainid`.

Deploying onto a chain after stage 0 has already started (`startsAtOrAfter < block.timestamp`) sets `cashOutDelayOf[revnetId] = block.timestamp + CASH_OUT_DELAY`. Ordinary cash-outs revert `REVOwner_CashOutDelayNotFinished` until then; sucker cash-outs (bridge-in) skip the delay so the new treasury can be primed. Cash-outs are otherwise open from launch.

## Feed reachability

`JBTerminalStore` converts every accepting context's `currency` into `baseCurrency` at pay time, and converts between contexts during cash-outs and surplus reads, via `JBPrices.pricePerUnitOf`. Revnets can never register project-level feeds, so a combination with no protocol default feed is bricked at runtime, not at deploy. Before launch, probe `JBPrices.pricePerUnitOf(projectId = 0, pricingCurrency, unitCurrency, decimals)` for each pair `(context.currency, baseCurrency)` and each pair of contexts; a revert means the feed is missing — do not launch. Supported today: ETH-only with base `1`; ETH-only, USDC-only, or ETH+USDC with base `2`. `baseCurrency = 2` is the only base that works for a mixed ETH+USDC treasury. `deployFor` itself does not exercise the feed except to seed buyback pools, and it swallows that failure, so a passing deploy simulation proves nothing about pricing.

Store decimals follow the **pricing currency**, not the treasury token: base `1` → `18`; base `2` → `6`; a custom ERC-20 base → that token's decimals.

## Example: 2-stage ETH revnet on Ethereum + Base

Same calldata on both chains except `deployerConfigurations[0].deployer`; here the Base lane deployer (`JBBaseSuckerDeployer`) is the same address on both sides. Sign with the same account on both chains.

```ts
import { encodeFunctionData, parseEther, parseUnits } from "viem";
const cfg = JSON.parse(fs.readFileSync("references/shared/chain-config.json"));
const NATIVE = "0x000000000000000000000000000000000000EEEe";
const ENCODED = encodeFunctionData({
  abi: revDeployerAbi.filter((f) => !(f.type === "function" && f.name === "deployFor" && f.inputs.length !== 6)),
  functionName: "deployFor",
  args: [
    0n,
    {
      description: { name: "Fruitful", ticker: "FRUIT", uri: "ipfs://bafy…metadata", salt: SALT },
      baseCurrency: 1,
      operator: OPERATOR,
      scopeCashOutsToLocalBalances: false,
      stageConfigurations: [
        {
          startsAtOrAfter: DEPLOY_START,                         // one unix ts, reused on every chain
          autoIssuances: [
            { chainId: 1,    count: parseUnits("1000000", 18), beneficiary: TEAM },
            { chainId: 8453, count: parseUnits("250000", 18),  beneficiary: TEAM },
          ],
          splitPercent: 3800,                                     // 38% of issuance to splits
          splits: [{ percent: 1_000_000_000, projectId: 0n, beneficiary: OPERATOR,
                     preferAddToBalance: false, lockedUntil: 0, hook: "0x0000000000000000000000000000000000000000" }],
          initialIssuance: parseEther("10000"),                   // 10 000 FRUIT per ETH
          issuanceCutFrequency: 90 * 86400,
          issuanceCutPercent: 380_000_000,                        // 38% cut every 90 days
          cashOutTaxRate: 1000,                                   // 10%
          extraMetadata: 4,                                       // bit 2: allow deploySuckersFor
        },
        {
          startsAtOrAfter: DEPLOY_START + 720 * 86400,
          autoIssuances: [],
          splitPercent: 3800,
          splits: [{ percent: 1_000_000_000, projectId: 0n, beneficiary: OPERATOR,
                     preferAddToBalance: false, lockedUntil: 0, hook: "0x0000000000000000000000000000000000000000" }],
          initialIssuance: 1n,                                    // inherit stage 1's decayed weight
          issuanceCutFrequency: 30 * 86400,
          issuanceCutPercent: 70_000_000,                         // 7% every 30 days
          cashOutTaxRate: 1000,
          extraMetadata: 4,
        },
      ],
    },
    [{ token: NATIVE, decimals: 18, currency: 61166 }],
    {
      deployerConfigurations: [{
        deployer: cfg.chains[String(chainId)].contracts.JBBaseSuckerDeployer,
        peer: "0x" + "00".repeat(32),
        mappings: [{ localToken: NATIVE, minGas: 200_000, remoteToken: "0x" + "00".repeat(12) + NATIVE.slice(2) }],
      }],
      salt: SALT,
    },
    {
      baseline721HookConfiguration: {
        name: "Fruitful Store", symbol: "FRUITSTORE", baseUri: "ipfs://",
        tokenUriResolver: "0x0000000000000000000000000000000000000000", contractUri: "ipfs://bafy…metadata",
        tiersConfig: { tiers: [], currency: 1, decimals: 18 },
        flags: { noNewTiersWithReserves: false, noNewTiersWithVotes: false, noNewTiersWithOwnerMinting: false, preventOverspending: false },
      },
      salt: SALT,
      preventOperatorAdjustingTiers: false, preventOperatorUpdatingMetadata: false,
      preventOperatorMinting: true, preventOperatorIncreasingDiscountPercent: false,
    },
    [],
  ],
});
// value: await publicClient.readContract({ address: JBProjects, abi, functionName: "creationFee" })
```

Send to `REVDeployer` on chain 1 and chain 8453 with `value = JBProjects.creationFee()`. `simulateContract` first and read the returned `(revnetId, hook)`. Project ids are per-chain counters and may differ between chains; track `revnetId` per chain. Verify after each receipt: `hashedEncodedConfigurationOf(revnetId)` equal on both chains, `JBTokens.tokenOf(revnetId)` equal, and `JBSuckerRegistry.suckersOf(revnetId)` non-empty on both.

## `REVOwner` operator surface

| Function | Caller | Effect |
|---|---|---|
| `setOperatorOf(revnetId, newOperator)` | current operator | revokes all of the caller's permissions on `(REVOwner, revnetId)`, grants the full set to `newOperator`. `address(0)` relinquishes forever |
| `isOperatorOf(revnetId, addr)` | view | `JBPermissions.hasPermissions` for the full default + extra set (no root, no wildcard) |
| `autoIssueFor(revnetId, stageId, beneficiary)` | anyone | mints `amountToAutoIssue[revnetId][stageId][beneficiary]` once `ruleset.start <= now`, then zeroes it. `stageId` = ruleset id = deploy-tx `block.timestamp + stageIndex`; read it from the `StoreAutoIssuanceAmount` event or `JBController.allRulesetsOf` |
| `amountToAutoIssue(revnetId, stageId, beneficiary)` | view | unclaimed count (`REVOwner_NothingToAutoIssue` when 0) |
| `burnHeldTokensOf(revnetId)` | anyone | burns tokens that landed on `REVOwner` because reserved splits summed to less than 100% |
| `cashOutDelayOf(revnetId)` | view | delay-end timestamp; `0` when none |
| `tiered721HookOf(revnetId)` | view | the store hook |
| `hashedEncodedConfigurationOf(revnetId)` (`REVDeployer`) | view | config hash; the value that must match across chains |
| `deploySuckersFor(revnetId, suckerConfig)` (`REVDeployer`) | operator | reverts `REVDeployer_RulesetDoesNotAllowDeployingSuckers` unless the current ruleset's metadata has bit 2 set. Salt uses the **operator** as sender, so the operator must call from the same address on both ends of every new lane; new suckers do not need to match the original set |

Operator permissions granted on account `REVOwner`, project `revnetId` (`JBPermissionIds`):

| ID | Permission | Lets the operator |
|---|---|---|
| 19 | `SET_SPLIT_GROUPS` | rewrite the reserved-token split recipients for the current stage (`JBController.setSplitGroupsOf`); `splitPercent` stays fixed |
| 29 / 28 / 30 | `SET_BUYBACK_POOL` / `SET_BUYBACK_TWAP` / `SET_BUYBACK_HOOK` | register or re-seed buyback pools, tune TWAP, swap the buyback hook |
| 7 | `SET_PROJECT_URI` | change project metadata |
| 35 | `SUCKER_SAFETY` | sucker emergency controls |
| 31 | `SET_ROUTER_TERMINAL` | router-terminal settings |
| 22 / 23 | `SET_TOKEN_METADATA` / `SIGN_FOR_ERC20` | ERC-20 name/symbol metadata, ERC-20 signatures |
| 24 / 25 / 26 / 27 | `ADJUST_721_TIERS` / `SET_721_METADATA` / `MINT_721` / `SET_721_DISCOUNT_PERCENT` | store management; each only if its `preventOperator*` flag was `false` at deploy |

`REVOwner` also holds, for project id 0 (wildcard): `USE_ALLOWANCE` (18) for `REVLoans`, `SET_BUYBACK_POOL` (29) for the buyback hook, `DEPLOY_SUCKERS` (33) + `MAP_SUCKER_TOKEN` (32) for `REVDeployer`.

## What changes after launch

| Mutable | Immutable |
|---|---|
| operator (rotate or relinquish), split recipients and weights, project URI, buyback pool/TWAP/hook, sucker set (new lanes only, bit-2 gated), store tiers/metadata/discounts per flags | every stage field (`startsAtOrAfter`, `splitPercent`, `initialIssuance`, cut frequency/percent, `cashOutTaxRate`, `extraMetadata`), `baseCurrency`, `scopeCashOutsToLocalBalances`, name/ticker, accepted terminal tokens, auto-issuance rows, `preventOperator*` flags |

No new stage can ever be queued: `QUEUE_RULESETS` is not in the operator set, `REVOwner` exposes no `queueRulesetsOf`, and `REVDeployer` only calls `launchRulesetsFor` once. The last stage cycles on `issuanceCutFrequency` forever (or, with `0`, stays fixed). Model every future stage before deploying (`revnet-modeler`).

## Common mistakes

- Using the 4-arg `deployFor` with `baseCurrency = 2`: store prices are encoded at 18 decimals against a 6-decimal currency. Use the 6-arg overload with `tiersConfig.decimals` matching the pricing currency.
- `extraMetadata = 0`: `deploySuckersFor` reverts forever on that stage; every revnet without bit 2 is permanently single-set. Set `4` (or OR `1 << 2`) on every stage.
- Passing the token-keyed context currency (`61166`) as `baseCurrency`, or `1`/`2` as an accounting-context `currency`. Base is `JBCurrencyIds` (1/2); context currency is `uint32(uint160(token))`.
- `cashOutTaxRate = 10_000` reverts; the cap is `9_999`.
- Stage-0 `startsAtOrAfter = 0` on chain A and `0` again on chain B: the effective start differs, the hash differs, the ERC-20 and suckers land at different addresses. Bake one explicit timestamp into every chain's calldata.
- Dropping another chain's `autoIssuances` rows from a chain's calldata "because they don't mint here": they are hashed on every chain.
- Different senders per chain (EOA on one, Safe on another): every salt folds `msg.sender`.
- `splitPercent > 0` with empty `splits` reverts; splits summing below `1_000_000_000` leave residue on `REVOwner` that anyone can burn with `burnHeldTokensOf`.
- Setting `operator = address(0)` or calling `setOperatorOf(id, address(0))`: there is no recovery path; splits, buyback, sucker expansion, and the store are frozen.
- ETH+USDC treasury with `baseCurrency = 1`: no USDC→ETH default feed; USDC pays and mixed cash-outs revert on-chain. Use base `2`, and probe `JBPrices` with project id `0` before launch.
- Treating a passing deploy simulation as proof the feed exists: pool seeding failures are swallowed; pricing runs at pay time.
- Expecting cash-outs on a late-added chain immediately: `cashOutDelayOf` gates them for 7 days; bridge tokens in via suckers first.
- Sending `msg.value` with a non-zero `revnetId`: `REVDeployer_ProjectCreationFeeNotNeeded`.
