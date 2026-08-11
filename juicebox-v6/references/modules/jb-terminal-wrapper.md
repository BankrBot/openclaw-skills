---
name: jb-terminal-wrapper
description: |
  Terminal wrapper pattern for extending Juicebox terminal functionality. Use when: (1) building a
  custom IJBTerminal that forwards to JBMultiTerminal or a router terminal, (2) needing atomic
  pay + follow-on operations, (3) intercepting/redirecting project tokens or reclaimed funds,
  (4) understanding how JBRouterTerminalRegistry and JBRouterTerminal implement wrapping in
  production, (5) propagating the original payer through a forwarding chain (IJBPayerTracker).
version: 6.0.0
---

# Terminal Wrapper Pattern

A wrapper is a custom `IJBTerminal` that accepts funds, applies its own logic, then forwards into a real terminal. The production examples are in `nana-router-terminal-v6`:

- **`JBRouterTerminalRegistry`** (`0xe0427f250fdb0379c8e98e884ee4570521208cbc`) — pure forwarding wrapper. Accepts funds, resolves a per-project downstream terminal, approves it, forwards `pay`/`addToBalanceOf` unchanged, revokes leftover allowance.
- **`JBRouterTerminal`** (`0x0fbcbb3d10c8f524840d74ef81c1a9f161c418d7`) — transforming wrapper. Accepts any token, swaps/cashes it into what the destination project accepts, then pays the destination terminal.

Wrappers can chain: caller → registry → router → `JBMultiTerminal`.

## Critical mental model: wrappers are additive

```
Client A ──► CustomWrapper ──► JBMultiTerminal   (gets extra features)
Client B ──────────────────► JBMultiTerminal     (still works)
```

Anyone can always call `JBMultiTerminal.pay()` directly. A wrapper cannot restrict access to the project — it can only add opt-in functionality. Exception: a project can point `JBDirectory` at the wrapper as its only registered terminal for a token, but the underlying terminal holding the balance remains permissionlessly payable.

## IJBTerminal surface a wrapper must implement

| Function | Forwarding wrapper implementation |
|----------|-----------------------------------|
| `pay(projectId, token, amount, beneficiary, minReturnedTokens, memo, metadata)` | accept funds → custom logic → forward |
| `addToBalanceOf(projectId, token, amount, shouldReturnHeldFees, memo, metadata)` | accept funds → forward |
| `accountingContextForTokenOf(projectId, token)` | delegate to downstream terminal (registry) or synthesize (router). `JBDirectory.primaryTerminalOf` treats a non-zero `.token` as "accepts this token" |
| `accountingContextsOf(projectId)` | delegate or return empty array |
| `currentSurplusOf(projectId, tokens, decimals, currency)` | return 0 (wrapper holds no balances) |
| `previewPayFor(projectId, token, amount, beneficiary, metadata)` | delegate |
| `addAccountingContextsFor(projectId, accountingContexts)` | empty body (contexts live downstream) |
| `migrateBalanceOf(projectId, token, to)` | return 0 (no balances) |
| `supportsInterface` | report `IJBTerminal` + `IERC165` |

## Accepting funds (`_acceptFundsFor` pattern from JBRouterTerminalRegistry)

```solidity
function _acceptFundsFor(address token, uint256 amount, bytes calldata metadata) internal returns (uint256) {
    // Native token: use msg.value.
    if (token == JBConstants.NATIVE_TOKEN) return msg.value;
    if (msg.value != 0) revert NoMsgValueAllowed(msg.value);

    // Consume an optional permit2 allowance keyed to THIS contract's address.
    (bool exists, bytes memory parsedMetadata) =
        JBMetadataResolver.getDataFor({id: JBMetadataResolver.getId("permit2"), metadata: metadata});
    if (exists) {
        JBSingleAllowance memory allowance = abi.decode(parsedMetadata, (JBSingleAllowance));
        if (amount > allowance.amount) revert PermitAllowanceNotEnough(amount, allowance.amount);
        // spender: address(this). A failed permit is caught (event), then the transfer below
        // falls back to any pre-existing approval or permit2 allowance.
        try PERMIT2.permit({owner: _msgSender(), permitSingle: permitSingle, signature: allowance.signature}) {}
        catch (bytes memory reason) { emit Permit2AllowanceFailed(token, _msgSender(), reason); }
    }

    // Measure the received balance delta so lossy ERC-20s stay in sync.
    uint256 balanceBefore = IERC20(token).balanceOf(address(this));
    _transferFrom({from: _msgSender(), to: payable(address(this)), token: token, amount: amount});
    return IERC20(token).balanceOf(address(this)) - balanceBefore;
}
```

