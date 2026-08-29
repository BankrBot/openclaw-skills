---
name: jb-buyback-hook
description: |
  Configure and integrate the Juicebox V6 buyback hook (JBBuybackHook + JBBuybackHookRegistry,
  nana-buyback-hook-v6 1.4.0): registry default/cohort resolution, setHookFor/lockHookFor, Uniswap V4
  pool setup, TWAP windows, the pay/cashOut metadata entries, route selection, preview decoding, and
  the burn-and-remint reserved-split mechanic. Use when: (1) wiring a project's buyback pool or TWAP
  window, (2) building a pay with a swap quote (amountToSwapWith, minimumSwapAmountOut, skipSplits),
  (3) decoding previewPayFor / previewCashOutFrom hook-spec metadata to show the mint-vs-swap route,
  (4) a pay reverts JBBuybackHook_SpecifiedSlippageExceeded or a cash out ignores its floor,
  (5) deciding between pay-with-quote and a direct AMM swap in a frontend.
version: 6.0.0
---

# JBBuybackHook and JBBuybackHookRegistry

Source: `nana-buyback-hook-v6/src` (package `@bananapus/buyback-hook-v6` 1.4.0). Line references below are to that source.

| Contract | Address (all chains) | Role |
|---|---|---|
| `JBBuybackHookRegistry` | `0x72f55a54cd53410a5ff175508a5a384227081788` | Ruleset `dataHook`. Resolves the project's hook, rekeys the payer's `pay`/`cashOut` metadata, forwards `beforePayRecordedWith` / `beforeCashOutRecordedWith` |
| `JBBuybackHook` | `0x77bee1ad2ac0ace98a9b5b58d75685c8b4d94948` | Data hook + pay hook + cash-out hook. Swaps against a Uniswap V4 pool when it beats issuance / bonding-curve reclaim |

Never resolve a project's hook from the static address. Read `JBDirectory.controllerOf(pid)` → `currentRulesetOf(pid).metadata.dataHook`; if it is the registry (or `REVOwner`, which forwards to it) call `registry.hookOf(pid)`. `hookOf` returns a default for projects that never route through the registry, so it is only meaningful once the ruleset's data hook is known to be the registry. Addresses live in `references/shared/chain-config.json`.

Both contracts are `ERC2771Context` + `JBPermissioned`; `hasMintPermissionFor` on the registry returns `addr == hookOf(projectId)` (JBBuybackHookRegistry.sol:496-511), and on the hook always `false` (JBBuybackHook.sol:1305). The hook mints through the controller only because the registry grants it.

## Permissions

| ID | Name | Gates |
|---|---|---|
| 28 | `SET_BUYBACK_TWAP` | `JBBuybackHook.setTwapWindowOf` |
| 29 | `SET_BUYBACK_POOL` | `initializePoolFor`, both `setPoolFor` overloads (hook and registry) |
| 30 | `SET_BUYBACK_HOOK` | `JBBuybackHookRegistry.setHookFor`, `lockHookFor` |

All are checked against `PROJECTS.ownerOf(projectId)` via `_requirePermissionFrom`.

## Registry: default, cohorts, set, lock

`_resolvedHookOf(projectId)` (JBBuybackHookRegistry.sol:559-576):

1. `_hookOf[projectId]` if non-zero (pinned by `setHookFor` or `lockHookFor`).
2. `defaultHook` if `projectId > defaultHookProjectIdThreshold`.
3. Otherwise walk `_defaultHookHistory` for the segment with `minProjectIdExclusive < projectId <= maxProjectId` → that segment's hook.
4. `address(0)` if nothing matches. Then `beforePayRecordedWith` / `beforeCashOutRecordedWith` pass the context through unchanged (:438-440, :379-387) and pool setters revert `JBBuybackHookRegistry_HookNotSet`.

