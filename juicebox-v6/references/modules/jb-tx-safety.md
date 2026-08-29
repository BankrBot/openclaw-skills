---
name: jb-tx-safety
description: |
  The transaction write boundary every Juicebox V6 webclient implements: review, simulate,
  floor, send, prove. Use when: (1) generating any UI that signs a Juicebox V6 write (pay,
  cash out, payouts, allowance, sucker prepare, LP, deploy), (2) deciding what min* floor to
  send and where it comes from, (3) choosing a gas limit for a wallet send, (4) reporting
  success or failure after a transaction, (5) building a multi-transaction flow with approval
  pre-steps, (6) auditing a client for floorless or blind-signed writes.
version: 6.0.0
---

# Juicebox V6 transaction write boundary

Source of truth: `juicebox-money/src/hooks/useSafeTx.ts`, `lib/transaction-review.ts`, `lib/gas.ts`,
`components/project/{PayPanel,CashOutFlow,FundsTab,MoveFlow,AddLiquidityFlow}.tsx`;
`revnet-money/src/hooks/useReviewedWriteContract.ts`; `juicescan/src/component-base.js` (`sendContractAndConfirm`), `src/gas.js`.
`@bananapus/nana-sdk-core/v6` supplies `slippageFloor`, `resolveCashOutRoute`, `cashOutProtocolFee`, `buildCashOutTx`.

Every write passes through one pipeline, in this order. No step is skippable.

| Step | What happens | Failure behavior |
|---|---|---|
| 1 Review | Encode the exact call once; show target, function, decoded args, native value | Cancel = nothing sent |
| 2 Re-verify | Connected account unchanged; re-encode and compare `to`/`data`/`value` to the reviewed bytes | Mismatch throws "review again" |
| 3 Simulate | `simulateContract` with `account` = connected address, immediately before the wallet prompt, pinned to the approval receipt block when one exists | Revert = action disabled, no prompt |
| 4 Gas | `estimateContractGas` bounded by any reviewed cap; send `min(2 × estimate, cap)` | Estimate fails = send the cap |
| 5 Send | `writeContract(simulation.request + gas)` — only the simulated request reaches the wallet | |
| 6 Prove | `receipt.status === 'success'` AND the operation's own evidence | Reverted = failed; timeout = pending |

## 1. Review step decodes calldata

`requireContractTransactionReview` (`lib/transaction-review.ts`) calls `encodeFunctionData({abi, functionName, args})` and hands the review UI `{chainId, to, data, value, from, abi, functionName, args}`. `TransactionReviewProvider.functionFromCall` resolves the ABI fragment by matching `toFunctionSelector(item) === data.slice(0, 10)` — the displayed function is the one the selector actually names, not the label the caller claimed. Each arg renders as `name type: value`; native value renders as `formatEther | wei`; the raw `data` and its byte length sit under the decoded view. After approval, the call is re-encoded and compared byte-for-byte to the reviewed bytes.

Rules:
- Display == signed. The review reads from the same encoded bytes the wallet gets. Never render a hand-built "mirror" of the args.
- Always show the full target address and native value in wei. Show a contract name only as an addition.
- Hidden pre-steps (ERC-20 approve, Permit2 approve, `setPermissionsFor`) get their own review titled "step N of M".

## 2. Simulate immediately before send, as the connected account

```ts
const request = { address, abi, functionName, args, value, account: address,
  ...(approvalBlock !== undefined ? { blockNumber: approvalBlock } : {}) }
const [{ request: simulated }, estimate] = await Promise.all([
  publicClient.simulateContract(request),
  publicClient.estimateContractGas(request),
])
```

- `account` is mandatory. A missing sender simulates as `address(0)`: ERC-20 pulls fail with `AllowanceExpired(0)` (`0xd81b2f2e`) or "transfer from the zero address" and look like contract bugs. With `simulateCalls`, the sender is the top-level `account`; a per-call `from` is ignored.
- Pin `blockNumber` to the approval receipt's `blockNumber` when a prerequisite write (ERC-20 or Permit2 approve) just confirmed. Load-balanced RPCs serve `latest` from a backend that has not seen the approval, and the simulation sees a stale allowance. juicescan and juicebox-money both anchor to the newest approval block; `PayPanel` also pins the allowance read to it.
- Re-run the reads a quote depends on before simulating; freeze the reviewed request; re-stamp only time fields (swap deadline).
- A simulation that reverts disables the action. It never falls through to a send with relaxed args.

