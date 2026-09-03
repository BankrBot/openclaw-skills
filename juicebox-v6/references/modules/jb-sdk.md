---
name: jb-sdk
description: |
  `@bananapus/nana-sdk-core` — the TypeScript SDK juicebox.money and revnet.money use to build
  Juicebox V6 calldata, quotes, and reads. Use when: (1) writing a TypeScript/viem client that pays,
  cashes out, launches, queues rulesets, mints 721 tiers, bridges via suckers, or deploys a revnet,
  (2) you need a verified ABI or contract address without hand-typing one, (3) you need a pay or
  cash-out preview with the correct fee/hook/route handling, (4) deciding whether to call the SDK
  or fall back to a hand-rolled ABI from the `*-ui` skills.
version: 6.0.0
---

# `@bananapus/nana-sdk-core`

Source: `https://github.com/Bananapus/juice-sdk-v4` (`packages/core`). ESM + CJS, `sideEffects: false`. Peer: `viem ^2.12.0`. Every builder returns a plain `{ chainId, address, abi, functionName, args[, value] }` object that feeds `publicClient.simulateContract` and `walletClient.writeContract` unchanged.

```bash
npm i @bananapus/nana-sdk-core@2.3.2 viem@2.55.19
```

juicebox.money and revnet.money declare `"^2.3.2"` and lock `2.3.2`; juicebox.money pins `viem` `2.55.19`, revnet.money `2.55.8`. juicescan does not depend on the package; it references it in generated build prompts only.

## Entry points

| Import path | Contents |
|-------------|----------|
| `@bananapus/nana-sdk-core` | `jbContractAddress`, all `*Abi` exports, `JBCoreContracts` enums, `JB_CHAINS`, `NATIVE_TOKEN`, `USDC_ADDRESSES`, `SPLITS_TOTAL_PERCENT`, `parseSuckerDeployerConfig`, `createSalt`, IPFS/format helpers, `JBProjectMetadata`, bendystraw request helpers |
| `@bananapus/nana-sdk-core/v6` | Every V6 builder and read below (re-exports `direct-pay`, `permit2`, `cash-out`, `loans`, `uniswap-v4`) |
| `@bananapus/nana-sdk-core/v6/cash-out`, `/v6/direct-pay`, `/v6/loans`, `/v6/loan-math`, `/v6/permit2`, `/v6/uniswap-v4`, `/v6/uniswap-v4-deployments` | Tree-shaken subsets of `/v6` |
| `@bananapus/nana-sdk-core/chains` | viem chain objects for the 8 supported chains |
| `@bananapus/nana-sdk-core/jbcenter` | `createJBCenterClient`, `JBCenterRequestError`, `JBCenterTimeoutError` (IPFS pinning + read-only RPC via `https://juicebox.center`) |

Supported `JBChainId`: `1 | 10 | 8453 | 42161 | 11155111 | 11155420 | 84532 | 421614`.

## Addresses and ABIs

```typescript
import { jbContractAddress, JBCoreContracts, jbControllerAbi, type JBChainId } from '@bananapus/nana-sdk-core'
import { v6Address } from '@bananapus/nana-sdk-core/v6'

const controller = jbContractAddress['6'][JBCoreContracts.JBController][chainId]  // typed, per chain
const splits = v6Address('JBSplits', chainId)                                      // same table, string key
```

`jbContractAddress['6']` holds 33 contracts: the 15 `JBCoreContracts` + `ERC2771Forwarder`, `JB721TiersHook{,Deployer,ProjectDeployer,Store}`, `JBAddressRegistry`, `JBSuckerRegistry`, `JBBuybackHook{,Registry}`, `JBRouterTerminal{,Registry}`, `JBUniswapV4LPSplitHook{,Deployer}`, `JBP6FeeLPSplitHook`, `JBOmnichainDeployer`, `REVDeployer`, `REVLoans`, `REVOwner`. Every one matches `references/shared/chain-config.json` byte-for-byte on all 8 chains. `references/shared/chain-config.json` additionally carries what the SDK table omits: native sucker deployers, per-chain CCIP suckers/deployers, price feeds, `JBUniswapV4Hook`, `JBProjectPayerDeployer` (SDK exposes it as `JB_PROJECT_PAYER_DEPLOYER`), Permit2, USDC, Defifa/Croptop/Banny, and project-instance contracts. For those, read `references/shared/chain-config.json`; the SDK exposes sucker deployers separately via `NATIVE_SUCKER_DEPLOYER_ADDRESSES` and `CCIP_SUCKER_DEPLOYER_ADDRESSES` (used by `parseSuckerDeployerConfig`).

