---
name: jb-split-hook
description: |
  Write custom Juicebox split hooks. Use when: (1) transforming tokens before
  forwarding (swap, LP deposit), (2) integrating payouts with DeFi protocols,
  (3) multi-recipient routing beyond native splits, (4) custom handling of
  reserved token distributions. Covers IJBSplitHook, JBSplitHookContext, the
  allowance-pull delivery model, partial consumption, fees, and the differences
  between payout splits and reserved token splits.
version: 6.0.0
---

# Split Hook Generator

A split hook receives a split's funds and runs custom logic. It is set as the `hook` field of a `JBSplit`. Split hooks fire in two flows:

| Flow | Caller | Token | Group ID |
|------|--------|-------|----------|
| Payout splits | `JBMultiTerminal` (during `sendPayoutsOf` only; `useAllowanceOf` pays its beneficiary directly and never touches splits) | The payout token (ERC-20 or native) | `uint256(uint160(token))` |
| Reserved token splits | `JBController` (during `sendReservedTokensToSplitsOf`) | The project's ERC-20 token, or `address(0)` if only credits exist | `1` (`JBSplitGroupIds.RESERVED_TOKENS`) |

## Interface

```solidity
interface IJBSplitHook is IERC165 {
    function processSplitWith(JBSplitHookContext calldata context) external payable;
}
```

`supportsInterface(type(IJBSplitHook).interfaceId)` must return `true`. If it doesn't, `executePayout` reverts with `JBMultiTerminal_SplitHookInvalid`; that revert is caught per split by `JBPayoutSplitGroupLib` (`PayoutReverted` event), the split's amount returns to the project balance, and the other splits and the transaction proceed. With OpenZeppelin `ERC165` the override list must be `override(ERC165, IERC165)`.

## JBSplitHookContext (fields in ABI order)

| Field | Type | Meaning |
|-------|------|---------|
| `token` | `address` | Token being distributed. Native is `JBConstants.NATIVE_TOKEN` (`0x000000000000000000000000000000000000EEEe`), never `address(0)`. For reserved token splits: the project's ERC-20, or `address(0)` when the project has no ERC-20 and distributes credits |
| `amount` | `uint256` | Amount offered to the hook (net of fee for non-feeless hooks on payouts) |
| `decimals` | `uint256` | Token decimals. From the terminal's accounting context for payouts; hard-coded `18` for reserved tokens |
| `projectId` | `uint256` | Project distributing funds |
| `groupId` | `uint256` | `uint256(uint160(token))` for payouts, `1` for reserved tokens |
| `split` | `JBSplit` | The split configuration that named this hook |

## JBSplit (fields in ABI order)

| Field | Type | Meaning |
|-------|------|---------|
| `percent` | `uint32` | Share of the total, out of `JBConstants.SPLITS_TOTAL_PERCENT` (1,000,000,000) |
| `projectId` | `uint64` | Project to pay if no hook (0 = pay `beneficiary` directly) |
| `beneficiary` | `address payable` | Recipient when hook and projectId are zero; receives minted tokens when paying a project |
| `preferAddToBalance` | `bool` | Use `addToBalance` instead of `pay` when routing to a project |
| `lockedUntil` | `uint48` | Split can't be edited within the same split table until this timestamp |
| `hook` | `IJBSplitHook` | This split hook |

Routing priority: `hook` > `projectId` > `beneficiary`.

## Fund delivery: allowance pull, not optimistic push

### Payout splits (JBMultiTerminal)

- **Fee**: non-feeless hooks receive the net amount after the standard 2.5% fee (`STANDARD_FEE / MAX_FEE` = 25/1000). Only the protocol owner can mark an address feeless (`JBFeelessAddresses` setters are `onlyOwner`); design for the net. The held fee scales with what the hook consumed (`amount * sent / netPayoutAmount`), rounded down to a multiple of 40 per split.
- **Native token**: pushed as `msg.value` on the `processSplitWith` call. Consumption is all-or-nothing: a successful call consumes the full amount; a revert consumes nothing.
- **ERC-20**: the terminal grants the hook an allowance for `context.amount`; the hook pulls via `transferFrom`. **Partial consumption is allowed** — whatever the hook doesn't pull is revoked and refunded to the project's balance proportionally (gross, including the fee share).
- **Reverts are swallowed**: the call is wrapped in try/catch. A reverting hook moves no funds; the full gross amount returns to the project balance. The payout transaction itself succeeds.

### Reserved token splits (JBController)

- **Project has an ERC-20**: the controller grants the hook an allowance for the split's token count; the hook pulls via `transferFrom`. Any allowance left after the call is revoked and the unconsumed tokens are **burned**.
- **Project has only credits** (`context.token == address(0)`): credits are transferred directly to the hook via `JBTokens.transferCreditsFrom` before the call — no allowance mechanism exists for credits.
- **Reverts are swallowed**: try/catch with a `SplitHookReverted` event; distribution of other splits continues. For the credits case the credits were already pushed before the call and the catch does not undo that — a reverting hook keeps the credits (they are neither burned nor returned). For the ERC-20 case a revert rolls back the pull and the unconsumed allowance is burned.

## Basic hook skeleton