| Function | Access | Behavior |
|---|---|---|
| `setDefaultHook(hook)` | owner | Reverts on `address(0)`. Pushes a `DefaultHookSegment{minProjectIdExclusive: oldThreshold, maxProjectId: PROJECTS.count(), hook: firstEver ? newHook : outgoingDefault}`, sets `defaultHook`, sets threshold to `PROJECTS.count()`, allowlists the hook (:259-288). A default change never re-routes an existing cohort |
| `allowHook(hook)` / `disallowHook(hook)` | owner | Allowlist for `setHookFor`. Cannot disallow the current default (:166). Allowing `address(0)` lets operators clear a pin. Disallowing does not touch existing pins (:442-444) |
| `setHookFor(projectId, hook)` | owner / ID 30 | Reverts `HookLocked` if locked, `HookNotAllowed` if not allowlisted. Writes `_hookOf` (:295-310) |
| `lockHookFor(projectId, expectedHook)` | owner / ID 30 | Resolves the hook, reverts `HookNotSet` on zero, pins it into `_hookOf` if not already pinned, reverts `HookMismatch` if it differs from `expectedHook`, sets `hasLockedHook` (:225-249). Permanent |
| `hookOf(projectId)` | view | `_resolvedHookOf` |
| `initializePoolFor` / `setPoolFor(pid, fee, tickSpacing, twapWindow, terminalToken)` | ID 29 | Forwards to the resolved hook (which checks ID 29 again with the registry as caller — grant the registry ID 29 or call the hook directly) |

Metadata rekeying (:446-472, :389-414): the registry looks up the entry keyed `getId("pay", registry)` / `getId("cashOut", registry)` and appends a copy keyed to the resolved hook. Payers may key their entry to either the registry or the hook; keying to the hook works on both the registry path and direct-hook path.

## Pool setup

`terminalToken` is the project's accounting token (`JBConstants.NATIVE_TOKEN` = `0x…EEEe` for ETH); it is normalized to `address(0)` for storage and pool keys. Pool keys are per `(projectId, normalizedTerminalToken)` and immutable once set (`JBBuybackHook_PoolAlreadySet`).

| Function | Signature | Notes |
|---|---|---|
| `initializePoolFor` | `(uint256 projectId, uint24 fee, int24 tickSpacing, uint256 twapWindow, address terminalToken, uint160 sqrtPriceX96)` | Builds the key with `hooks = oracleHook`, currencies sorted by address; `try poolManager.initialize` then reverts `PoolInitializedAtWrongPrice` unless `getSlot0` matches `sqrtPriceX96` (:641-683). Use on a fresh pool only |
| `setPoolFor` | `(uint256 projectId, uint24 fee, int24 tickSpacing, uint256 twapWindow, address terminalToken)` | Same key construction, pool must already be initialized (:757-772) |
| `setPoolFor` | `(uint256 projectId, PoolKey poolKey, uint256 twapWindow, address terminalToken)` | Arbitrary key; `poolKey.hooks` is not validated (:714-743). Pools with a hook other than `oracleHook` never get the cold-start spot fallback (:1730) |
| `setTwapWindowOf` | `(uint256 projectId, address terminalToken, uint256 newWindow)` | Pool must be set; stores exactly `newWindow` (:790-816) |

`PoolKey` (Uniswap V4): `(Currency currency0, Currency currency1, uint24 fee, int24 tickSpacing, IHooks hooks)`. `poolKeyOf(projectId, terminalToken)` returns it; `projectTokenOf(projectId)` and `twapWindowOf(projectId, terminalToken)` are public.

`_setPoolFor` checks (:1385-1420): not already set; project has a token (`ZeroProjectToken`); terminal token ≠ project token; `getSlot0(poolId).sqrtPriceX96 != 0` (`PoolNotInitialized`); key currencies are exactly {projectToken, terminalToken} (`PoolKeyCurrenciesMismatch`).

### TWAP window

| Constant | Value |
|---|---|
| `MIN_TWAP_WINDOW` | 300 s |
| `MAX_TWAP_WINDOW` | 172,800 s (2 days) |
| `_DEFAULT_TWAP_WINDOW` (internal) | 1,800 s |

At registration (`initializePoolFor` / `setPoolFor`), a window of exactly `MAX_TWAP_WINDOW` is stored as 1,800 s (:1391) — immutable deployers such as `REVDeployer` bake the max in as a placeholder. `setTwapWindowOf` never remaps, so an explicit 2-day window is reachable. Anything outside `[300, 172800]` reverts `JBBuybackHook_InvalidTwapWindow(value, min, max)`.

## Quote derivation (`_getQuote`, :1676-1827)

Returns zero (→ mint / direct reclaim) when: no pool set; `poolManager.getLiquidity(poolId) == 0` at the current tick; oracle `observe` fails; estimated impact ≥ 1e18 against `min(currentLiquidity, twapLiquidity)`; sigmoid slippage tolerance ≥ 8,800 bps. Otherwise `amountOut = raw − raw × tolerance / 10_000` with `tolerance = max(200, poolFeeBps + 100) + (8800 − min) × impact / (impact + 5e16)` (JBSwapLib.sol:137-157).

