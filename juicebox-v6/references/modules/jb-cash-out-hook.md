---
name: jb-cash-out-hook
description: |
  Write custom Juicebox cash out hooks. Use when: (1) reclaim value must come from
  a custom calculation (not the default surplus bonding curve), (2) cash outs need
  restrictions or conditions, (3) cash out interacts with external protocols,
  (4) omnichain supply must be considered when pricing cash outs. Covers
  IJBRulesetDataHook's beforeCashOutRecordedWith (5 return values), IJBCashOutHook,
  context structs, fees on forwarded amounts, and access control.
version: 6.0.0
---

# Cash Out Hook Generator

Custom cash out hooks extend a terminal's `cashOutTokensOf(...)` flow. Before writing one, check the off-the-shelf options:

| Need | Use instead |
|------|-------------|
| Simple bonding curve | The ruleset's native `cashOutTaxRate` (0–10,000, `JBConstants.MAX_CASH_OUT_TAX_RATE`) — no hook needed |
| Burn NFTs to reclaim funds | `JB721TiersHook` (nana-721-hook-v6) — prices cash outs by NFT cash-out weight |
| Cash out through an AMM when it pays better | `JBBuybackHook` (nana-buyback-hook-v6) |
| Autonomous treasury with cash out fees | Revnet via `REVDeployer` (revnet-core-v6) |

## Architecture: two stages

| Stage | Interface | Function | Called when |
|-------|-----------|----------|-------------|
| 1. Data hook | `IJBRulesetDataHook` | `beforeCashOutRecordedWith` (view) | Before the cash out is recorded, if the ruleset has `useDataHookForCashOut = true` and a non-zero `dataHook` |
| 2. Cash out hook | `IJBCashOutHook` | `afterCashOutRecordedWith` (payable) | After recording, once per `JBCashOutHookSpecification` the data hook returned |

Both extend `IERC165`; with OpenZeppelin `ERC165` the override list must be `override(ERC165, IERC165)`. `beforeCashOutRecordedWith` is `view` and reached via `staticcall` — state writes inside it revert the cash out.

## beforeCashOutRecordedWith — 5 return values

```solidity
function beforeCashOutRecordedWith(JBBeforeCashOutRecordedContext calldata context)
    external
    view
    returns (
        uint256 cashOutTaxRate,        // rate for the bonding curve, out of 10_000
        uint256 effectiveCashOutCount, // token count used for PRICING; the terminal still
                                       // burns the caller-supplied count
        uint256 effectiveTotalSupply,  // supply used for pricing; include other chains'
                                       // supply for omnichain projects so the tax can't be bypassed
        uint256 effectiveSurplusValue, // surplus for the bonding curve, in the same token/
                                       // decimals/currency as context.surplus (which already IS the
                                       // local surplus of the reclaim token); reclaim + spec amounts
                                       // must fit in that local surplus or the store reverts
                                       // JBTerminalStore_InadequateTerminalStoreBalance
        JBCashOutHookSpecification[] memory hookSpecifications
    );
```

## Context structs (fields in ABI order)

### JBBeforeCashOutRecordedContext

| Field | Type | Meaning |
|-------|------|---------|
| `terminal` | `address` | Terminal facilitating the cash out |
| `holder` | `address` | Holder of the tokens being cashed out |
| `projectId` | `uint256` | Project cashing out |
| `rulesetId` | `uint256` | Ruleset the cash out is made during |
| `cashOutCount` | `uint256` | Tokens to cash out (18-decimal fixed point) |
| `totalSupply` | `uint256` | Total supply used for the calculation (18-decimal fixed point) |
| `surplus` | `JBTokenAmount` | Surplus used for the calculation (token, decimals, currency, value) |
| `scopeCashOutsToLocalBalances` | `bool` | If `true`, omnichain hooks should use only local-chain balances (skip cross-chain aggregation) |
| `cashOutTaxRate` | `uint256` | Ruleset's tax rate, out of `MAX_CASH_OUT_TAX_RATE` |
| `beneficiaryIsFeeless` | `bool` | Whether the beneficiary is a feeless address — hooks charging their own fees can skip them when value stays in the protocol |
| `metadata` | `bytes` | Casher-supplied metadata |