Compiles as-is against nana-core-v6 with solc 0.8.28. Caller validation is required, not optional: both reference hooks enforce it (`JBSwapSplitHook` requires `DIRECTORY.isTerminalOf`; `JBUniswapV4LPSplitHook` requires the controller, `groupId == 1`, `context.split.hook == this`, `msg.value == 0`). Without it anyone can call `processSplitWith` with a fabricated context and, on the ERC-20 branch, drain any allowance the hook holds from an arbitrary `msg.sender`. `sendPayoutsOf` and `sendReservedTokensToSplitsOf` have no reentrancy guard, so use `nonReentrant`.

```solidity
import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IJBDirectory} from "@bananapus/core-v6/src/interfaces/IJBDirectory.sol";
import {IJBSplitHook} from "@bananapus/core-v6/src/interfaces/IJBSplitHook.sol";
import {IJBTerminal} from "@bananapus/core-v6/src/interfaces/IJBTerminal.sol";
import {JBConstants} from "@bananapus/core-v6/src/libraries/JBConstants.sol";
import {JBSplitGroupIds} from "@bananapus/core-v6/src/libraries/JBSplitGroupIds.sol";
import {JBSplitHookContext} from "@bananapus/core-v6/src/structs/JBSplitHookContext.sol";

contract MySplitHook is IJBSplitHook, ERC165, ReentrancyGuard {
    error HookMismatch();
    error InvalidCaller();
    error UnexpectedMsgValue();

    IJBDirectory public immutable DIRECTORY;

    constructor(IJBDirectory directory) {
        DIRECTORY = directory;
    }

    function processSplitWith(JBSplitHookContext calldata context) external payable override nonReentrant {
        // Required: the context must name this hook, and the caller must be the project's terminal (payouts) or
        // controller (reserved tokens). Without this anyone can call with a fabricated context.
        if (address(context.split.hook) != address(this)) revert HookMismatch();

        if (context.groupId == JBSplitGroupIds.RESERVED_TOKENS) {
            if (address(DIRECTORY.controllerOf(context.projectId)) != msg.sender) revert InvalidCaller();
            if (msg.value != 0) revert UnexpectedMsgValue();
        } else if (!DIRECTORY.isTerminalOf({projectId: context.projectId, terminal: IJBTerminal(msg.sender)})) {
            revert InvalidCaller();
        }

        if (context.token == JBConstants.NATIVE_TOKEN) {
            // Native: funds arrived as msg.value.
            // ... custom logic with msg.value
        } else if (context.token != address(0)) {
            // ERC-20: pull from the caller's allowance.
            SafeERC20.safeTransferFrom({
                token: IERC20(context.token), from: msg.sender, to: address(this), value: context.amount
            });
            // ... custom logic
        } else {
            // Reserved-token credits: already transferred to this contract.
            // ... custom logic
        }
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC165, IERC165) returns (bool) {
        return interfaceId == type(IJBSplitHook).interfaceId || super.supportsInterface(interfaceId);
    }
}
```

## Configuring a split with a hook

```solidity
JBSplit({
    percent: 100_000_000, // 10% of SPLITS_TOTAL_PERCENT (1_000_000_000)
    projectId: 0,
    beneficiary: payable(address(0)),
    preferAddToBalance: false,
    lockedUntil: 0,
    hook: IJBSplitHook(address(mySplitHook))
})
```

Splits are set per `(projectId, rulesetId, groupId)` in `JBSplits`, normally via the controller when queueing rulesets (`JBSplitGroup { groupId, splits }`).

## Reference implementations

- **univ4-lp-split-hook-v6** (`JBUniswapV4LPSplitHook`, address in `references/shared/chain-config.json`) — routes a reserved token split into a Uniswap v4 LP position
- **JBP6FeeLPSplitHook** — the Banny project’s LP split hook (fee project 1, 20%) (address in `references/shared/chain-config.json`)

## Common mistakes

- **Checking `context.token == address(0)` for native.** Native is `JBConstants.NATIVE_TOKEN` (`0x…EEEe`). `address(0)` means reserved-token credits.
- **Waiting for a push transfer of ERC-20s.** Payout and reserved ERC-20 amounts arrive as an allowance from `msg.sender`; the hook must `transferFrom` during `processSplitWith`.
- **Not pulling reserved ERC-20 tokens.** Unconsumed reserved-token allowance is burned, not returned — a hook that forgets to pull destroys the distribution.
- **Missing `supportsInterface`.** A payout split to a hook that doesn't report `IJBSplitHook` support is skipped (`PayoutReverted`, amount refunded to the project); nothing hard-reverts, so the failure is silent.
- **Skipping caller validation.** Check `context.split.hook == this` plus `DIRECTORY.isTerminalOf` (payouts) or `DIRECTORY.controllerOf` (reserved tokens); otherwise anyone can trigger the hook with a fabricated context.
- **Expecting a hook revert to block the distribution.** Both callers swallow hook reverts; payouts refund to the project balance and reserved distributions continue past the failed split — but reserved credits already pushed to a reverting hook stay with the hook.
- **Forgetting the payout fee.** A non-feeless hook receives `amount` net of the 2.5% fee; only the protocol owner can add an address to `JBFeelessAddresses`.
- **Using `uint256` sizes for `JBSplit` fields.** `percent` is `uint32`, `projectId` is `uint64`, `lockedUntil` is `uint48` — encode configs accordingly.