## 3. Floors come from views and previews, not from the simulation result

A `min*` argument is an input to the simulation, so the simulation cannot produce it. The exception is a call whose own return value is the quote and whose min is only a drift guard (payouts, allowance) — there the quote is simulated with `min = 0` and the reviewed call is rebuilt with the enforced min through the same builder.

| Operation | Floor argument | Source | Floor |
|---|---|---|---|
| `pay` (direct) | `minReturnedTokens` | `JBMultiTerminal.previewPayFor(...)` → `beneficiaryTokenCount` | `preview × 99 / 100`; verified 0 stays 0 |
| `pay` (swap route) | `minReturnedTokens` | swap quote `minimumTokenCount` | quote's own protected minimum |
| `cashOutTokensOf` (treasury) | `minTokensReclaimed` | `previewCashOutFrom` → `reclaimAmount` net of REV/buyback hooks; then `net = reclaimAmount − cashOutProtocolFee` | `slippageFloor(net, bps)` = `net × (10000 − bps) / 10000`, min `1n`; default 100 bps |
| `cashOutTokensOf` (buyback pool) | `minTokensReclaimed = 0`; floor lives in hook metadata `minimumSwapAmountOut` | `resolveCashOutRoute` | `slippageFloor(quote)` inside metadata |
| `sendPayoutsOf` | `minTokensPaidOut` | simulate with `0`, `result` = `amountPaidOut` | exact quote when amount is in the token's own currency; `quote × 99 / 100` when a price feed converts |
| `useAllowanceOf` | `minTokensPaidOut` | simulate with `0`, `result` = `netAmountPaidOut` | `quote × 99 / 100` |
| Sucker `prepare` | `minTokensReclaimed` | `previewCashOutFrom(sucker, pid, amount, token, sucker, '0x')[1]` | `gross × 99 / 100`, clamped to `1n` when gross > 0 |
| LP mint (V4 `modifyLiquidities`) | `amount0Max` / `amount1Max` (ceilings) | range solver | `need + need / 100 + 1` |
| LP decrease / collect | `amount0Min` / `amount1Min` | displayed position amounts | `retainedFloor` = `× 9500 / 10000`, min `1n` |

Protocol fee on cash-out (`cashOutProtocolFee`): `0` when the beneficiary is feeless; `reclaimAmount / 40` when `cashOutTaxRate > 0`; otherwise `min(reclaimAmount, feeFreeSurplus) / 40`. The terminal checks `minTokensReclaimed` against the final net, so a floor derived from the gross reclaim reverts with `JBMultiTerminal_UnderMin`.

The number displayed as "you receive at least" is the stored floor the transaction sends. Compute once at review, store on the reviewed plan, read from it at send.

## 4. Gas headroom; a simulation cap is not a send limit

```ts
export function gasWithHeadroom(estimate: bigint) { return estimate * 2n }
export async function gasWithinCap(client, tx, cap?) {
  try {
    const estimate = await client.estimateGas({ ...tx, ...(cap === undefined ? {} : { gas: cap }) })
    const measured = gasWithHeadroom(estimate)
    return cap !== undefined && cap < measured ? cap : measured
  } catch { return cap }
}
```

- 2× headroom: terminal calls catch a failed internal fee payment and continue, so the estimator can measure the cheaper recovery path while the intended fee route needs more. Unused gas is not spent.
- Caps such as `TRANSACTION_SIMULATION_GAS = 10_000_000n` bound an `eth_call` against a target-controlled contract. Sending the cap makes the wallet reserve `cap × maxFeePerGas` and reject accounts that can afford the real cost several times over. Estimate inside the cap, send `min(2 × estimate, cap)`, send the cap only when the node cannot estimate.
- Safe connections send `gas: 0n` (Safe Apps maps it to `safeTxGas`); the bounded preflight still runs.

## 5. Verified zero vs unavailable preview