Cold start (`twapLiquidity == 0`): the pay side (`allowColdStartSpotFallback = true`, :1241) may quote from the oracle mean tick or slot0 with a haircut of `300 bps + lpFee + impact`, capped at 5% impact (:1731-1789). The cash-out side never uses spot (:1044, :1738).

## Pay side

### Metadata entry

Key: `JBMetadataResolver.getId("pay", hook)` = `0xda79b72d` for `0x77bee1ad…4948` (or `0xdf320cd4` keyed to the registry). Payload (:1157):

```solidity
abi.encode(uint256 amountToSwapWith, uint256 minimumSwapAmountOut, bool skipSplits) // 96 bytes
```

| Word | Meaning |
|---|---|
| `amountToSwapWith` | Terminal-token amount routed to the pool. `0` → the full payment (:1167). `> context.amount.value` reverts `JBBuybackHook_InsufficientPayAmount` (:1164). Remainder mints at the ruleset weight |
| `minimumSwapAmountOut` | `0` → no user quote; the TWAP oracle derives the floor. Non-zero → `hasUserSpecifiedQuote`, TWAP skipped for the floor, value is a hard settlement guarantee (:1160, :586-595) |
| `skipSplits` | `true` → swap output is transferred to the beneficiary as-is (:605-607), not burned and reminted through the reserved split; route comparison and the swap's price limit use the beneficiary share of a direct mint, `mulDiv(count, 10_000 − reservedPercent, 10_000)` (:1190-1193, :1553-1565); an explicit minimum settles against `swapOut + beneficiaryShare(leftoverMint)` (:590-593). Leftover mint always goes through the split |

Always encode all three words. The 1.4.0 source decodes three; a hook built from the earlier two-word source decodes `(uint256, uint256)` and `abi.decode` ignores trailing bytes, so a 96-byte payload works on both. A 64-byte payload reverts on 1.4.0.

```typescript
import { encodeAbiParameters } from 'viem'
import createMetadata from 'juicebox-metadata-helper'

const payload = encodeAbiParameters(
  [{ type: 'uint256' }, { type: 'uint256' }, { type: 'bool' }],
  [0n /* full amount */, minimumSwapAmountOut, true /* skipSplits */]
)
const metadata = createMetadata(['0xda79b72d'], [payload])
```

### Route selection (`beforePayRecordedWith`, :1141-1301)

1. `weightRatio = amount.currency == ruleset.baseCurrency ? 10**amount.decimals : PRICES.pricePerUnitOf(...)` (:1188-1195).
2. `tokenCountWithoutHook = amountToSwapWith × weight / weightRatio`, reduced to the beneficiary share if `skipSplits` (:1201-1205).
3. Quote: user minimum → `poolHasLiquidity` check + diagnostics-only `_getQuote`; no user minimum → `_getQuote` derives `minimumSwapAmountOut` (:1220-1243).
4. No pool set: if `hasUserSpecifiedQuote`, revert unless `tokenCountWithoutHook >= minimumSwapAmountOut`; otherwise return `(weight, [])` (:1295-1300).
5. Pool set: `noop = !poolHasLiquidity || tokenCountWithoutHook >= minimumSwapAmountOut` (:1264). A cold-start quote is used for routing only; the executed floor collapses to `tokenCountWithoutHook` (:1266-1270). One spec is always returned; if `!noop` the weight is `0` and `amount = amountToSwapWith` (:1267-1306).

### Hook-spec metadata (17 words, :1284-1302)

```solidity
abi.decode(spec.metadata, (
  bool    projectTokenIs0,
  uint256 amountToMintWith,             // totalPaid − amountToSwapWith
  uint256 minimumSwapAmountOut,         // floor used for routing (user or TWAP-derived)
  bool    hasUserSpecifiedQuote,
  address controller,
  uint256 tokenCountWithoutHook,        // issuance for the swap portion (beneficiary share if skipSplits)
  uint256 weightRatio,
  uint256 amountToSwapWith,             // quotedAmountToSwapWith
  int24   twapTick,
  uint128 twapLiquidity,
  bytes32 poolId,
  uint256 minimumBeneficiaryTokenCount, // controller.previewMintOf(minimumSwapAmountOut) split
  uint256 minimumReservedTokenCount,
  uint256 rawSwapQuote,                 // oracle quote before slippage haircut
  bool    oracleUnseeded,
  bool    skipSplits,
  uint256 reservedPercent
))
```

