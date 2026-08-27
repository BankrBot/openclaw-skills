---
name: jb-terminal-selection
description: |
  Dynamic terminal selection for Juicebox payments. Use when: (1) building payment UIs that support
  multiple tokens, (2) encountering a JBMultiTerminal_TokenNotAccepted revert, (3) paying a project
  with a token it doesn't list in its accounting contexts, (4) deciding between JBMultiTerminal,
  JBRouterTerminalRegistry, and JBRouterTerminal for a payment, (5) wiring permit2 with the correct
  spender for the terminal being called.
version: 6.0.0
---

# Dynamic Terminal Selection for Juicebox Payments

## Problem

`JBMultiTerminal` only accepts tokens the project registered an accounting context for. Paying it with any other token reverts with `JBMultiTerminal_TokenNotAccepted(address token)`. Payment UIs must resolve the correct terminal per `(projectId, token)` at runtime.

## Terminal roles

| Contract | Address (same on all chains) | Role |
|----------|------------------------------|------|
| `JBDirectory` | `0x5aff29060e023e6fb87be5596652b33c65af535b` | Registry of each project's terminals; resolves `primaryTerminalOf` |
| `JBMultiTerminal` | `0x130f5dd2bd8805443cf41755253d778a75a67f53` | Holds project balances; accepts only tokens with a registered accounting context |
| `JBRouterTerminalRegistry` | `0xe0427f250fdb0379c8e98e884ee4570521208cbc` | Forwarding terminal projects register in `JBDirectory`; forwards `pay`/`addToBalanceOf` to the project's resolved router terminal |
| `JBRouterTerminal` | `0x0fbcbb3d10c8f524840d74ef81c1a9f161c418d7` | Universal router: accepts any token and converts it (direct forward, Uniswap V3/V4 swap, recursive JB cash-outs, or combinations) into a token the destination project accepts. Not deployed on Optimism Sepolia — resolve the effective router via `registry.terminalOf(projectId)` |

The native token is the sentinel `0x000000000000000000000000000000000000EEEe` (`JBConstants.NATIVE_TOKEN`), never `address(0)`.

## How `primaryTerminalOf` resolves

`JBDirectory.primaryTerminalOf(projectId, token)`:

1. If an explicit primary terminal was set for the token (`setPrimaryTerminalOf`) and it's still one of the project's terminals, return it.
2. Otherwise return the **first** registered terminal whose `accountingContextForTokenOf(projectId, token).token != address(0)`.
3. Otherwise return `address(0)`.

Acceptance semantics per terminal:

- `JBMultiTerminal.accountingContextForTokenOf` returns a non-empty context only for tokens the project explicitly registered.
- `JBRouterTerminalRegistry.accountingContextForTokenOf` delegates to the project's resolved router terminal. `JBRouterTerminal` synthesizes a context for **any** token (probes `decimals()`, falls back to 18; `currency = uint32(uint160(token))`). So a project with the registry among its terminals resolves a terminal for effectively every token. The registry's discovery views fail open: when no router terminal resolves for the project, they return an empty context instead of reverting.
- Registry resolution is per project: `registry.terminalOf(projectId)` returns the project's explicitly set router terminal, else the default that was active when the project was created — projects with `id <= defaultTerminalProjectIdThreshold` resolve against `_defaultTerminalHistory`, not the live `defaultTerminal`. Never assume `defaultTerminal`; call `terminalOf(projectId)`.

## Production route selection (juicebox.money `PayPanel`)

1. `JBDirectory.terminalsOf(projectId)` — if neither the registry nor `JBRouterTerminal` is listed, only direct tokens are payable.
2. `JBMultiTerminal.accountingContextsOf(projectId)` — each context's token is a direct pay; `primaryTerminalOf(projectId, token)` gives the terminal to call.
3. For candidate tokens not in step 2 (native, USDC), probe `registry.previewPayFor(projectId, token, 10 ** decimals, beneficiary, "0x")`; a revert or a returned `ruleset.id == 0` means the route is dead — hide the token. Cache per `(chainId, projectId, token)`.
4. Pay the direct terminal for direct tokens; pay the registry for probed tokens, with permit2 spender/ID = registry.

## Selection algorithm