### JBAfterCashOutRecordedContext

| Field | Type | Meaning |
|-------|------|---------|
| `holder` | `address` | Token holder cashing out |
| `projectId` | `uint256` | Project ID |
| `rulesetId` | `uint256` | Ruleset ID |
| `cashOutCount` | `uint256` | Project tokens cashed out |
| `reclaimedAmount` | `JBTokenAmount` | Amount reclaimed from the terminal balance |
| `forwardedAmount` | `JBTokenAmount` | Amount forwarded to this hook |
| `cashOutTaxRate` | `uint256` | Tax rate used, out of 10,000 |
| `beneficiary` | `address payable` | Recipient of the reclaimed amount |
| `hookMetadata` | `bytes` | `metadata` from this hook's specification |
| `cashOutMetadata` | `bytes` | Casher-supplied metadata |

### JBCashOutHookSpecification

| Field | Type | Meaning |
|-------|------|---------|
| `hook` | `IJBCashOutHook` | Hook to call |
| `noop` | `bool` | If `true`, the terminal skips the hook call — informational only |
| `amount` | `uint256` | Amount forwarded to the hook **in addition to** the beneficiary's reclaim; debited from the project balance |
| `metadata` | `bytes` | Passed to the hook as `hookMetadata` |

## Spec amounts are additive, not carved out of the reclaim

`JBTerminalStore.recordCashOutFor` computes `reclaimAmount` from the bonding curve (`JBCashOuts.cashOutFrom(effectiveSurplusValue, effectiveCashOutCount, effectiveTotalSupply, cashOutTaxRate)`), then debits `reclaimAmount + Σ spec.amount` from the project balance. The terminal pays the full `reclaimAmount` to the beneficiary and then forwards each `spec.amount` to its hook. Returning `amount: X` without changing the pricing inputs pays out `reclaim + X`.

To redirect a share of the reclaim to the hook, shrink the curve output and request the difference:

```solidity
uint256 full = JBCashOuts.cashOutFrom({
    surplus: context.surplus.value,
    cashOutCount: context.cashOutCount,
    totalSupply: context.totalSupply,
    cashOutTaxRate: context.cashOutTaxRate
});
uint256 hookShare = full / 10; // 10% to the hook
// The curve is linear in surplus, so scaling surplus scales the beneficiary's reclaim.
effectiveSurplusValue = context.surplus.value * 9 / 10;
hookSpecifications[0].amount = hookShare; // total debit stays == full
```

## Fees on forwarded amounts

`JBMultiTerminal` charges the standard 2.5% protocol fee (`JBConstants.STANDARD_FEE / MAX_FEE` = 25/1000) on amounts forwarded to cash out hooks, unless `JBFeelessAddresses.isFeelessFor(hook, projectId, caller)` is true (global flag, per-project flag, or a pluggable feeless hook). All three are set by the protocol owner (`onlyOwner`); a hook builder cannot self-register, so design for the net. The hook receives `specification.amount - fee`; `forwardedAmount.value` reflects the net amount.

## Fund delivery

Same discipline as pay hooks:

- **Native token** (`JBConstants.NATIVE_TOKEN` = `0x000000000000000000000000000000000000EEEe`): sent as `msg.value` on `afterCashOutRecordedWith`.
- **ERC-20**: temporary allowance granted to the hook; the hook MUST `transferFrom` the full forwarded amount during the call (`SafeERC20.safeTransferFrom`) or the whole cash out reverts with `JBMultiTerminal_TemporaryAllowanceNotConsumed`.
- **Reentrancy**: `cashOutTokensOf` has no reentrancy guard; the hook runs after tokens are burned and the beneficiary is paid, and may reenter the terminal. Add `nonReentrant` when the hook holds state or funds.

