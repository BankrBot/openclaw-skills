---
name: jb-pay-hook
description: |
  Write custom Juicebox pay hooks. Use when: (1) custom logic on payment that
  JBBuybackHook or JB721TiersHook can't handle, (2) payment restrictions or
  allowlists, (3) triggering external contract calls on pay, (4) overriding token
  minting weight. Covers IJBRulesetDataHook + IJBPayHook interfaces, context
  structs, fund forwarding mechanics, and access-control requirements.
version: 6.0.0
---

# Pay Hook Generator

Custom pay hooks extend a terminal's `pay(...)` flow. Before writing one, check the off-the-shelf options:

| Need | Use instead |
|------|-------------|
| Token buybacks via Uniswap | `JBBuybackHook` (nana-buyback-hook-v6, address in `references/shared/chain-config.json`) |
| Tiered NFT rewards on payment | `JB721TiersHook` via `JB721TiersHookProjectDeployer` or `JBOmnichainDeployer` |
| Autonomous tokenized treasury | Revnet via `REVDeployer` (revnet-core-v6) |

## Architecture: two stages

| Stage | Interface | Function | Called when |
|-------|-----------|----------|-------------|
| 1. Data hook | `IJBRulesetDataHook` | `beforePayRecordedWith` (view) | Before the payment is recorded, if the ruleset has `useDataHookForPay = true` and a non-zero `dataHook` in its metadata |
| 2. Pay hook | `IJBPayHook` | `afterPayRecordedWith` (payable) | After recording, once per `JBPayHookSpecification` the data hook returned |

One contract can implement both (`JBBuybackHook` and `JB721TiersHook` do). A pay hook with no data hook is never called — the data hook is what routes execution to pay hooks.

Both interfaces extend `IERC165`; implement `supportsInterface` for `type(IJBRulesetDataHook).interfaceId` / `type(IJBPayHook).interfaceId`.

## IJBRulesetDataHook (nana-core-v6/src/interfaces/IJBRulesetDataHook.sol)

```solidity
function beforePayRecordedWith(JBBeforePayRecordedContext calldata context)
    external
    view
    returns (uint256 weight, JBPayHookSpecification[] memory hookSpecifications);

function beforeCashOutRecordedWith(JBBeforeCashOutRecordedContext calldata context)
    external
    view
    returns (
        uint256 cashOutTaxRate,
        uint256 effectiveCashOutCount,
        uint256 effectiveTotalSupply,
        uint256 effectiveSurplusValue,
        JBCashOutHookSpecification[] memory hookSpecifications
    );

function hasMintPermissionFor(
    uint256 projectId,
    JBRuleset memory ruleset,
    address addr
)
    external
    view
    returns (bool flag);
```

The returned `weight` overrides the ruleset's weight for this payment. `hasMintPermissionFor` grants on-demand mint rights per address per ruleset — return `false` unless the hook itself must mint.

## Context structs (fields in ABI order)

### JBBeforePayRecordedContext

| Field | Type | Meaning |
|-------|------|---------|
| `terminal` | `address` | Terminal facilitating the payment |
| `payer` | `address` | Payment originator |
| `amount` | `JBTokenAmount` | Payment amount (token, decimals, currency, value) |
| `projectId` | `uint256` | Project being paid |
| `rulesetId` | `uint256` | Ruleset the payment is made during |
| `beneficiary` | `address` | Recipient of anything the payment yields |
| `weight` | `uint256` | Current ruleset weight |
| `reservedPercent` | `uint256` | Reserved percent, out of `JBConstants.MAX_RESERVED_PERCENT` (10,000) |
| `metadata` | `bytes` | Payer-supplied metadata |

### JBAfterPayRecordedContext

| Field | Type | Meaning |
|-------|------|---------|
| `payer` | `address` | Payment originator |
| `projectId` | `uint256` | Project being paid |
| `rulesetId` | `uint256` | Ruleset ID |
| `amount` | `JBTokenAmount` | Full payment amount |
| `forwardedAmount` | `JBTokenAmount` | Amount forwarded to this hook |
| `weight` | `uint256` | Ruleset weight used |
| `newlyIssuedTokenCount` | `uint256` | Project tokens minted for the beneficiary |
| `beneficiary` | `address` | Token recipient |
| `hookMetadata` | `bytes` | `metadata` from this hook's `JBPayHookSpecification` |
| `payerMetadata` | `bytes` | Payer-supplied metadata |

### JBPayHookSpecification

| Field | Type | Meaning |
|-------|------|---------|
| `hook` | `IJBPayHook` | Hook to call |
| `noop` | `bool` | If `true`, the terminal skips the hook call entirely — the spec is informational (emitted in events, read by indexers). A noop spec must have `amount == 0` or the payment reverts (`JBTerminalStore_NoopHookSpecHasAmount`) |
| `amount` | `uint256` | Amount to forward to the hook instead of adding to the terminal balance |
| `metadata` | `bytes` | Passed to the hook as `hookMetadata` |

### JBTokenAmount

| Field | Type |
|-------|------|
| `token` | `address` |
| `decimals` | `uint8` |
| `currency` | `uint32` |
| `value` | `uint256` |

## Fund forwarding mechanics

`JBPayHookSpecification.amount` controls how much of the payment the terminal routes to the hook:

