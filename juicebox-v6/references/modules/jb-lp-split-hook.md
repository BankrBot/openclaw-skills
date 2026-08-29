---
name: jb-lp-split-hook
description: |
  Juicebox V6 Uniswap V4 LP split hook (univ4-lp-split-hook-v6). Use when: (1) wiring a reserved-token
  split to `JBUniswapV4LPSplitHook` / `JBP6FeeLPSplitHook`, (2) encoding `deployHookFor`, `deployPool`,
  `addLiquidity`, `rebalanceLiquidity`, `collectAndRouteLPFees`, `claimFeeTokensFor`, (3) reading hook
  ledgers (`accumulatedProjectTokens`, `tokenIdOf`, `poolKeyOf`, `claimableFeeTokens`), (4) debugging
  `NoDeployableLiquidityAtSpot`, `PriceDeviationTooHigh`, `TwapUnavailable`, `UnderMin`,
  `AccumulationBelowThreshold`, (5) reasoning about the floor/ceiling tick corridor, single-sided asks,
  the fee-project cut, or Permit2 approvals, (6) choosing the right `deployPool` selector for a given
  deployed hook, (7) indexing LP positions via bendystraw `buybackPoolPositions`.
version: 6.0.0
---

# Uniswap V4 LP Split Hook

`JBUniswapV4LPSplitHook` is an `IJBSplitHook` placed on a project's **reserved-token split** (`groupId == 1`). It accumulates reserved project tokens, seeds one Uniswap V4 pool per project (project token ↔ one terminal token), holds the LP NFT, and routes LP trading fees back into protocol-owned liquidity with a cut paid to a fee project. The hook never burns.

## Contracts and addresses

Use chain config only for read-only discovery. Resolve deployers, hooks, routers, spenders, and other write targets from the reviewed deployment manifest and verify them live on the selected chain.

| Key | Role | Address |
|-----|------|---------|
| `JBUniswapV4LPSplitHook` | Implementation (clones delegate to it). `feeProjectId` on the impl is irrelevant; never wire splits to it | `0xfcdbabd7b8de07c6e4ca7d79790e235848edc251` |
| `JBUniswapV4LPSplitHookDeployer` | Clone factory (`deployHookFor`), registers clones in `JBAddressRegistry` | `0xee49b9c6938c31c223e49272bb0a3810bc39f3da` |
| `JBUniswapV4LPSplitHookMath` | Linked external library: corridor/tick math, rate lookups | `0x734bfc66606dfe7943bcf541cf5dcbc5312e695b` |
| `JBP6FeeLPSplitHook` | The shared clone projects wire into splits. `feeProjectId = 1`, `feePercent = 2000` (20%), `buybackHook = JBBuybackHookRegistry`, salt `"_BAN_LP_SPLIT_HOOK_V6_"` deployed by the Safe `0x4dc161eF837fF1C4485b08DDFcDB182F2157bE18` | `0xe9493bc776699714a89aa982cf828d843f040d2a` |
| `Permit2` | Canonical Uniswap Permit2 | `0x000000000022d473030f116ddee9f6b43ac78ba3` |
| `JBUniswapV4Hook` | The oracle hook (`IGeomeanOracle`) every LP pool is keyed with; chain-specific | per chain |

Chains with the hook, deployer, and `JBP6FeeLPSplitHook`: 1, 10, 8453, 42161, 11155111, 84532, 421614. **OP Sepolia (11155420) has only `JBUniswapV4LPSplitHookMath`** — a reserved split pointing at `0xe949…` there hits an address with no code, `supportsInterface` fails, and the controller's split-hook call reverts (caught per split by `JBController`; the split's tokens are burned as unconsumed allowance).

Constructor immutables (identical on all chains): `DIRECTORY = JBDirectory`, `PERMISSIONS = JBPermissions`, `TOKENS = JBTokens`, `PERMIT2`, `SUCKER_REGISTRY = JBSuckerRegistry`. `PROJECTS = DIRECTORY.PROJECTS()`.

## Two generations, two selector sets