## Access control (required)

```solidity
function afterCashOutRecordedWith(JBAfterCashOutRecordedContext calldata context) external payable override {
    if (
        !DIRECTORY.isTerminalOf({projectId: PROJECT_ID, terminal: IJBTerminal(msg.sender)})
            || context.projectId != PROJECT_ID
    ) revert InvalidCashOut();

    uint256 expected =
        context.forwardedAmount.token == JBConstants.NATIVE_TOKEN ? context.forwardedAmount.value : 0;
    if (msg.value != expected) revert InvalidCashOutValue();

    if (context.forwardedAmount.token != JBConstants.NATIVE_TOKEN && context.forwardedAmount.value != 0) {
        SafeERC20.safeTransferFrom({
            token: IERC20(context.forwardedAmount.token),
            from: msg.sender,
            to: address(this),
            value: context.forwardedAmount.value
        });
    }

    // Custom logic here.
}
```

## Full data hook + cash out hook skeleton

Compiles as-is against nana-core-v6 with solc 0.8.28.

```solidity
import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IJBCashOutHook} from "@bananapus/core-v6/src/interfaces/IJBCashOutHook.sol";
import {IJBDirectory} from "@bananapus/core-v6/src/interfaces/IJBDirectory.sol";
import {IJBRulesetDataHook} from "@bananapus/core-v6/src/interfaces/IJBRulesetDataHook.sol";
import {IJBTerminal} from "@bananapus/core-v6/src/interfaces/IJBTerminal.sol";
import {JBConstants} from "@bananapus/core-v6/src/libraries/JBConstants.sol";
import {JBAfterCashOutRecordedContext} from "@bananapus/core-v6/src/structs/JBAfterCashOutRecordedContext.sol";
import {JBBeforeCashOutRecordedContext} from "@bananapus/core-v6/src/structs/JBBeforeCashOutRecordedContext.sol";
import {JBBeforePayRecordedContext} from "@bananapus/core-v6/src/structs/JBBeforePayRecordedContext.sol";
import {JBCashOutHookSpecification} from "@bananapus/core-v6/src/structs/JBCashOutHookSpecification.sol";
import {JBPayHookSpecification} from "@bananapus/core-v6/src/structs/JBPayHookSpecification.sol";
import {JBRuleset} from "@bananapus/core-v6/src/structs/JBRuleset.sol";

contract MyCashOutHook is IJBRulesetDataHook, IJBCashOutHook, ERC165 {
    error InvalidCashOut();
    error InvalidCashOutValue();

    IJBDirectory public immutable DIRECTORY;
    uint256 public immutable PROJECT_ID;

    constructor(IJBDirectory directory, uint256 projectId) {
        DIRECTORY = directory;
        PROJECT_ID = projectId;
    }

    function beforeCashOutRecordedWith(JBBeforeCashOutRecordedContext calldata context)
        external
        view
        override
        returns (
            uint256 cashOutTaxRate,
            uint256 effectiveCashOutCount,
            uint256 effectiveTotalSupply,
            uint256 effectiveSurplusValue,
            JBCashOutHookSpecification[] memory hookSpecifications
        )
    {
        // Custom pricing logic; defaults shown.
        cashOutTaxRate = context.cashOutTaxRate;
        effectiveCashOutCount = context.cashOutCount;
        effectiveTotalSupply = context.totalSupply;
        effectiveSurplusValue = context.surplus.value;

        hookSpecifications = new JBCashOutHookSpecification[](1);
        hookSpecifications[0] = JBCashOutHookSpecification({
            hook: IJBCashOutHook(address(this)),
            noop: false,
            amount: 0, // debited from the project balance ON TOP of the beneficiary's reclaim (see below)
            metadata: ""
        });
    }

    function afterCashOutRecordedWith(JBAfterCashOutRecordedContext calldata context) external payable override {
        if (
            !DIRECTORY.isTerminalOf({projectId: PROJECT_ID, terminal: IJBTerminal(msg.sender)})
                || context.projectId != PROJECT_ID
        ) revert InvalidCashOut();

        uint256 expected =
            context.forwardedAmount.token == JBConstants.NATIVE_TOKEN ? context.forwardedAmount.value : 0;
        if (msg.value != expected) revert InvalidCashOutValue();

        if (context.forwardedAmount.token != JBConstants.NATIVE_TOKEN && context.forwardedAmount.value != 0) {
            SafeERC20.safeTransferFrom({
                token: IERC20(context.forwardedAmount.token),
                from: msg.sender,
                to: address(this),
                value: context.forwardedAmount.value
            });
        }

        // Custom logic here.
    }

    // Pass-through: not handling payments.
    function beforePayRecordedWith(JBBeforePayRecordedContext calldata context)
        external
        view
        override
        returns (uint256 weight, JBPayHookSpecification[] memory hookSpecifications)
    {
        return (context.weight, new JBPayHookSpecification[](0));
    }

    function hasMintPermissionFor(uint256, JBRuleset memory, address) external pure override returns (bool) {
        return false;
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC165, IERC165) returns (bool) {
        return interfaceId == type(IJBRulesetDataHook).interfaceId || interfaceId == type(IJBCashOutHook).interfaceId
            || super.supportsInterface(interfaceId);
    }
}
```

