---
name: Deploy Any Contract
description: Deploy ANY smart contract from an agent that can only send normal transactions (to + data) — no contract-creation tx needed. Call DeployerFactory.deploy(initCode) on Base and the factory runs CREATE for you; the new address comes back in the Deployed event. Supports CREATE2 with a predictable address. Use when the user says "deploy this contract", "deploy this bytecode", "I have compiled bytecode, put it on chain", or when your transaction tooling requires a `to` field and cannot omit it.
---

# Deploy Any Contract (DeployerFactory)

## The problem this solves

A contract-creation transaction has **no `to` field** — it must be omitted
entirely (never `0x0000…0000`, which is just a transfer). Many agent pipelines,
including Bankr's `submit_raw_transaction`, **require** a `to` field, so they can
launch tokens but can never deploy an arbitrary contract.

`DeployerFactory` removes the wall: deployment becomes a **normal contract
call**. You send a tx **to the factory** with your contract's creation bytecode
as an argument; the factory executes `CREATE` (or `CREATE2`) and emits the new
address. Anything deployable in a creation tx is deployable through the factory.

## Factory address

| Chain | Address |
|---|---|
| Base (8453) | `0xCF4357aFdC26fa028e77291CE2F97C9dAF93F75D` |

> **LIVE on Base** — deployed + independently verified 2026-07-17 (tx
> `0xf9ba0b65250f8372b94fac1bf946cd4e11154fa479f13a8e133105a3ed998508`,
> [Basescan](https://basescan.org/address/0xCF4357aFdC26fa028e77291CE2F97C9dAF93F75D)).
> The bytecode is compiled with `evmVersion: paris`, so the identical contract also
> works on other EVM chains (e.g. Robinhood Chain 4663) when twinned there.

## Interface

```solidity
function deploy(bytes initCode) payable returns (address addr);
function deployDeterministic(bytes initCode, bytes32 salt) payable returns (address addr);
function computeAddress(bytes32 initCodeHash, bytes32 salt) view returns (address);
function fee() view returns (uint256);          // native wei per deploy (0 at launch)

event Deployed(address indexed deployer, address indexed addr, uint256 feePaid);
```

Selectors (grounded from the compiled ABI):

- `deploy(bytes)` = `0x00774360`
- `deployDeterministic(bytes,bytes32)` = `0x9881d195`
- `computeAddress(bytes32,bytes32)` = `0x481286e6`
- `Deployed` event topic0 = `0x78c9d1e385f0bb7d4dd0237eb7ab708b0780c73031080977cd5469bab04ed690`

## How to deploy (3 steps)

1. **Build the initCode**: `initCode = creation bytecode ++ ABI-encoded constructor args`
   (exactly the data you would have put in a creation tx).
2. **Send ONE normal transaction**:
   - `to` = the factory address
   - `value` = `fee()` (0 at launch — read it, don't assume)
   - `data` = ABI encoding of `deploy(initCode)`
3. **Read the new address** from the `Deployed` event in the receipt:
   topic0 = `0x78c9d1e3…ed690`, `topics[2]` = the new contract address
   (last 20 bytes of the 32-byte topic). Then verify `eth_getCode(addr) > 0`.

You can also **simulate first**: `eth_call` the same calldata and the return
data is the address that the very next real tx will produce (same factory nonce).

### viem

```ts
import { encodeFunctionData, parseAbi } from "viem";

const abi = parseAbi([
  "function deploy(bytes initCode) payable returns (address)",
  "event Deployed(address indexed deployer, address indexed addr, uint256 feePaid)",
]);
const initCode = (CREATION_BYTECODE + encodedCtorArgs.slice(2)) as `0x${string}`;

const hash = await wallet.sendTransaction({
  to: FACTORY,
  value: await client.readContract({ address: FACTORY, abi: parseAbi(["function fee() view returns (uint256)"]), functionName: "fee" }),
  data: encodeFunctionData({ abi, functionName: "deploy", args: [initCode] }),
});
const receipt = await client.waitForTransactionReceipt({ hash });
const log = receipt.logs.find(l => l.address.toLowerCase() === FACTORY.toLowerCase());
const newContract = ("0x" + log.topics[2].slice(26)) as `0x${string}`; // last 20 bytes
```

### Raw calldata layout (for `submit_raw_transaction`-style tooling)

```
0x00774360                                                        deploy(bytes) selector
0000…0020                                                         offset of the bytes arg (32)
<initCode length as 32-byte big-endian>
<initCode bytes, right-padded to a 32-byte multiple>
```

## Worked example — deploy a trivial contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract Hello {
    uint256 public x;
    constructor(uint256 _x) { x = _x; }
}
```

Compiled with the pinned settings (solc `0.8.35+commit.47b9dedd`, viaIR, optimizer
200, evmVersion paris — full artifact in `Hello-example.json`), constructor arg
`42` appended, the initCode is:

```
0x608034604b57601f60e138819003918201601f19168301916001600160401b03831184841017605057808492602094604052833981010312604b5751600055604051607a908160678239f35b600080fd5b634e487b7160e01b600052604160045260246000fdfe6080806040526004361015601257600080fd5b60003560e01c630c55699c14602657600080fd5b34603f576000366003190112603f576020906000548152f35b600080fdfea26469706673582212207523e24c0f3b369366003be375cdbea4b7c29d75bd3f5dac4d452fea715303c564736f6c63430008230033000000000000000000000000000000000000000000000000000000000000002a
```

(the trailing `…002a` = 42, the ABI-encoded constructor arg)

The complete calldata for `deploy(initCode)` — this is the entire `data` field of
the tx you send to the factory:

```
0x0077436000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000101608034604b57601f60e138819003918201601f19168301916001600160401b03831184841017605057808492602094604052833981010312604b5751600055604051607a908160678239f35b600080fd5b634e487b7160e01b600052604160045260246000fdfe6080806040526004361015601257600080fd5b60003560e01c630c55699c14602657600080fd5b34603f576000366003190112603f576020906000548152f35b600080fdfea26469706673582212207523e24c0f3b369366003be375cdbea4b7c29d75bd3f5dac4d452fea715303c564736f6c63430008230033000000000000000000000000000000000000000000000000000000000000002a00000000000000000000000000000000000000000000000000000000000000
```

Send that with `to = FACTORY`, `value = fee()`, and the receipt's `Deployed`
event carries your new contract's address. Calling `x()` on it returns 42.

## CREATE2 — deterministic addresses

`deployDeterministic(initCode, salt)` gives you the address **before** you deploy:

```
predicted = computeAddress(keccak256(initCode), salt)
```

Example values (grounded): with `salt = keccak256("my-first-deploy")` =
`0xb19e0a52cfbe8379e10c81dbfb0adb9707011a56b95776579c91e64afd2a37a3` and the
Hello initCode above (`keccak256(initCode)` =
`0x0bda448dbfa7ab4facafda94e02114b0d54a5c4dce22a8a7641b23b416d11d04`), the
`computeAddress` call returns the exact address `deployDeterministic` will create.

Caveats:
- The CREATE2 namespace is **factory-wide**: the address depends on
  `(factory, salt, initCode)` — not on the caller. First come, first served;
  mix something caller-specific into your salt if that matters.
- The same `(salt, initCode)` pair can only be deployed once — a repeat reverts
  with `create2 failed`.

## Fees

- `fee()` is in **native wei** and starts at **0**. Always read it and set
  `value = fee()` on your deploy tx.
- The fee is forwarded to the Meme for Trees ops wallet
  (`0x0780b1456D5E60CF26C8Cd6541b85E805C8c05F2`) on every successful deploy.
  Failed deploys revert entirely — you never pay for a failure.
- Anything you send **above** the fee is passed to your contract's constructor
  as its ETH endowment — the constructor must be `payable` to accept it.
  **If your constructor is not payable, send exactly `fee()`** or the deploy
  reverts (`create failed`).

## Gotchas — read before your first deploy

1. **`msg.sender` inside your constructor is the FACTORY, not you.** If your
   contract assigns `owner = msg.sender` in the constructor, the factory becomes
   the owner. Pass the owner/admin as an explicit constructor argument.
2. **initCode size cap**: 49,152 bytes (EIP-3860). **Runtime size cap**: 24,576
   bytes (EIP-170). Same limits as a normal creation tx.
3. **Base per-tx gas cap is ~16.5M** — a huge deploy (or a constructor that does
   heavy work) must be staged into smaller pieces, same as any Base tx.
4. Constructors **cannot re-enter the factory** (nonReentrant) — deploy
   sub-contracts with separate calls, not from inside a constructor.
5. The factory has **no receive()** — plain ETH transfers to it revert.

## Trust model

- `deploy` / `deployDeterministic` are **permissionless forever** and can never
  be paused — there is no admin power over deploys.
- Admin (`0xE2a4A8b9d77080c57799A94BA8eDeb2Dd6e0aC10`, the MfT agent wallet) can
  only `setFee` / `setOpsWallet` / `withdrawStuck` (recover mis-sent funds), and
  all three are permanently disabled by the one-way `renounceAdmin()` at ship.
  The admin address is fee-exempt.
- Full source: `DeployerFactory.sol` in this folder (2,756-byte creation code,
  no imports). Local EVM suite: `test-bnkr-factory.cjs` — 32/32 passing
  (CREATE, CREATE2 + prediction, fee routing, exemption, endowment, stuck-fund
  recovery, renounce lock).

## Reproduce the build

```json
{ "language": "Solidity",
  "settings": { "viaIR": true, "optimizer": { "enabled": true, "runs": 200 },
                "evmVersion": "paris" } }
```

solc `0.8.35+commit.47b9dedd` over `DeployerFactory.sol` → matches
`creation-bytecode.txt` and `DeployerFactory-abi.json` byte for byte.