| `amount` | Behavior |
|----------|----------|
| `0` | Funds stay in the terminal; hook is still called (notification only) |
| `context.amount.value` | Full payment forwarded |
| partial | Any split; spec amounts summed across hooks must not exceed the payment or recording reverts (`JBTerminalStore_InvalidAmountToForwardHook`) |

Delivery differs by token type (`JBMultiTerminal`):

- **Native token** (`JBConstants.NATIVE_TOKEN` = `0x000000000000000000000000000000000000EEEe`): sent as `msg.value` on the `afterPayRecordedWith` call.
- **ERC-20**: the terminal grants the hook a temporary allowance for `forwardedAmount.value`. The hook MUST `transferFrom` the full amount during the call. If any allowance remains when the hook returns, the entire payment reverts with `JBMultiTerminal_TemporaryAllowanceNotConsumed`.

## Access control (required)

`afterPayRecordedWith` is an open external function. Validate the caller and the value, following `JB721Hook`:

```solidity
function afterPayRecordedWith(JBAfterPayRecordedContext calldata context) external payable override {
    // Only project terminals may call, and only for this hook's project.
    if (
        !DIRECTORY.isTerminalOf({projectId: PROJECT_ID, terminal: IJBTerminal(msg.sender)})
            || context.projectId != PROJECT_ID
    ) revert InvalidPay();

    // msg.value must match the forwarded amount for native-token payments, and be 0 otherwise.
    uint256 expected =
        context.forwardedAmount.token == JBConstants.NATIVE_TOKEN ? context.forwardedAmount.value : 0;
    if (msg.value != expected) revert InvalidPayValue();

    // Pull ERC-20 funds if any were forwarded.
    if (context.forwardedAmount.token != JBConstants.NATIVE_TOKEN && context.forwardedAmount.value != 0) {
        IERC20(context.forwardedAmount.token).transferFrom(msg.sender, address(this), context.forwardedAmount.value);
    }

    // Custom logic here.
}
```

## Full data hook + pay hook skeleton

```solidity
contract MyPayHook is IJBRulesetDataHook, IJBPayHook, ERC165 {
    function beforePayRecordedWith(JBBeforePayRecordedContext calldata context)
        external
        view
        override
        returns (uint256 weight, JBPayHookSpecification[] memory hookSpecifications)
    {
        weight = context.weight; // or override

        hookSpecifications = new JBPayHookSpecification[](1);
        hookSpecifications[0] = JBPayHookSpecification({
            hook: IJBPayHook(address(this)),
            noop: false,
            amount: 0, // or context.amount.value to receive funds
            metadata: ""
        });
    }

    function afterPayRecordedWith(JBAfterPayRecordedContext calldata context) external payable override {
        // validate caller + msg.value, then custom logic
    }

    // Pass-through: not handling cash outs.
    function beforeCashOutRecordedWith(JBBeforeCashOutRecordedContext calldata context)
        external
        view
        override
        returns (uint256, uint256, uint256, uint256, JBCashOutHookSpecification[] memory)
    {
        return (
            context.cashOutTaxRate,
            context.cashOutCount,
            context.totalSupply,
            context.surplus.value,
            new JBCashOutHookSpecification[](0)
        );
    }

    function hasMintPermissionFor(uint256, JBRuleset memory, address) external pure override returns (bool) {
        return false;
    }

    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        return interfaceId == type(IJBRulesetDataHook).interfaceId || interfaceId == type(IJBPayHook).interfaceId
            || super.supportsInterface(interfaceId);
    }
}
```

## Wiring the hook to a project

Set in the ruleset metadata when queueing rulesets (`JBRulesetMetadata`):

| Field | Value |
|-------|-------|
| `dataHook` | The data hook address |
| `useDataHookForPay` | `true` |
| `useDataHookForCashOut` | `true` only if the same contract also handles cash outs |

## Metadata conventions

`context.metadata` (payer-supplied) can carry entries for multiple consumers. Parse with `JBMetadataResolver` from nana-core-v6 rather than raw `abi.decode`:

```solidity
(bool found, bytes memory data) = JBMetadataResolver.getDataFor({
    id: JBMetadataResolver.getId({purpose: "pay", target: address(this)}),
    metadata: context.metadata
});
```

## Reference implementations

- **nana-buyback-hook-v6** — data hook + pay hook, weight override, `noop` specs used as informational previews
- **nana-721-hook-v6** (`src/abstract/JB721Hook.sol`) — canonical caller-validation pattern
- **revnet-core-v6** (`REVDeployer`) — contract-as-owner pattern: the contract owns the project NFT, implements hooks, and delegates via `JBPermissions`

## Common mistakes

- **Leaving ERC-20 allowance unconsumed.** Forwarded ERC-20 amounts arrive as an allowance, not a transfer. Pull the full amount or the payment reverts.
- **Skipping caller validation.** Anyone can call `afterPayRecordedWith` with fabricated context unless you check `DIRECTORY.isTerminalOf` and `context.projectId`.
- **Implementing only `IJBPayHook`.** Without a data hook returning a spec pointing at your pay hook, it never runs.
- **Forgetting `beforeCashOutRecordedWith` returns 5 values.** The pass-through must return `context.surplus.value` as `effectiveSurplusValue`, not omit it.
- **Assuming `native token == address(0)`.** The native-token sentinel is `JBConstants.NATIVE_TOKEN` (`0x…EEEe`).
- **Setting `noop: true` and expecting a callback.** `noop` specs are never called; they only surface data to events/indexers.