A preview calls `terminal.previewPayFor(projectId, token, amount, beneficiary, metadata)` and finds the spec whose `hook` equals the resolved buyback hook. `noop == false` means the swap route; `rawSwapQuote` is the optimistic number, `minimumSwapAmountOut` the executable floor, `tokenCountWithoutHook` what a mint would give. The `noop` spec is the preview API — never strip it.

### Execution (`afterPayRecordedWith`, :427-627)

- If the terminal forwarded less than `quotedAmountToSwapWith` (same-terminal split fee), the price limit and any derived floor scale down; explicit minima do not (:481-495).
- Swap price limit = issuance rate (`tokenCountWithoutHook / amountIn`): the pool fills only while it beats minting; unconsumed input is returned to the terminal with `addToBalanceOf` and minted at the weight (:521-581).
- Derived (TWAP) floor is enforced inside `unlockCallback`, pro-rated by consumed input; a miss reverts `JBBuybackHook_DerivedFloorNotMet`, caught by `_swapExactInput`, and the whole payment mints (:884-890, :1536-1540). It never reverts a pay.
- Explicit minimum: `_requireMinimum(swapOut + leftoverMint[BeneficiaryShare], minimumSwapAmountOut)` reverts `JBBuybackHook_SpecifiedSlippageExceeded(amount, minimum)` (selector `0xe2d708a9`) (:586-595).
- Settlement: with `skipSplits == false` the hook `burnTokensOf` the swap output and mints `swapOut + leftover` to the beneficiary with `useReservedPercent: true` (:596-614). Net effect: beneficiary receives `swapOut × (10_000 − reservedPercent) / 10_000`, the remainder becomes pending reserved tokens. An activity feed shows a `Swap` event followed by a smaller mint in one tx.
- A swap-routed pay that emits `Mint` without `Swap` is the fallback path.

### Why frontends compare pay-with-quote against a direct AMM swap

Without `skipSplits`, paying through the hook costs the payer the reserved cut on swap output; a direct Universal Router swap on the same pool pays the full output. `chooseBestPayRoute` (juice-sdk `v6/pay.ts:120-152`) takes `previewPayFor`'s `beneficiaryTokenCount` and a V4 `quoteExactInputSingle`; the direct swap wins only when `quote × (10_000 − slippageBps) / 10_000 > beneficiaryTokenCount`. `quoteDirectPaySwap` (`v6/directPay.ts:195-290`) returns `null` otherwise, and `juicebox-money` `PayPanel.tsx` gates the route on a fresh, non-placeholder quote in plain `pay` mode with an empty NFT cart (`direct-pay-swap.ts:41-59`). With `skipSplits = true` the pay route delivers the swap output un-cut, so the pay path with a quote is equivalent to the direct swap plus the issuance-rate fallback.

## Cash-out side

### Metadata entry

Key: `getId("cashOut", hook)` = `0xf10fae59` for `0x77bee1ad…4948` (`0xf44415a0` keyed to the registry). Payload (:972):

```solidity
abi.encode(uint256 minimumSwapAmountOut, bool skip) // 64 bytes
```

| Word | Meaning |
|---|---|
| `minimumSwapAmountOut` | Hard floor on net terminal-token output. `0` → TWAP decides. Non-zero → TWAP skipped, the value is both the route comparator and the swap floor; enforced even on the direct fallback (:987-997, :1045-1047) |
| `skip` | `true` forces the bonding-curve path; the floor still applies (:983-1005) |

### Routing gates (`beforeCashOutRecordedWith`, :942-1099)

1. `skip || !poolIsSet || projectToken == 0 || cashOutCount == 0` → direct path, no spec (floor checked if given).
2. `directCashOutAmount = JBCashOuts.cashOutFrom(surplus, cashOutCount, totalSupply, cashOutTaxRate)`; `netDirectCashOutAmount` subtracts the terminal fee exactly as `JBMultiTerminal` does: none if `beneficiaryIsFeeless`; 2.5% of gross if `cashOutTaxRate != 0`; 2.5% of `min(gross, feeFreeSurplusOf)` if the tax is zero (:1860-1882).
3. `marketCanSettle = getLiquidity(poolId) != 0 && minimumSwapAmountOut != 0` (:1063).
4. If the AMM does not beat direct, direct must be locally settleable: `terminal.currentSurplusOf([surplus.token]) >= directCashOutAmount` (:1071-1074, :1625-1657).
5. `noop = !marketCanSettle || (directPathCanSettle && minimumSwapAmountOut <= netDirectCashOutAmount)` (:1078).
6. Swap route: returns `(MAX_CASH_OUT_TAX_RATE, cashOutCount, totalSupply, 0, specs)` (:1110) so the terminal reclaims nothing itself. `previewCashOutFrom` then shows `reclaimAmount ≈ 0` and a 100% tax; read the amount from the spec.