```typescript
import { type PublicClient, type Address, zeroAddress } from 'viem'

const JB_DIRECTORY = '0x5aff29060e023e6fb87be5596652b33c65af535b'
const JB_ROUTER_TERMINAL_REGISTRY = '0xe0427f250fdb0379c8e98e884ee4570521208cbc'
const NATIVE_TOKEN = '0x000000000000000000000000000000000000EEEe'

const JB_DIRECTORY_ABI = [{
  name: 'primaryTerminalOf',
  type: 'function',
  stateMutability: 'view',
  inputs: [
    { name: 'projectId', type: 'uint256' },
    { name: 'token', type: 'address' },
  ],
  outputs: [{ name: '', type: 'address' }],
}] as const

async function getPaymentTerminal(
  client: PublicClient,
  projectId: bigint,
  paymentToken: Address
): Promise<{ address: Address; isRouter: boolean }> {
  const terminal = await client.readContract({
    address: JB_DIRECTORY,
    abi: JB_DIRECTORY_ABI,
    functionName: 'primaryTerminalOf',
    args: [projectId, paymentToken],
  })

  // No registered terminal accepts this token → route through the registry,
  // which converts the token into one the project accepts.
  if (terminal === zeroAddress) {
    return { address: JB_ROUTER_TERMINAL_REGISTRY, isRouter: true }
  }

  return {
    address: terminal,
    isRouter: terminal.toLowerCase() === JB_ROUTER_TERMINAL_REGISTRY.toLowerCase(),
  }
}
```

All terminals share the same `pay` signature (`IJBTerminal`):

```solidity
function pay(
    uint256 projectId,
    address token,
    uint256 amount,
    address beneficiary,
    uint256 minReturnedTokens,
    string calldata memo,
    bytes calldata metadata
) external payable returns (uint256 beneficiaryTokenCount);
```

`minReturnedTokens` on a routed payment guards the **end-to-end** result — a bad intermediate swap yields fewer final project tokens and reverts the whole route.

## Router quote metadata

`JBRouterTerminal` prices swaps from manipulation-resistant sources (V3 TWAP, canonical-hook V4 oracle) with a dynamic slippage model. Front-ends should still supply an explicit quote via a `pay` metadata entry (see `jb-permit2-metadata` for the encoding format):

- Entry ID: `bytes4(bytes20(routerTerminal) ^ bytes20(keccak256("pay")))` = `0xa27bedbd` for `0x0fbcbb3d10c8f524840d74ef81c1a9f161c418d7`.
- Payload: `abi.encode(address quotedTokenOut, uint256 quotedMinAmountOut)`. A zero `quotedMinAmountOut` is treated as "not provided" and falls back to automatic quoting.

If the destination project runs `JBBuybackHook`, its own `pay` entry (`0xda79b72d`) is a separate 3-word payload: `abi.encode(uint256 amountToSwapWith, uint256 minimumSwapAmountOut, bool skipSplits)` — `skipSplits = true` opts the swapped tokens out of the reserved split (see `jb-permit2-metadata`).

`addToBalanceOf` through the router has no `minReturnedTokens` backstop, so a swap leg with no manipulation-resistant TWAP **requires** a `pay` quote — otherwise it reverts with `JBRouterTerminal_ManipulationResistantQuoteRequired`.

Router cash-out legs call the downstream `cashOutTokensOf` with `minTokensReclaimed: 0` and enforce the caller's floor (the `cashOut` metadata entry `0x890df4c9`, payload `(uint256 minTokensReclaimed)`) against the measured balance delta, reverting `JBRouterTerminal_SlippageExceeded` — always supply that entry; the downstream terminal's own min check is not your guard.

## Permit2 integration

For ERC-20 payments, the permit2 metadata ID and the permit `spender` must both be derived from **the contract you call directly**. If you pay through the registry, the spender is the registry, not the router behind it.

```
metadataId = bytes4(bytes20(calledTerminal) ^ bytes20(keccak256("permit2")))
```

| Called contract | permit2 metadata ID |
|-----------------|---------------------|
| `JBMultiTerminal` | `0xd260d5c9` |
| `JBRouterTerminalRegistry` | `0x212df73e` |
| `JBRouterTerminal` | `0xced33326` |

See `jb-permit2-metadata` for the full encoding.

## Verification

1. `primaryTerminalOf(projectId, NATIVE_TOKEN)` for a standard project → `JBMultiTerminal`.
2. `primaryTerminalOf(projectId, <unregistered ERC-20>)` → either the registry (if the project registered it) or `address(0)`.
3. Simulate the `pay` call; `JBMultiTerminal_TokenNotAccepted` means the token/terminal pairing is wrong. A failed permit surfaces as `Permit2AllowanceFailed(token, owner, reason)` on `JBMultiTerminal` and `(token, owner, reason, caller)` on the registry/router — filter by the right shape.

## Common mistakes

1. **Hardcoding `JBMultiTerminal` for every token.** Only tokens in the project's accounting contexts work there. Query `primaryTerminalOf` at runtime; registrations change.
2. **Using `address(0)` for ETH.** The native token is `0x…EEEe`.
3. **Signing permit2 with the router as spender while calling the registry.** The registry pulls the funds; it must be the spender and the metadata-ID target.
4. **Assuming the registry reverts for unknown tokens.** It forwards to a router terminal that accepts any token; conversion happens inside the route. The failure mode is a missing pool / failed quote, not `TokenNotAccepted`.
5. **Skipping `minReturnedTokens` on routed payments.** For router paths this is the user's only end-to-end slippage guard on `pay`.