Forwarding leg (from the registry's `pay`):

```solidity
amount = _acceptFundsFor({token: token, amount: amount, metadata: metadata});

// ERC-20: forceApprove the downstream terminal; native: pass value.
uint256 payValue = token == JBConstants.NATIVE_TOKEN
    ? amount
    : (IERC20(token).forceApprove({spender: address(terminal), value: amount}), 0);

result = terminal.pay{value: payValue}({
    projectId: projectId, token: token, amount: amount, beneficiary: beneficiary,
    minReturnedTokens: minReturnedTokens, memo: memo, metadata: metadata
});

// Revoke any leftover allowance the terminal did not pull.
if (token != JBConstants.NATIVE_TOKEN) IERC20(token).forceApprove({spender: address(terminal), value: 0});
```

Key production details worth copying:

- **Original-payer propagation (`IJBPayerTracker`)**: the registry writes `address public transient originalPayer` before forwarding, so downstream router terminals refund partial-fill leftovers to the true payer instead of the intermediary. If the immediate caller itself exposes `originalPayer()` (probed via staticcall), the upstream value is propagated. Save/restore the previous value around the forward to survive nested calls.
- **Circular-forward protection**: reject `terminal == address(this)` and immediate-caller cycles (`msg.sender == address(terminal)`); the registry also walks transitive chains via `JBForwardingCheck.isCircularTerminal`.
- **Metadata passes through unchanged**. Each contract in the chain extracts only entries keyed to its own address (`JBMetadataResolver.getId(purpose)` XORs with `address(this)`), so a permit2 entry for the wrapper is invisible to the downstream terminal — funds move down the chain via approvals, not permits.

## Beneficiary interception

Receive project tokens (pay) or reclaimed funds (cash out) to the wrapper, then process:

```solidity
// Pay and stake: wrapper is the beneficiary.
tokenCount = TERMINAL.pay{value: msg.value}({
    projectId: projectId, token: token, amount: amount,
    beneficiary: address(this), minReturnedTokens: minReturnedTokens, memo: "", metadata: ""
});
// ...stake/lock/forward the minted project tokens...
```

```solidity
// Cash out and swap/bridge: wrapper receives the reclaimed terminal tokens.
reclaimAmount = TERMINAL.cashOutTokensOf({
    holder: holder,
    projectId: projectId,
    cashOutCount: cashOutCount,          // project tokens to burn (18 decimals)
    tokenToReclaim: tokenToReclaim,
    minTokensReclaimed: minTokensReclaimed,
    beneficiary: payable(address(this)), // wrapper intercepts the funds
    metadata: metadata
});
// ...swap, bridge, stake, or LP the reclaimed funds...
```

`cashOutTokensOf` requires the caller to be the `holder` or hold `JBPermissionIds.CASH_OUT_TOKENS` (ID 4) permission from the holder. Note the beneficiary's feeless status determines the protocol fee on the reclaim — a non-feeless wrapper beneficiary incurs the 2.5% fee (see `jb-protocol-fees`).

## Wrapper use cases

| Use case | Mechanism |
|----------|-----------|
| Dynamic splits at pay time | parse splits from metadata, `CONTROLLER.setSplitGroupsOf` (needs `SET_SPLIT_GROUPS` permission, ID 19), then forward pay |
| Pay + distribute reserved | forward pay, then `CONTROLLER.sendReservedTokensToSplitsOf(projectId)` |
| Token interception | `beneficiary: address(this)`, then stake/lock/forward |
| Referral tracking | parse referrer from metadata, record, forward |
| Multi-hop payments | receive, swap, pay another project (this is `JBRouterTerminal`) |
| Cash out + swap/bridge/stake/LP | `cashOutTokensOf` with wrapper as beneficiary, then process |
| Per-project routing choice | registry pattern: project owner picks a downstream terminal (`SET_ROUTER_TERMINAL` permission, ID 31), optionally locks it permanently |

## Verification

1. Direct `JBMultiTerminal.pay` still works alongside the wrapper (permissionless).
2. Wrapper payments produce the enhanced behavior atomically (all-or-revert).
3. Leftover ERC-20 allowances to the downstream terminal are revoked after forwarding.
4. Nested wrapper chains resolve `originalPayer` to the true payer.

## Common mistakes

1. **Trying to use a wrapper as a gate.** Users can always hit the underlying terminal directly.
2. **Forwarding `msg.value` for ERC-20 payments.** Only native-token pays carry value; ERC-20 forwards use approve-then-pull with `payValue = 0`.
3. **Reusing the caller-supplied `amount` after transfer.** Measure the balance delta; fee-on-transfer tokens deliver less.
4. **Leaving dangling approvals.** Revoke with `forceApprove(spender, 0)` after the downstream call.
5. **Computing the permit2 metadata ID with the downstream terminal's address.** The permit spender and ID target are the wrapper — the contract the user calls.
6. **Forgetting permissions.** Setting splits requires `SET_SPLIT_GROUPS`; using surplus allowance requires `USE_ALLOWANCE` (ID 18); cashing out for another holder requires `CASH_OUT_TOKENS` (ID 4).