V6 ABIs are the unsuffixed exports: `jbControllerAbi`, `jbDirectoryAbi`, `jbMultiTerminalAbi`, `jbRulesetsAbi`, `jbSplitsAbi`, `jbTokensAbi`, `jbProjectsAbi`, `jbPermissionsAbi`, `jbPricesAbi`, `jbTerminalStoreAbi`, `jbFundAccessLimitsAbi`, `jb721TiersHookAbi`, `jb721TiersHookStoreAbi`, `jbBuybackHookAbi`, `jbBuybackHookRegistryAbi`, `jbRouterTerminalAbi`, `jbRouterTerminalRegistryAbi`, `jbSuckerRegistryAbi`, `jbOmnichainDeployerAbi`, `revDeployerAbi`, `revLoansAbi`, `revOwnerAbi`, `erc2771ForwarderAbi`. `jbSuckerV6Abi` lives in `/v6`. Ignore any `*V4Abi` / `*V5Abi` / `4_1` / `1_1` export.

## viem wiring

```typescript
import { createPublicClient, createWalletClient, custom, http } from 'viem'
import { base } from '@bananapus/nana-sdk-core/chains'
import { buildPayTx, previewPay, resolvePaymentTerminal, getAccountingContexts } from '@bananapus/nana-sdk-core/v6'

const chainId = 8453 as const
const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl) })
const walletClient = createWalletClient({ chain: base, transport: custom(window.ethereum) })

async function send(request: { address: `0x${string}`; abi: any; functionName: string; args: readonly unknown[]; value?: bigint }, prove: (receipt: any) => Promise<boolean>) {
  if (typeof prove !== 'function') throw new Error('operation-specific event/post-state proof is required')
  const { request: sim } = await publicClient.simulateContract({ ...request, account })
  const hash = await walletClient.writeContract(sim)
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') throw new Error('reverted')
  if (!(await prove(receipt))) throw new Error(`mined but completion proof failed: ${hash}; do not retry`)
  return receipt
}
```

## Pay

| Export | Signature |
|--------|-----------|
| `getAccountingContexts` | `(client, { chainId, projectId }) => Promise<readonly JBAccountingContext[]>` — `{ token, decimals, currency }` from `JBMultiTerminal` |
| `resolvePaymentTerminal` | `(client, { chainId, projectId, token }) => Promise<{ address, isRouter }>` — `primaryTerminalOf`, else the registry with `isRouter: true` |
| `previewPay` | `(client, { chainId, terminal, projectId, token, amount, beneficiary, metadata? }) => Promise<{ beneficiaryTokenCount, reservedTokenCount }>` |
| `buildPayTx` | `({ chainId, terminal, projectId, token, amount, beneficiary, minReturnedTokens?, memo?, metadata? }) => V6PayTxRequest` — `value = amount` when `token === NATIVE_TOKEN` |
| `build721PayMetadata` | `({ metadataIdTarget, tierIdsToMint, allowOverspending? }) => Hex` |
| `chooseBestPayRoute` | `({ pay, paySettlement, directSwapQuote?, slippageBps? }) => BestPayRoute` |
| `buildPermit2ApproveTx` | `({ chainId, token, amount?, expiration }) => Permit2ApproveTxRequest` |
| `quoteDirectPaySwap` / `buildDirectPaySwapTx` | `/v6/direct-pay` — Uniswap V4 pool purchase that bypasses the terminal |

juicebox.money `PayPanel` and revnet.money `V6PayCard`:

```typescript
const contexts = await getAccountingContexts(publicClient, { chainId, projectId })
const terminal = await resolvePaymentTerminal(publicClient, { chainId, projectId, token: NATIVE_TOKEN })
const metadata = shop && tierIds.length > 0
  ? build721PayMetadata({ metadataIdTarget: shop.metadataIdTarget, tierIdsToMint: tierIds })
  : undefined
const preview = await previewPay(publicClient, { chainId, terminal: terminal.address, projectId, token: NATIVE_TOKEN, amount, beneficiary, metadata })
if (preview.beneficiaryTokenCount <= 0n) throw new Error('payment preview returned zero; refusing a floorless payment')
const computedFloor = preview.beneficiaryTokenCount * 99n / 100n
const minReturnedTokens = computedFloor > 0n ? computedFloor : 1n
const request = buildPayTx({
  chainId, terminal: terminal.address, projectId, token: NATIVE_TOKEN, amount, beneficiary,
  minReturnedTokens,
  metadata,
})
```

`isRouter: true` means the registry is where the payment goes, not that the token is payable — a cold-start project reverts `JBRouterTerminalRegistry_TerminalNotSet`. Both clients probe `jbRouterTerminalRegistryAbi.previewPayFor` and treat a revert or `ruleset.id == 0` as a dead route (see `jb-terminal-selection`).

## Cash out

| Export | Signature |
|--------|-----------|
| `getHookAwareCashOutQuote` | `(client, { chainId, projectId, holder, cashOutCount, tokenToReclaim, beneficiary?, terminal?, buybackHookAddress?, beneficiaryIsFeeless?, slippageBps? }) => Promise<CashOutRoute>` |
| `prepareHookAwareCashOut` | same args `=> Promise<{ route, transaction: V6CashOutTxRequest, preview, lockedPreview }>` — re-quotes from fresh state and builds the matching request |
| `chooseBestCashOutRoute` | `({ cashOut, directSwapQuote?, directSwapPoolKey?, directSwapZeroForOne?, spendableProjectTokenCount?, cashOutCount, slippageBps? }) => BestCashOutRoute` |
| `getBestCashOutRoute` / `prepareBestCashOut` | hook-aware route plus optional `directSwap` comparator; `prepareBestCashOut` needs `directSwapDeadline` |
| `buildCashOutTx` | `({ chainId, terminal, holder, projectId, cashOutCount, tokenToReclaim, minTokensReclaimed?, beneficiary, metadata? }) => V6CashOutTxRequest` |
| `build721CashOutMetadata` | `({ metadataIdTarget, tokenIds }) => Hex` |
| `cashOutProtocolFee` | `({ reclaimAmount, cashOutTaxRate, beneficiaryIsFeeless?, feeFreeSurplus? }) => bigint` — `x / 40`, gated as the terminal gates it |
| `slippageFloor` | `(quoted, slippageBps = 100n) => bigint` |
| `classifyCashOutExecutionError` | `(error) => { code: "BUYBACK_SLIPPAGE_EXCEEDED" \| "TERMINAL_UNDER_MIN", selector } \| null` |