The on-chain bytecode (deployed 2026-07-16 from the 1.3.0 fix script) and the current `main` / npm `1.4.0` source differ in signature. Check the target with `getCode` and look for the selector before encoding; revnet.money does exactly this (`deployPoolArity` in `owners/market/lib.ts`).

| Function | Deployed at `0xfcdb…` / `0xe949…` | Source `main` (npm 1.4.0, not yet deployed) |
|----------|-----------------------------------|--------------------------------------------|
| `deployPool` | `deployPool(uint256 projectId, uint256 minCashOutReturn)` → `0x74a2fa6d` | `deployPool(uint256 projectId)` → `0x9af2297c` |
| `addLiquidity` | `addLiquidity(uint256 projectId, address terminalToken, uint256 minCashOutReturn)` → `0x9aa5d462` | `addLiquidity(uint256 projectId, address terminalToken)` → `0xc95f9d0e` |
| `rebalanceLiquidity` | `rebalanceLiquidity(uint256 projectId, address terminalToken, uint256 decreaseAmount0Min, uint256 decreaseAmount1Min)` → `0xce974d15` | `rebalanceLiquidity(uint256 projectId, address terminalToken)` → `0x470c6271` |
| `collectAndRouteLPFees` | `(uint256 projectId, address terminalToken)` → `0x978db958` | same |
| `claimFeeTokensFor` | `(uint256 projectId, address beneficiary)` → `0xcd0802e5` | same |

Behavioral differences:

| Topic | Deployed | Source `main` |
|-------|----------|---------------|
| Pool funding | Cashes out a computed fraction of accumulated tokens through the project's own terminal (`cashOutTokensOf`, forced direct via buyback-hook metadata) to mint a two-sided position. `minCashOutReturn == 0` → hook derives its own floor: `97%` of `cashOutAmount * cashOutRate` (minus the 2.5% fee if `cashOutTaxRate != 0`). A caller value only raises the floor. Floor breach reverts `JBMultiTerminal_UnderMin(value, min)` | No cash-out. Mints a single-sided ask of the accumulated tokens from spot to the issuance ceiling; a bid leg only appears from terminal tokens the hook already holds (collected fees, burn recoveries) |
| Auth on `deployPool`/`addLiquidity` | `SET_BUYBACK_POOL` from the project owner until `ruleset.weight * 10 <= initialWeightOf[projectId]` (weight decayed 10x since first accumulation), then permissionless | Permissionless from the start; guarded only by corridor geometry and the TWAP check |
| `processSplitWith` with no ERC-20 | Reverts `InvalidProjectId` (credits rejected; the controller swallows the revert and the credits stay with the hook) | Accepts credits into `accumulatedProjectCredits` after verifying `TOKENS.creditBalanceOf(hook)` covers the ledger, then returns |
| Post-intake automation | None; someone must call `deployPool`/`addLiquidity` | Best-effort self-call (`executeAutomationFor`) when `gasleft() >= 564_000`; failure emits `LiquidityAutomationFailed(projectId, bytes4 selector, caller)` and the ledger is untouched |
| Re-range on `addLiquidity` | Tops up the live position unless the corridor drifted `>= 400` ticks, then burns and re-mints | Always burns and re-mints one consolidated position on the fresh corridor |

Everything below describes both unless marked.

## processSplitWith (intake)

Checks, in order: `msg.value == 0` → `UnexpectedMsgValue`; `context.split.hook == this` → `NotHookSpecifiedInContext`; `DIRECTORY.controllerOf(projectId) == msg.sender` → `SplitSenderNotValidControllerOrTerminal`; `groupId == 1` → `TerminalTokensNotAllowed`. `context.token` is ignored — the project token is resolved from `JBTokens.tokenOf(projectId)`.

ERC-20 path: `safeTransferFrom(controller, hook, context.amount)` against the controller's allowance, then `accumulatedProjectTokens[projectId] += balanceDelta`. `initialWeightOf[projectId]` is snapshotted at the first accumulation (deployed) or first deploy/add (`main`). Payout splits (`groupId != 1`) always revert — this hook is reserved-token only.

## deployHookFor

```solidity
function deployHookFor(uint256 feeProjectId, uint256 feePercent, IJBBuybackHookRegistry buybackHook, bytes32 salt)
    external returns (IJBUniswapV4LPSplitHook hook);
```