## Wiring the hook to a project

Set in the ruleset metadata: `dataHook` = hook address, `useDataHookForCashOut = true` (and `useDataHookForPay = true` only if it also handles payments).

## Metadata conventions

Parse casher metadata with `JBMetadataResolver` (nana-core-v6), keyed by purpose + target. `JB721TiersHook` decodes the NFT token IDs to burn this way:

```solidity
(bool found, bytes memory data) = JBMetadataResolver.getDataFor({
    id: JBMetadataResolver.getId({purpose: "cashOut", target: address(this)}),
    metadata: context.metadata
});
uint256[] memory tokenIds;
if (found) tokenIds = abi.decode(data, (uint256[]));
```

Casher side: `JBMetadataResolver.createMetadata(ids, datas)` / `addToMetadata(metadata, id, data)` with `id = getId("cashOut", target)` — for `JB721TiersHook` the target is `hook.METADATA_ID_TARGET()` and the payload is `abi.encode(uint256[] tokenIds)`; for your own hook use `getId("cashOut", address(hook))` and any `abi.encode` shape.

## Reference implementations

- **nana-721-hook-v6** (`src/abstract/JB721Hook.sol`) — reverts if fungible tokens are cashed out alongside NFTs (`context.cashOutCount > 0`), prices reclaim by NFT cash-out weight, burns NFTs in the after-hook
- **nana-buyback-hook-v6** — compares AMM route vs direct cash out, returns `noop: true` when the terminal's direct path pays better

## Common mistakes

- **Returning 4 values from `beforeCashOutRecordedWith`.** The signature has 5 returns; `effectiveSurplusValue` is required and must be denominated like `context.surplus`.
- **Assuming `effectiveCashOutCount` changes the burn.** It only changes pricing; the terminal burns the caller-supplied count regardless.
- **Forgetting the fee on forwarded amounts.** Non-feeless hooks receive 2.5% less than `specification.amount`; only the protocol owner can make an address feeless.
- **Treating `specification.amount` as a slice of the reclaim.** It is added on top of the beneficiary's reclaim and debited from the project balance; shrink `effectiveSurplusValue` (or the tax/count inputs) to redirect value.
- **Leaving ERC-20 allowance unconsumed.** Forwarded ERC-20 arrives as an allowance; pull it in full or the cash out reverts.
- **Skipping caller validation.** Check `DIRECTORY.isTerminalOf` and `context.projectId` before acting on the context.
- **Ignoring omnichain supply.** For projects with suckers, using only local `totalSupply` lets holders bypass the cash out tax by fragmenting supply across chains — aggregate it in `effectiveTotalSupply` (respect `scopeCashOutsToLocalBalances`).
