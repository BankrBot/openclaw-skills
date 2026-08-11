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
| Payout splits | `JBMultiTerminal` (during `sendPayoutsOf` / surplus allowance) | The payout token (ERC-20 or native) | `uint256(uint160(token))` |
| Reserved token splits | `JBController` (during `sendReservedTokensToSplitsOf`) | The project's ERC-20 token, or `address(0)` if only credits exist | `1` (`JBSplitGroupIds.RESERVED_TOKENS`) |

## Interface

```solidity
interface IJBSplitHook is IERC165 {
    function processSplitWith(JBSplitHookContext calldata context) external payable;
}
```

`supportsInterface(type(IJBSplitHook).interfaceId)` must return `true` — the terminal reverts the payout with `JBMultiTerminal_SplitHookInvalid` if it doesn't.

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

- **Fee**: non-feeless hooks receive the net amount after the standard 2.5% fee (`STANDARD_FEE / MAX_FEE` = 25/1000). Register the hook in `JBFeelessAddresses` to receive gross.
- **Native token**: pushed as `msg.value` on the `processSplitWith` call. A successful call consumes the full amount.
- **ERC-20**: the terminal grants the hook an allowance for `context.amount`; the hook pulls via `transferFrom`. **Partial consumption is allowed** — whatever the hook doesn't pull is revoked and refunded to the project's balance proportionally (gross, including the fee share).
- **Reverts are swallowed**: the call is wrapped in try/catch. A reverting hook moves no funds; the full gross amount returns to the project balance. The payout transaction itself succeeds.

### Reserved token splits (JBController)

- **Project has an ERC-20**: the controller grants the hook an allowance for the split's token count; the hook pulls via `transferFrom`. Any allowance left after the call is revoked and the unconsumed tokens are **burned**.
- **Project has only credits** (`context.token == address(0)`): credits are transferred directly to the hook via `JBTokens.transferCreditsFrom` before the call — no allowance mechanism exists for credits.
- **Reverts are swallowed**: try/catch with a `SplitHookReverted` event; distribution of other splits continues.

## Basic hook skeleton

```solidity
contract MySplitHook is IJBSplitHook, ERC165 {
    function processSplitWith(JBSplitHookContext calldata context) external payable override {
        // Optionally restrict callers to known terminals/controller for the project.

        if (context.token == JBConstants.NATIVE_TOKEN) {
            // Native: funds arrived as msg.value.
            // ... custom logic with msg.value
        } else if (context.token != address(0)) {
            // ERC-20: pull from the caller's allowance.
            IERC20(context.token).transferFrom(msg.sender, address(this), context.amount);
            // ... custom logic
        } else {
            // Reserved-token credits: already transferred to this contract.
            // ... custom logic
        }
    }

    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
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
- **BannyLPSplitHook** — project-specific LP split hook (address in `references/shared/chain-config.json`)

## Common mistakes

- **Checking `context.token == address(0)` for native.** Native is `JBConstants.NATIVE_TOKEN` (`0x…EEEe`). `address(0)` means reserved-token credits.
- **Waiting for a push transfer of ERC-20s.** Payout and reserved ERC-20 amounts arrive as an allowance from `msg.sender`; the hook must `transferFrom` during `processSplitWith`.
- **Not pulling reserved ERC-20 tokens.** Unconsumed reserved-token allowance is burned, not returned — a hook that forgets to pull destroys the distribution.
- **Missing `supportsInterface`.** Payout splits hard-revert on hooks that don't report `IJBSplitHook` support.
- **Expecting a hook revert to block the distribution.** Both callers swallow hook reverts; payouts refund to the project balance and reserved distributions continue past the failed split.
- **Forgetting the payout fee.** A non-feeless hook receives `amount` net of the 2.5% fee; add the hook to `JBFeelessAddresses` if the funds stay in the ecosystem.
- **Using `uint256` sizes for `JBSplit` fields.** `percent` is `uint32`, `projectId` is `uint64`, `lockedUntil` is `uint48` — encode configs accordingly.