| Preview outcome | Meaning | UI |
|---|---|---|
| Returns a value > 0 | Real quote | Floor derived from it; action enabled |
| Returns exactly 0 (issuance 0, nothing reclaimable) | Real zero | Show "You get 0"; `pay` may proceed with floor 0; cash-out throws "Nothing to reclaim" and disables |
| Reverts (`REVOwner_CashOutDelayNotFinished` `0xbefe7856`, `JBMultiTerminal_TokenNotAccepted`, dead route with `ruleset.id == 0`) | Unavailable | Action disabled; the write would revert too |
| Pending, stale, or `isPlaceholderData` | Unavailable | Action disabled; never read a placeholder into a tx |

`payMinTokens(preview, bps)` returns 0 only when the preview is missing — that is the guarded case, and submit blocks on it. react-query applies `placeholderData` to pending queries even when `enabled: false`; gate tx paths on `!isPlaceholderData && !isError && !isLoading` and freeze reviewed values into the plan.

## 6. Proof of success

`receipt.status === 'success'` is necessary, not sufficient. Each operation adds its own evidence before reporting success.

| Operation | Evidence |
|---|---|
| Launch project | `projectIdFromReceipt(receipt)` from launch logs; missing id = phase `uncertain`, "do not submit again" |
| Deploy payer / hook / sucker | New address parsed from the deploy event in `receipt.logs` (a tx has no return value) |
| Pay | Receipt success; refetch balances and preview at `receipt.blockNumber` |
| Approve | Receipt success, then allowance re-read at `receipt.blockNumber` ≥ amount |
| LP mint | Receipt success; position id from logs |

Pending is not failed. `waitForTransactionReceipt` giving up (~5 min) or receipt tracking erroring leaves the flow in `pending` with the hash, submit stays disabled, and the message says "do NOT send it again". Only `status === 'reverted'` produces "Transaction reverted onchain. No state changes were applied."

## 7. Multi-transaction flows and approval pre-steps

Resolve the step queue at review time: read ERC-20 allowance, Permit2 allowance, and `JBPermissions.hasPermission` during `prepare`/`buildPlan`, store the exact step list on the reviewed plan, and render it (`TxSteps`) before the first wallet prompt. A queue discovered mid-run forces a dishonest "already done" state.

| Flow | Approval target | Then |
|---|---|---|
| ERC-20 `pay` direct | `approve(JBMultiTerminal, amount)` | `pay` |
| ERC-20 `pay` via `JBRouterTerminalRegistry` | `approve(registry, amount)` — the registry checks plain ERC-20 allowance first and pulls with `safeTransferFrom` | `registry.pay` |
| Direct AMM swap into pay | `approve(Permit2, max)` + Permit2 signature (~30 min validity; dropped from the completed set on any retry) | swap |
| LP mint | `approve(Permit2, max)` then `Permit2.approve(token, PositionManager, amount, expiration)` | `modifyLiquidities` |
| Sucker `prepare` | project token `approve(sucker, amount)` | `prepare` |
| REVLoans borrow | `JBPermissions.setPermissionsFor` granting `BURN_TOKENS` to REVLoans | `borrowFrom` |

Each pre-step is its own reviewed, simulated, proven transaction. Its receipt block becomes the `blockNumber` pin for the next simulation. Safe connections stop after proposing each step ("Execute it there before continuing").

## 8. Minimal viem boundary