- `salt == bytes32(0)` → `LibClone.clone` (plain CREATE, address depends on the deployer's nonce). Otherwise `cloneDeterministic` with effective salt `keccak256(abi.encode(msg.sender, salt))`. The same `(impl, deployer, msg.sender, salt)` gives the same address on every chain; a different sender gives a different address.
- The clone is initialized atomically: `initialize(feeProjectId, feePercent, poolManager, positionManager, oracleHook, buybackHook)`. Reverts: `feePercent > 10_000` → `InvalidFeePercent`; `feePercent > 0 && feeProjectId == 0` → `FeePercentWithoutFeeProject`; `feeProjectId != 0` with no controller → `InvalidProjectId`; deployer not yet configured (`poolManager == 0`) → `JBUniswapV4LPSplitHookDeployer_NotConfigured`.
- Emits `HookDeployed(feeProjectId indexed, feePercent, hook, caller)` and registers the clone in `JBAddressRegistry` (`deployerOf(clone) == deployer`).
- `feeProjectId`, `feePercent`, `poolManager`, `positionManager`, `oracleHook`, `buybackHook` are write-once. Clones are immutable: fixing the impl requires a fresh clone and re-pointing splits (this is why `JBP6FeeLPSplitHook` is `0xe949…`, not the impl).

Predict the address: `LibClone.predictDeterministicAddress(impl, keccak256(abi.encode(sender, salt)), deployer)`.

## Pool and position geometry

Pool key: `currency0/1` = sorted (project token, terminal currency), `fee = 10_000` (1%), `tickSpacing = 200`, `hooks = oracleHook`. Native terminal token `0x…EEEe` maps to `Currency(address(0))`. One pool per project: `deployPool` picks the terminal token by `JBUniswapV4LPSplitHookMath.findHighestValueTerminalTokenOf` (highest ETH-denominated balance across `IJBMultiTerminal`s; non-multiterminals such as the router registry are skipped) and reverts `OnlyOneTerminalTokenSupported` on a second token.

Corridor (`calculateTickBounds`):

| Case | tickLower / tickUpper |
|------|-----------------------|
| `cashOutRate > 0` | floor = cash-out rate (surplus / total supply incl. reserved and, unless `scopeCashOutsToLocalBalances`, remote sucker surplus/supply through the bonding curve), ceiling = issuance rate net of `reservedPercent`. Sorted, then aligned **inward** (lower up, upper down). If it collapses, ±1 spacing around the current bonding-curve price; still collapsed → `JBUniswapV4LPSplitHookMath_InvalidTickBounds` |
| `cashOutRate == 0`, `issuanceRate > 0` (typical for 6-decimal USDC with large supply) | Ceiling pinned on the issuance tick; the other bound 2 spacings inward (no floor exists) |
| both `0` | Full range |

Initial price (`computeInitialSqrtPrice`): one spacing inside the floor bound, clamped one spacing short of the ceiling, so nearly the whole ask spans the corridor. If the pool already exists (e.g. the buyback pool), its price is kept; a spot at or beyond the floor reverts `ExistingPoolPriceOutOfBounds`, and the TWAP check runs.

Single-sided add (`_adaptiveRange`, `main`): the ask leg runs from spot to the ceiling using the whole project balance; the bid leg is solved from the terminal balance downward and clamped at the floor. Spot at or above the ceiling with no terminal tokens → `NoDeployableLiquidityAtSpot(spotTick, ceilingTick, projectAmount, terminalAmount)`. A spot inside the top spacing below the ceiling can align the bid bound onto the ceiling → `ZeroLiquidity`; see the ceiling-brick note in Common mistakes.

TWAP guard (`_requireSpotNearTwap`): `oracleHook.observe(key, [1800, 0])`; `|spotTick - twapTick| > 200` → `PriceDeviationTooHigh(spot, twap, 200)`; oracle revert or short array → `TwapUnavailable`. Runs on `addLiquidity`, `rebalanceLiquidity`, and `deployPool` against a pre-initialized pool. A fresh pool the hook initializes itself skips it. There is no zero-min swap floor anywhere in this hook: the only Uniswap minimums it passes are `0` on the fee-collect decrease (nothing is swapped), and (deployed) the caller-supplied `decreaseAmount{0,1}Min` on rebalance burns.

Thresholds: `addLiquidity` requires `accumulatedProjectTokens >= 1e15` (`AccumulationBelowThreshold`); `rebalanceLiquidity` requires the fresh corridor to differ from `rangedCorridor{Lower,Upper}Of` by more than one spacing on at least one bound (`DriftBelowThreshold`). Burn slippage on re-mint is 95% of the principal read.

## Permit2

Minting goes through `IPositionManager.modifyLiquidities`. For each ERC-20 side the hook does `forceApprove(PERMIT2, amount)` then `PERMIT2.approve(token, positionManager, uint160(amount), uint48(block.timestamp + 60))`; amounts above `uint160` revert `Permit2AmountOverflow`. Approvals are cleared after the mint. Native ETH is passed as `msg.value` on `modifyLiquidities`. Nothing external needs to approve the hook.

## Fees

`collectAndRouteLPFees(projectId, terminalToken)` — permissionless. `DECREASE_LIQUIDITY(tokenId, 0, 0, 0)` + `TAKE_PAIR(c0, c1, hook)` (actions `0x0111`), then per side `_attemptFeeProjectCut`:

- `cut = amount * feePercent / 10_000`; paid with `JBMultiTerminal.pay(feeProjectId, feeToken, cut, beneficiary = hook, minReturnedTokens = 0, memo "LP Fee")` on `DIRECTORY.primaryTerminalOf(feeProjectId, feeToken)`. No terminal for that token → no cut, whole amount kept.
- Fee-project tokens minted to the hook are credited to `claimableFeeTokens[projectId]` (`claimableFeeTokenOf[projectId]` records the ERC-20) or, if the fee project has no ERC-20, `claimableFeeCredits[projectId]`. The pay is `try/catch`; on failure the cut is 0.
- Remainders never leave the hook: project-token fees go to `accumulatedProjectTokens`, terminal-token fees to `accumulatedTerminalTokens[projectId][terminalToken]`, both becoming future liquidity. Emits `LPFeesRouted(projectId, token, totalAmount, feeAmount, remainingAmount, feeTokensMinted, caller)`.
- `claimFeeTokensFor(projectId, beneficiary)` requires `SET_BUYBACK_POOL` from the project owner; transfers the ERC-20 then attempts the credit claim (best-effort, restored on failure). Emits `FeeTokensClaimed`.

Reading unclaimed fees off-chain: Uniswap `StateView.getPositionInfo(poolId, positionKey)` with `positionKey = keccak256(abi.encodePacked(positionManager, tickLower, tickUpper, bytes32(tokenId)))` and `owed = ((feeGrowthInsideNow - last) mod 2^256) * liquidity >> 128`. Lifetime fees are only in the indexer (`feesClaimed0/1`).

## Reads

| View | Meaning |
|------|---------|
| `accumulatedProjectTokens(projectId)` | Project tokens waiting to become liquidity |
| `accumulatedTerminalTokens(projectId, terminalToken)` (`main`) / `accumulatedProjectCredits(projectId)` (`main`) | Bid-side ledger / credits pending tokenization |
| `hasDeployedPool(projectId)`, `isPoolDeployed(projectId, terminalToken)`, `tokenIdOf(projectId, terminalToken)` | Stage; `tokenId != 0` means the position exists |
| `poolKeyOf(projectId, terminalToken)` | `PoolKey` (all-zero before deploy) |
| `activeTickLowerOf/UpperOf(projectId, terminalToken)` | Live position range |
| `claimableFeeTokens(projectId)`, `claimableFeeCredits(projectId)`, `claimableFeeTokenOf(projectId)` | Fee-project proceeds claimable by the project owner |
| `feeProjectId()`, `feePercent()`, `buybackHook()`, `oracleHook()`, `poolManager()`, `positionManager()` | Clone config |
| `initialWeightOf(projectId)` | Weight snapshot used by the deployed auth gate |

Detect the hook by behavior, not address: read the reserved splits (`JBSplits.splitsOf(projectId, rulesetId, 1)`) and treat any `hook` that answers `accumulatedProjectTokens` and `hasDeployedPool` as an LP split hook (revnet.money `fetchSplitHookStates`).

## Production call patterns

```ts
// Deploy: pick the selector from bytecode, then simulate before sending.
const code = await client.getCode({ address: hook });
const single = code?.includes(toFunctionSelector("deployPool(uint256)").slice(2));
const { request } = await client.simulateContract(single
  ? { address: hook, abi: singleArgAbi, functionName: "deployPool", args: [projectId] }
  : { address: hook, abi: lpSplitHookAbi, functionName: "deployPool", args: [projectId, 0n] });
// 0n is safe on the deployed hook: it substitutes the 97%-of-rate floor.

// Collect fees (anyone):
await client.simulateContract({ address: hook, abi: lpSplitHookAbi,
  functionName: "collectAndRouteLPFees", args: [projectId, terminalToken] });
```

Wiring the split (reserved group):

```solidity
JBSplit({ percent: 200_000_000, projectId: 0, beneficiary: payable(address(0)),
          preferAddToBalance: false, lockedUntil: 0, hook: IJBSplitHook(0xe9493bc776699714a89aa982cf828d843f040d2a) })
```

Gate the deploy button on the deployed hook with `initialWeightOf(projectId) == 0 || ruleset.weight * 10 > initialWeight` → requires an operator with `SET_BUYBACK_POOL`.

## Indexing (bendystraw)

```graphql
buybackPools(where: { chainId, projectId, version: 6 }) { items { poolId } }
buybackPoolPositions(where: { chainId, poolId, burned: false }) {
  items { tokenId owner tickLower tickUpper liquidity feesClaimed0 feesClaimed1 updatedAt }
}
```

Positions are recorded only for pools registered as buyback pools (the hook's pool is the project's buyback pool when it shares the `JBUniswapV4Hook`). The hook-owned position has `owner == hook`. Arg types are `Float!`/`BigInt!` per the bendystraw skill.

## Common mistakes

- **Calling `deployPool(uint256)` on the deployed hook (or vice versa).** Different arity is a different selector; the call reverts in simulation with no data. Sniff the bytecode first.
- **Wiring the impl `0xfcdb…` or an old clone into a split.** Only `JBP6FeeLPSplitHook` (`0xe949…`) delegates to the fixed impl with the live fee config; earlier clones (`0xae67…`, `0x2298…`) delegate to buggy impls forever.
- **Pointing a reserved split at the hook on OP Sepolia.** No deployment there; the split reverts and its tokens are burned.
- **Putting the hook on a payout split.** `groupId != 1` reverts `TerminalTokensNotAllowed`; the terminal refunds the payout but nothing accumulates.
- **Expecting a treasury deposit from fees.** Fee remainders stay in the hook as future liquidity; only the fee project's cut leaves, and the resulting fee-project tokens sit in `claimableFeeTokens` until the owner calls `claimFeeTokensFor`.
- **Reading `context.token` to find the project token.** The hook resolves `JBTokens.tokenOf(projectId)`; on the deployed hook a project with no ERC-20 cannot accumulate at all.
- **Assuming `addLiquidity` succeeds whenever tokens accumulated.** Below `1e15` wei of project tokens it reverts; with spot pinned in the top spacing under the issuance ceiling (where arbitrage leaves a live buyback pool) the single-sided solver yields an empty range (`ZeroLiquidity` / `NoDeployableLiquidityAtSpot`); a cold oracle reverts `TwapUnavailable`.
- **Treating `rebalanceLiquidity` as a free re-center.** It reverts `DriftBelowThreshold` unless the corridor moved by more than one spacing, and it burns with a 95% principal floor.
- **Deriving `deployHookFor`'s address from the raw salt.** The clone salt is `keccak256(abi.encode(msg.sender, salt))`; a different caller lands on a different address.
- **Hard-coding a cash-out `minCashOutReturn` from a quote.** On the deployed hook the internal 97%-of-rate floor already applies; a tighter caller floor only adds `UnderMin` reverts when the rate moves between quote and execution.