Spec metadata (8 words, :1087-1096), returned for `noop` either way:

```solidity
abi.decode(spec.metadata, (
  uint256 minimumSwapAmountOut, uint256 cashOutCount, uint256 netDirectCashOutAmount,
  int24 twapTick, uint128 twapLiquidity, bytes32 poolId, uint256 rawSwapQuote,
  bool hasUserSpecifiedMinimumSwapAmountOut
))
```

Production route selection lives in juice-sdk `v6/cashOut.ts` (`decodeBuybackCashOutSpec`, `buildBuybackCashOutMetadata`, `resolveCashOutRoute`) and is consumed by `juicebox-money/src/lib/cashOut.ts` and `revnet-money` `RedeemDialog.tsx`:

- Only a spec whose `hook` equals the resolved buyback hook is decoded; other data hooks (721) also return specs.
- Treasury route: `minTokensReclaimed = floor(treasuryNet × (1 − slippage))`, metadata `0x`.
- AMM route: `minTokensReclaimed = 0` (the terminal reclaims 0 at 100% tax; a non-zero terminal floor reverts `JBMultiTerminal_UnderMin`), metadata = `cashOut` entry with `minimumSwapAmountOut = floor(min(rawSwapQuote, hookMinimum) × (1 − slippage))`. If that floor does not exceed `netDirectCashOutAmount`, fall back to treasury.
- Re-quote immediately before sending; an explicit floor is a hard revert (`0xe2d708a9`).

### Execution (`afterCashOutRecordedWith`, :300-412)

The terminal has already burned the holder's tokens. The hook remints `cashOutCountToSell` to itself with `useReservedPercent: false`, sells it, and forwards proceeds to the beneficiary in the reclaim token. `cashOutCountToSell` comes from the spec metadata (a wrapper such as `REVOwner` may pass a smaller count), clamped to `context.cashOutCount` (:320). If the swap reverts, reminted tokens go back to the holder (`SellSwapReverted`) unless an explicit minimum was set, in which case it reverts (:354-361). A partial fill under a derived floor soft-lands: proceeds forwarded, unsold remint returned (:374-377). Events: `CashOutSwap(projectId, cashOutCount, poolId, amountReceived, caller)`.

## Common mistakes

- **Two-word `pay` payload.** `abi.decode(metadata, (uint256, uint256, bool))` on 1.4.0 reverts on 64 bytes. Always encode three words; older two-word decoders accept the extra word.
- **Treating `minimumSwapAmountOut = 0` as "no slippage protection".** It selects the TWAP oracle floor; a non-zero value bypasses the TWAP and becomes a hard revert floor.
- **Applying slippage to `rawSwapQuote`.** The executable number is `minimumSwapAmountOut` (already haircut); flooring the raw quote can produce a minimum the pool cannot fill.
- **Non-zero `minTokensReclaimed` on the AMM cash-out route.** The terminal reclaims 0 there; the floor belongs in the `cashOut` entry.
- **Decoding every hook spec as a buyback spec.** Match `spec.hook` against the resolved buyback hook first; 721 and REVOwner specs carry different payloads.
- **Reading a project's hook from the static `JBBuybackHook` address or an unconditional `registry.hookOf`.** Resolve via the ruleset `dataHook`, then `hookOf`; projects pinned with `setHookFor` may use a different hook.
- **Registering with `twapWindow = MAX_TWAP_WINDOW` expecting 2 days.** It is stored as 1,800 s; call `setTwapWindowOf` for an explicit max.
- **`initializePoolFor` on a live pool.** It reverts `PoolInitializedAtWrongPrice` once the price has moved; use `setPoolFor` with the existing key.
- **Expecting a TWAP-floor miss to revert.** Derived floors unwind the swap and mint at the issuance rate; only explicit minima revert.
- **Reading "minted 0.6×" next to "bought 1×" as double issuance.** It is the burn-and-remint through the reserved split; `minted / bought == (10_000 − reservedPercent) / 10_000`. `skipSplits = true` removes that cut.
- **Single-sided liquidity.** `getLiquidity(currentTick) == 0` disables both routes regardless of TWAP history.
- **Using the old purpose strings `"quote"` / `"cashOutMinReclaimed"`.** The IDs are `getId("pay")` and `getId("cashOut")`; a wrong ID is silently ignored and the hook falls back to the TWAP path.