```js
import { createPublicClient, createWalletClient, custom, http, encodeFunctionData, decodeFunctionData, formatEther } from 'viem'
import { waitForSuccess } from '/references/shared/wallet-utils.js'

// Reviewed call: { address, abi, functionName, args, value }. floor: the stored min the UI displayed.
export async function sendReviewed(publicClient, walletClient, account, call, { approvalBlock, cap, prove } = {}) {
  if (typeof prove !== 'function') throw new Error('Operation-specific event/post-state proof is required before sending.')
  // 1 Review — decode the exact bytes the wallet will sign.
  const data = encodeFunctionData(call)
  const decoded = decodeFunctionData({ abi: call.abi, data })
  const ok = window.confirm(
    `To: ${call.address}\nFunction: ${decoded.functionName} (${data.slice(0, 10)})\n` +
    `Args: ${JSON.stringify(decoded.args, (_, v) => typeof v === 'bigint' ? v.toString() : v)}\n` +
    `Value: ${formatEther(call.value ?? 0n)} ETH (${(call.value ?? 0n).toString()} wei)`)
  if (!ok) throw new Error('Review closed. Nothing was sent.')

  // 2 Re-verify — same account, same bytes.
  const [live] = await walletClient.getAddresses()
  if (live.toLowerCase() !== account.toLowerCase()) throw new Error('Connected account changed. Review again.')
  if (encodeFunctionData(call) !== data) throw new Error('Transaction data changed after review.')

  // 3 Simulate as the sender, pinned to the approval block when one exists.
  const request = { ...call, account, ...(approvalBlock !== undefined ? { blockNumber: approvalBlock } : {}) }
  const { request: simulated } = await publicClient.simulateContract(request)

  // 4 Gas: 2x estimate, bounded by the cap; the cap itself only when estimation fails.
  let gas
  try {
    const estimate = await publicClient.estimateContractGas({ ...request, ...(cap ? { gas: cap } : {}) })
    gas = cap && cap < estimate * 2n ? cap : estimate * 2n
  } catch { gas = cap }

  // 5 Send only the simulated request.
  const hash = await walletClient.writeContract({ ...simulated, gas })

  // 6 Prove: status + operation evidence. A wait timeout is pending, not failed.
  let receipt
  try { receipt = await waitForSuccess(publicClient, hash, { prove }) }
  catch (e) {
    if (/timeout|not found|pending/i.test(e.message)) return { hash, phase: 'pending' }
    if (/completion proof|post-state proof/i.test(e.message)) return { hash, phase: 'uncertain' }
    throw e
  }
  return { hash, receipt, phase: 'confirmed' }
}

// Floor helpers — from previews, never from the simulation.
export const floorBps = (quoted, bps = 100n) => quoted <= 0n ? 0n : (q => q > 0n ? q : 1n)(quoted * (10_000n - bps) / 10_000n)
export const cashOutNet = (reclaim, taxRate, feeless = false) => feeless || taxRate === 0n ? reclaim : reclaim - reclaim / 40n
```

`prove` examples: `r => r.logs.some(l => l.address.toLowerCase() === terminal.toLowerCase())` for pay; parse the deploy event for a new address; re-read allowance at `r.blockNumber` for approvals.

## Common mistakes

| Mistake | Consequence | Fix |
|---|---|---|
| `minReturnedTokens: 0n` when the preview is null, pending, or zero | Floorless trade; sandwich leaves the user with ~0 while UI promised X | Block submit until a positive, user-approved floor exists; a zero preview fails closed |
| Floor from `currentReclaimableSurplusOf` (gross) | `JBMultiTerminal_UnderMin` — the check is against net of hooks and the 2.5% fee | `previewCashOutFrom` → subtract `cashOutProtocolFee` → `slippageFloor` |
| Deriving a max/min from the simulation result | Circular; partial application lets allowance pass below what the send pulls | Reproduce the contract's own view arithmetic; simulation is the check |
| Sending the eth_call gas cap as the wallet gas limit | Wallet demands `cap × maxFeePerGas`; funded accounts see "insufficient funds" | `gasWithinCap`: `min(2 × estimate, cap)` |
| `simulateCalls` with per-call `from` | Runs as `address(0)`; `AllowanceExpired(0)` looks like a contract bug | Top-level `account` |
| Simulating at `latest` right after an approval | Stale allowance on a load-balanced RPC | Pin `blockNumber` to the approval receipt |
| Reporting success on a bare receipt | Reverted tx shown as confirmed | `receipt.status === 'success'` + evidence |
| Re-enabling submit after a receipt-wait timeout | Double payment | Keep `pending` with the hash; disable retry |
| Reading a placeholder quote into a tx | Old `minimumTokenCount` sent with a new amount, dropped metadata | Gate on `isPlaceholderData`; freeze reviewed values |
| Approving Permit2 for a direct ERC-20 pay | Terminal pulls via `transferFrom`; Permit2 allowance is unused | Approve the terminal (or registry for router pays) |
| Confirm modal shows a hand-built arg summary | Display can drift from signed bytes | Decode `data` by selector; compare bytes after approval |
| Discovering approval steps mid-run | Step viewer lies about the sequence | Resolve the queue at review time |