`CashOutRoute.route` is `"treasury"` or `"amm"`. On `"amm"` the terminal reclaims nothing, so `terminalMinimum` is `0n` and the floor lives in `metadata` (the buyback hook's cash-out entry). Always pass `route.terminalMinimum` and `route.metadata` together.

juicebox.money `CashOutFlow`:

```typescript
const prepared = await prepareHookAwareCashOut(publicClient, {
  chainId, projectId, holder: address, cashOutCount, tokenToReclaim: context.token,
  terminal: terminal.address, beneficiary: address, slippageBps: 100n,
})
if (prepared.route.expectedReturn <= 0n) throw new Error('quote unavailable')
await send(prepared.transaction)
```

## Launch, rulesets, splits

| Export | Signature |
|--------|-----------|
| `getProjectCreationFee` | `(client, chainId) => Promise<bigint>` — pass as `creationFee` / tx `value` |
| `buildAccountingContext` | `(token = NATIVE_TOKEN, decimals?, currency = tokenCurrencyId(token)) => JBAccountingContext` — always pass `decimals` |
| `buildTerminalConfigurations` | `({ chainId, accountingContexts? }) => JBTerminalConfig[]` — targets `JBMultiTerminal` |
| `buildRulesetMetadata` | `(overrides?: Partial<JBRulesetMetadata>) => JBRulesetMetadata` |
| `buildRulesetConfiguration` | `({ mustStartAtOrAfter?, duration?, weight?, weightCutPercent?, approvalHook?, metadata?, splitGroups?, fundAccessLimitGroups? }) => JBRulesetConfig` |
| `buildLaunchProjectTx` | `({ chainId, owner, projectUri, rulesetConfigurations, terminalConfigurations, memo?, creationFee })` → `JBController.launchProjectFor` |
| `buildOmnichainLaunchProjectTx` | `({ chainId, chainIds, owner, projectUri, rulesetConfigurations, terminalConfigurations, memo?, creationFee, salt, assets?, bridge?, deploy721Config? })` → `JBOmnichainDeployer` |
| `projectIdFromLaunchLogs` | `(logs, { chainId }) => bigint \| null` |
| `buildQueueRulesetsTx` | `({ chainId, projectId, rulesetConfigurations, memo? })` → `JBController.queueRulesetsOf` |
| `buildOmnichainQueueRulesetsTx` | `({ chainId, projectId, rulesetConfigurations, memo?, deploy721Config? })` |
| `getCurrentRuleset` / `getUpcomingRuleset` | `(client, { chainId, projectId }) => Promise<{ ruleset, metadata }>` |
| `getAllRulesets` | `(client, { chainId, projectId, startingId?, size? })` |
| `buildSplit` | `({ beneficiary, percent, projectId?, preferAddToBalance?, lockedUntil?, hook? }) => JBSplit` |
| `buildSetSplitGroupsTx` | `({ chainId, projectId, rulesetId, splitGroups })` |
| `payoutSplitGroupId` | `(token) => bigint` (`uint256(uint160(token))`); `RESERVED_TOKEN_SPLIT_GROUP_ID = 1n` |
| `fillSplitPercents` | `(shares: number[]) => number[]` — sums to `SPLITS_TOTAL_PERCENT` |
| `build721RulesetMetadata` / `decode721RulesetMetadata` | pack/unpack `pauseTransfers`, `pauseMintPendingReserves` into `metadata.metadata` |
| `hasPermissions` | `(client, { chainId, operator, account, projectId, permissionIds, includeRoot?, includeWildcardProjectId? }) => Promise<boolean>`; ids in `JBPermissionIdsV6` |
| `buildSetPermissionsTx` | `({ chainId, account, operator, projectId, permissionIds })` |

juicebox.money `lib/launch.ts` composes rulesets with the SDK, then encodes `JB721TiersHookProjectDeployer.launchProjectFor` / `JBOmnichainDeployer` itself with `jb721TiersHookProjectDeployerAbi` / `jbOmnichainDeployerAbi` because every launch there attaches a 721 hook:

```typescript
const contexts = [buildAccountingContext(NATIVE_TOKEN, 18), buildAccountingContext(USDC_ADDRESSES[chainId], 6)]
const ruleset = buildRulesetConfiguration({
  duration: 0, weight: parseUnits('1000', 18), weightCutPercent: 0,
  metadata: buildRulesetMetadata({ reservedPercent: 2000, cashOutTaxRate: 5000, baseCurrency: BASE_CURRENCY_USD, metadata: build721RulesetMetadata() }),
  splitGroups: [{ groupId: RESERVED_TOKEN_SPLIT_GROUP_ID, splits: [buildSplit({ beneficiary: owner, percent: SPLITS_TOTAL_PERCENT })] }],
})
const request = buildLaunchProjectTx({
  chainId, owner, projectUri: `ipfs://${cid}`, rulesetConfigurations: [ruleset],
  terminalConfigurations: buildTerminalConfigurations({ chainId, accountingContexts: contexts }),
  creationFee: await getProjectCreationFee(publicClient, chainId),
})
```

`QueueRulesetFlow` reads with `getCurrentRuleset` / `getUpcomingRuleset` / `getAccountingContexts` / `decode721RulesetMetadata`, then calls `jbControllerAbi.queueRulesetsOf` directly so the full `JBRulesetConfig` it diffed is what gets sent.

## Revnets and loans

| Export | Signature |
|--------|-----------|
| `buildRevnetStageConfig` | `({ startsAtOrAfter, initialIssuance, autoIssuances?, splitPercent?, splits?, issuanceCutFrequency?, issuanceCutPercent?, cashOutTaxRate?, extraMetadata?, allowSuckerDeployment? = true }) => REVStageConfig` |
| `buildDeployRevnetTx` | `({ chainId, config: REVConfig, accountingContexts, suckerConfig, creationFee?, revnetId?, tiered721Config?, allowedPosts? })` → `REVDeployer.deployFor` |
| `buildAutoIssueTx` / `getAmountToAutoIssue` | `({ chainId, revnetId, stageId, beneficiary })` |
| `getCashOutDelay`, `isRevnetOperator`, `getRevnetTiered721Hook` | `(client, { chainId, revnetId[, operator] })` |
| `getBorrowableAmount` | `(client, { chainId, revnetId, collateralCount, decimals, currency }) => { borrowableNow, borrowableCapacity }` |
| `buildBorrowTx` | `({ chainId, revnetId, token, minBorrowAmount?, collateralCount, beneficiary, prepaidFeePercent, holder })` → `REVLoans.borrowFrom` |
| `buildRepayLoanTx` | `({ chainId, loanId, maxRepayBorrowAmount, collateralCountToReturn, beneficiary, allowance?, value? })` |
| `loanOpeningAmounts` | `/v6/loan-math` — gross → `{ protocolFee, revFee, sourceFee, netBorrowAmount }` |

`RULESET_WEIGHT_INHERIT = 1n` as `initialIssuance` inherits the previous stage's cut-adjusted rate. `parseSuckerDeployerConfig(chainId, chainIds, assets, { version: 6, bridge })` from the root entry produces `suckerConfig.deployerConfigurations` (`MappableAsset.NATIVE | USDC`; `bridge: "ccip" | "native" | "both"`). revnet.money `parseDeployData.ts`:

```typescript
const stage = buildRevnetStageConfig({
  startsAtOrAfter, initialIssuance: parseUnits('1000', 18), splitPercent, splits,
  issuanceCutFrequency: 30 * 86400, issuanceCutPercent: 50_000_000, cashOutTaxRate: 2000,
})
const request = buildDeployRevnetTx({
  chainId,
  config: { description: { name, ticker, uri: `ipfs://${cid}`, salt }, baseCurrency: BASE_CURRENCY_USD, operator, scopeCashOutsToLocalBalances: false, stageConfigurations: [stage] },
  accountingContexts: [buildAccountingContext(NATIVE_TOKEN, 18)],
  suckerConfig: { deployerConfigurations: parseSuckerDeployerConfig(chainId, chainIds, [MappableAsset.NATIVE], { version: 6 }).deployerConfigurations, salt },
})
```

## 721 shop, tokens, suckers

| Export | Signature |
|--------|-----------|
| `getProject721Shop` | `(client, { chainId, projectId, isRevnet, tierLimit?, categories? }) => Promise<Project721Shop \| null>` — `{ hook, store, metadataIdTarget, pricing: { currency, decimals }, tiers }` |
| `effectiveTierPrice` | `(price, discountPercent) => bigint` — `DISCOUNT_DENOMINATOR = 200n` |
| `getTokenAddress` / `getCreditBalance` | `(client, { chainId, projectId[, holder] })` |
| `buildClaimTokensTx`, `buildDeployErc20Tx`, `buildMintTokensTx`, `buildBurnTokensTx`, `buildTransferCreditsTx` | `JBController` token ops |
| `getV6SuckerPairs` | `(client, { chainId, projectId }) => Promise<{ local, remote, remoteChainId }[]>` |
| `buildBridgePrepareTx` | `({ chainId, sucker, projectTokenCount, beneficiary, minTokensReclaimed?, token, metadata? })` → `sucker.prepare` |
| `buildToRemoteTx` | `({ chainId, sucker, token, value? })`; `buildSyncAccountingDataTx({ chainId, sucker, value? })` |
| `findSuckerTransportValue` | `(values, simulate) => Promise<bigint \| null>` over `CCIP_SUCKER_TRANSPORT_VALUES` / `NATIVE_SUCKER_TRANSPORT_VALUES`; `classifySuckerTransport(client, sucker)` |
| `getSuckerMovements` / `claimFromSuckerMovement` / `buildBridgeClaimTx` | outbox scan → `JBClaim` → `sucker.claim` |
| `buildDeployProjectPayerTx` / `projectPayerFromDeployLogs` | `JBProjectPayerDeployer` |

Pass `shop.metadataIdTarget` to `build721PayMetadata` / `build721CashOutMetadata`, never `shop.hook`. `MintShopItemModal` gates owner mints with `hasPermissions(..., { permissionIds: [JBPermissionIdsV6.MINT_721] })` and then calls `jb721TiersHookAbi.mintFor` directly; there is no SDK builder for it.

`GossipCard` fee discovery:

```typescript
const request = buildSyncAccountingDataTx({ chainId, sucker })
const data = encodeFunctionData({ abi: request.abi, functionName: request.functionName, args: request.args })
const value = await findSuckerTransportValue(
  transport === 'ccip' ? CCIP_SUCKER_TRANSPORT_VALUES : NATIVE_SUCKER_TRANSPORT_VALUES,
  candidate => publicClient.call({ account, to: sucker, data, value: candidate }),
)
await send(buildSyncAccountingDataTx({ chainId, sucker, value: value! }))
```

## Cache and quote policy

The SDK caches nothing on-chain-side; every `get*` / `preview*` is a fresh RPC read. The only cache constants are `BENDYSTRAW_CACHE_TTL_MS = { live: 15000, standard: 30000, stable: 60000 }` for `requestBendystraw`. Clients wrap reads in react-query with `staleTime` 15–60 s for quotes and shops, 5 min for token symbols. `prepareHookAwareCashOut` / `prepareBestCashOut` re-quote at send time and throw `CashOutRouteChangedError` (`code: "CASH_OUT_ROUTE_CHANGED"`) if the route flipped — never send a quote captured earlier than the simulation.

## When to hand-roll instead

| Case | Use |
|------|-----|
| `JB721TiersHook.mintFor`, `adjustTiers`, `setMetadata`, `setDiscountPercentOf` | `jb721TiersHookAbi` from the root entry; see `jb-hook-deploy-ui` |
| `JB721TiersHookProjectDeployer.launchProjectFor` with a 721 hook | `jb721TiersHookProjectDeployerAbi`; compose rulesets with `buildRulesetConfiguration` first |
| Buyback hook `setPoolFor`, TWAP params, LP split hook | `jbBuybackHookAbi`, `jbUniswapV4LpSplitHookAbi`; `jb-interact-ui` |
| Contracts absent from `jbContractAddress['6']` (native suckers, price feeds, Defifa, Croptop) | `references/shared/chain-config.json` + `references/shared/abis/*.json` |
| Bendystraw queries | `requestBendystraw` from the root entry or `jb-bendystraw` |

## Common mistakes

1. **`hookAddress` in `build721PayMetadata`.** Deprecated; use `metadataIdTarget` from `getProject721Shop`. Encoding with the hook address produces a metadata ID the hook never matches, so tiers silently do not mint.
2. **`isRouter` read as "payable".** Probe `previewPayFor` on the resolved address; a revert means a cold-start project with no route.
3. **Sending `buildCashOutTx` with `minTokensReclaimed` on an `"amm"` route.** The terminal reclaims nothing there; use `route.terminalMinimum` and `route.metadata` from `getHookAwareCashOutQuote`.
4. **`MAX_FEE_PER_BILLION` for the protocol fee.** Deprecated; the contract denominator is `MAX_FEE = 1000n` with `STANDARD_FEE = 25n` (`/v6/fees`).
5. **`USD_CURRENCY_ID` is a function.** `USD_CURRENCY_ID(6)` returns `2`; prefer `BASE_CURRENCY_USD` / `BASE_CURRENCY_ETH` from `/v6`. Accounting-context currencies are `tokenCurrencyId(token)`, not 1 or 2.
6. **Importing a suffixed ABI.** `jbControllerV5Abi`, `jbController4_1Abi`, `revLoans1_1Abi` are not V6.
7. **Omitting `creationFee`.** `buildLaunchProjectTx` requires it and sets it as `value`; read it with `getProjectCreationFee`.
8. **`build721RulesetMetadata` without the existing `metadata` bits.** Pass `{ metadata: current.metadata.metadata, pauseTransfers }` or unrelated app bits are cleared.
