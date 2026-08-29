---
name: jb-safe-and-relayr-execution
description: |
  Executing Juicebox V6 transactions from a Safe (multisig) and paying for cross-chain bundles
  through Relayr. Use when: (1) a project's owner/operator is a Safe and a write must be proposed,
  approved, or executed, (2) the connected wallet is the Safe App connector and `sendTransaction`
  returns a hash that never gets a receipt, (3) routing one action across chains for an EOA (Relayr)
  vs a Safe (proposals / approveHash), (4) verifying that a paid Relayr bundle actually landed on
  every chain, or resuming one after a reload, (5) a same-address Safe fails a cross-chain
  authority check. Request/response shapes for Relayr live in `jb-relayr`; this skill is the
  execution layer around them.
version: 6.0.0
---

# Safe and Relayr execution

Two execution paths exist for authority calls (owner/operator writes):

| Authority | Single chain | Multiple chains |
|-----------|--------------|-----------------|
| EOA (or EIP-7702 delegated EOA) | direct `sendTransaction` | one ERC-2771 ForwardRequest per chain, one Relayr payment (`jb-relayr`) |
| Safe | proposal (service) or `approveHash` (no service), then `execTransaction` | same per chain; ready `execTransaction`s may be batched through Relayr with one payment |

The ERC2771Forwarder (OpenZeppelin 5.6.1) validates signatures with `ECDSA.tryRecoverCalldata` only. It does not call EIP-1271, so a Safe can never be the `from` of a ForwardRequest. Safe authority never goes through the forwarder. EIP-1271 matters in one place: a Safe whose *owner* is itself a contract produces variable-length `v = 0` confirmations, which must be accepted as signatures.

## Detecting a Safe

Two independent facts, never conflated:

| Question | How | Result |
|----------|-----|--------|
| Is the **authority address** a Safe on chain X? | `getBytecode(authority)`; empty → `eoa`; `0xef0100‖addr` (exact 23 bytes) → `delegated-eoa`; else `keccak256(code)` must be a canonical SafeProxy hash, slot 0 must hold a supported singleton, `masterCopy()` must equal it, then read `getThreshold`, `getOwners`, `getModulesPaginated`, `VERSION`, guard and fallback-handler slots | `{kind:'safe', owners, threshold, singleton, version}` or `contract` |
| Is the **connected wallet** the Safe App? | wagmi connector `id`/`name` contains `safe` (`isSafeConnection`) | Safe App context: writes return a `safeTxHash` |

An RPC failure classifies as `null` (unknown), never as EOA. "Safe not deployed on chain X" (bytecode empty) and "chain X has no Safe transaction service" are different conditions.

Supported singletons (slot 0) and factories:

| Release | Safe (L1) | SafeL2 | SafeProxyFactory |
|---------|-----------|--------|------------------|
| 1.3.0 | `0xd9Db270c1B5E3Bd161E8c8503c55cEABeE709552` | `0x3E5c63644E683549055b9Be8653de26E0B4CD36E` | `0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2` |
| 1.4.1 | `0x41675C099F32341bf84BFc5382aF534df5C7461a` | `0x29fcB43b46531BcA003ddC8FCB67FFE91900C762` | `0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67` |

## Service vs app URL maps

| chainId | App prefix (`app.safe.global/...?safe=<prefix>:<safe>`) | Tx-service prefix (`https://api.safe.global/tx-service/<prefix>`) |
|---------|------|------|
| 1 | `eth` | `eth` |
| 10 | `oeth` | `oeth` |
| 8453 | `base` | `base` |
| 42161 | `arb1` | `arb1` |
| 11155111 | `sep` | `sep` |
| 84532 | `basesep` | `basesep` |
| 11155420 | `opsepolia` | none |
| 421614 | `arb1-sep` | none |

Every service URL comes from the service map; the app map only builds links. The legacy `safe-transaction-<net>.safe.global` hosts 308-redirect to the gateway and break CORS. Checksum every address in a URL or body (`getAddress`) or the service answers 422. No API key.

Service endpoints used:

```text
GET  /api/v1/safes/{safe}/                                   nonce, owners, threshold
GET  /api/v1/safes/{safe}/multisig-transactions/?executed=false&trusted=true&ordering=nonce&nonce__gte={nonce}
POST /api/v1/safes/{safe}/multisig-transactions/             contractTransactionHash, sender, signature, safeTxGas:"0", baseGas:"0", gasPrice:"0", nonce
POST /api/v1/multisig-transactions/{safeTxHash}/confirmations/   { signature }
GET  /api/v1/multisig-transactions/{safeTxHash}/             isExecuted, isSuccessful, transactionHash
GET  /api/v1/safes/{safe}/creation/                          factory, masterCopy, setupData, saltNonce
```

## SafeTx signing

EIP-712 domain is `{ chainId, verifyingContract: safe }` (no name/version). Field order:

```javascript
const SAFE_TX_TYPES = { SafeTx: [
  { name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'data', type: 'bytes' },
  { name: 'operation', type: 'uint8' }, { name: 'safeTxGas', type: 'uint256' }, { name: 'baseGas', type: 'uint256' },
  { name: 'gasPrice', type: 'uint256' }, { name: 'gasToken', type: 'address' }, { name: 'refundReceiver', type: 'address' },
  { name: 'nonce', type: 'uint256' },
]}
// operation 0, safeTxGas/baseGas/gasPrice 0, gasToken/refundReceiver zeroAddress. Switch the wallet to chainId first.
```

The hash binds chainId + Safe + nonce + calldata. Re-derive it from the service row and reject rows whose `safeTxHash` differs. `safeTxGas: 0` means "no inner gas floor"; the Safe App connector maps a write's `gas` field onto `safeTxGas`, so writes sent through the connector use `gas: 0n` and keep their own bounded simulation as the safety check.

`safeTxHash` is a proposal digest, not a transaction hash. Never `waitForTransactionReceipt` on it. Resolve it via the service (`isExecuted && transactionHash`, fail on `isSuccessful === false`, give up after 12 consecutive 404s ≈ 1 min), then poll the receipt of the returned hash. On a chain without a service the proposal cannot be tracked; report "execute it from the Safe app".

## Nonces

- Service path: next nonce = `max(service recommended, highest pending + 1)`. Before proposing, scan the pending queue (`nonce__gte` current) for an exact match (`to`, `value`, `data`, `operation 0`, all gas fields 0); if found, confirm it instead of duplicating. A queue read failure aborts the proposal — an outage must not read as an empty queue.
- No-service path: the on-chain `nonce()` advances only on execution, so hand out provisional nonces `N, N+1, …` per Safe within one batch. Every call approved at the same nonce would strand all but one.
- Only the transaction at the Safe's current `nonce()` executes. A higher nonce reverts until the lower ones land. Direct per-tx execution is gated to the front of the queue; batching through Relayr uses `virtual_nonce_mode: 'ChainIndependent'` with per-chain `virtual_nonce` 0,1,2… by array position.

## Signatures for `execTransaction`

```javascript
// ECDSA confirmation: 65-byte signature from the service row.
// approveHash confirmation (no signature in the row): pre-validated signature
//   r = owner left-padded to 32 bytes, s = 0, v = 1
const prevalidated = owner.slice(2).toLowerCase().padStart(64, '0') + '0'.repeat(64) + '01'
// EIP-1271 owner: variable length, v = 0. Accept any even-length hex >= 65 bytes.
// Order ASCENDING by owner as a number (BigInt compare). String/localeCompare order yields GS026.
```

Before spending gas or a Relayr payment on an execution: re-read `approvedHashes(owner, safeTxHash) > 0` for every `v = 1` entry, then `eth_call execTransaction` **from `address(0)`** (never an owner — owner callers pass the `msg.sender` shortcut even after revocation) and require the decoded `bool` to be `true`. Confirm landing with the `ExecutionSuccess(bytes32 txHash, uint256 payment)` log from the Safe: v1.3 puts `txHash` in `data` (1 topic, 130-hex data), v1.4 indexes it (2 topics, 66-hex data).

### Safe executions through Relayr

`execTransaction` is permissionless (owner signatures ride in calldata), so a ready Safe transaction becomes a raw bundle entry with no forwarder: `{ chain, target: safe, data: execTransaction(...), value: '0' }`. One payment executes every ready transaction on every chain. Landing proof per chain: `getTransaction(hash).to == safe`, `input == entry.data`, `receipt.status === 'success'`, Safe `nonce() > proof.nonce`, and an `ExecutionSuccess` log for the exact `safeTxHash`. Sessions scoped `safe-queue:*` resume only from the project's queue card, never from a generic account view, because the proof needs that context.

## Step sequences

| Step | EOA (multi-chain) | Safe with service | Safe without service |
|------|-------------------|-------------------|----------------------|
| 1 | Classify authority on every chain; connected == authority | Classify; connected must be an owner on every selected chain, Safe deployed on all | Same |
| 2 | Simulate each call from the authority with a builder gas cap; keep the measured gas | Simulate each call from the Safe address | Same |
| 3 | Resume a saved Relayr session if one exists for this scope (skip 2 for it) | Read service nonce + pending queue; dedupe | Read on-chain `nonce()`, threshold, owners; assign provisional nonce |
| 4 | Switch wallet to each chain, sign ForwardRequest (measured gas, 47 h deadline) | Switch wallet to chain, sign SafeTx, POST proposal (or confirmation) | `approveHash(safeTxHash)` from the signer; wait for receipt |
| 5 | POST bundle; authenticate quote; pay on the active chain | Other owners confirm in Safe app or via `/confirmations/` | Other owners `approveHash`; read `approvedHashes` |
| 6 | Poll bundle; verify each destination receipt | At threshold: `execTransaction` directly (front nonce) or via Relayr batch | At threshold and current nonce: `execTransaction` with `v = 1` signatures |
| 7 | Report per-chain; partial on any failure | Verify `ExecutionSuccess`; report per chain | Same |

Safe App connector with `connected == authority` is a fourth mode: one reviewed call at a time, `sendTransaction({ gas: 0n })` → `safeTxHash` → service → execution hash → receipt.

## Relayr execution layer

Shapes, forwarder types and status states are in `jb-relayr`. Execution rules on top:

| Rule | Detail |
|------|--------|
| Payment pinning | Reject any `payment_info[]` whose `target`, selector, or contract code hash differ from the pinned values in `jb-relayr`; `eth_getCode` ≤ 2048 bytes; payment chains {1, 10, 8453, 42161}; token must be native `0xeeee…eeee` |
| Calldata layout | `selector ‖ bytes16(uuid without dashes, right-padded) ‖ uint40 deadline` (136 hex chars after `0x`); the embedded deadline must equal `payment_deadline` and exceed now + 15 s |
| Quote re-derivation | Re-authenticate the payment details three times: before review, after the wallet client is obtained, and immediately before `sendTransaction`. The review dialog has no time bound |
| Payment send | Simulate with `eth_call` (result must be `0x`), then send with a fixed 150 000 gas; through the Safe App connector the returned hash is a `safeTxHash` — resolve it via the service before the receipt |
| Gas | Each ForwardRequest's `gas` is the measured value from the simulation pass (default 500 000 when unmeasured). Simulate under a cap, then estimate within it; never send the cap |
| Active chain | Switch the wallet to the target chain before every `signTypedData` and to the payment chain before paying; verify `getAccount().chainId` actually changed. A mismatch surfaces as `-32603 "Provided chainId … must match the active chainId"` |
| Session | Persist `{ bundleUuid, paymentHash, paymentChainId, chainIds, expectedCount, records, account, createdAt }` under `jb-relayr-pending-v1:<scope>` the moment the wallet returns a payment hash. `createdAt` is taken **before the first signature**; the session expires at `createdAt + 47 h` |
| Resume | On entry, load the session for the scope and poll it **before** re-simulating — post-payment state changes make a fresh simulation revert and would trigger a duplicate quote and payment. Require the same account |
| Polling | 2.5 s interval, 5 min timeout → "still processing, do not submit again"; 3 consecutive 404s → bundle unknown, start over; any `Failed` → stop with the records |
| Receipts | For every record read `status.data.hash` (or `status.data.transaction.hash`), map it to its chain by `request.chain` or by submission index, and require `receipt.status === 'success'` on that chain before calling it done |
| Partial completion | Some chains `Success`, others `Failed`/pending → report per-chain results and keep the session; never "complete" |

## Same-address Safes across chains

A Safe's address is `CREATE2(factory, keccak(initializer) ‖ saltNonce, singleton)`, so replaying the creation (`createProxyWithNonce(singleton, initializer, saltNonce)` on the same factory) yields the identical address on another chain. Read the creation from any chain's service, require matching factory/singleton bytecode on source and destination, and after the receipt confirm bytecode exists at the expected address (retry ~6× at 1.5 s; a lagging RPC returns empty first).

Cross-chain authority checks compare owners, threshold, and module-free policy, not the exact singleton. Safe UI creations (1.4.1) pass `SafeToL2Setup` (`0xBD89A1CE4DDe368FFAB0eC35506eEcE0b1fFdc54`, runtime hash `0x2f25df28caf984366ee584e13241707e85dcd5a6ea0c14267928dafc1fd6274b`) with `setupToL2(SafeL2)` (selector `0xfe51f643`), which repoints slot 0 to SafeL2 only when `chainid != 1`. Result: Safe on Ethereum, SafeL2 on every L2, same address. Treat that pair as equivalent; treat `Safe ↔ delegated-eoa` and `Safe ↔ eoa` on the destination as "not deployed there" and offer the same-address deploy. `paymentReceiver` `0x5afe7a11e7…0000` is Safe's vanity marker, not tampering.

## Deadlines

Swap/liquidity deadlines are 20 minutes for an EOA and 30 days (`30 * 24 * 60 * 60`) when the signer is a Safe — co-signer collection outlives 20 minutes, and slippage floors are already frozen in the proposal. Permit2 approvals use the same 30-day window. ForwardRequest deadlines stay at 47 h (Relayr max 48 h).

## Common mistakes

- Polling `waitForTransactionReceipt(safeTxHash)`. It is a digest; resolve it through the service first.
- Building a service URL from the app-prefix map. OP Sepolia and Arbitrum Sepolia have app links but no service; calls there hang forever.
- Signing a ForwardRequest for a Safe authority. The forwarder is ECDSA-only.
- Sorting execution signatures with `localeCompare`. Sort by `BigInt(owner)`; otherwise GS026.
- Filtering confirmations to exactly 130 hex chars. EIP-1271 owner signatures are longer and were silently dropped, leaving Execute locked below threshold.
- Simulating `execTransaction` from an owner address. Use `address(0)` so revoked `approveHash` entries fail instead of passing via `msg.sender`.
- Approving several no-service transactions at the same nonce. Only one executes; assign sequential nonces or do one at a time.
- Sending the simulation gas cap as the transaction gas. Wallets reserve `cap × maxFeePerGas`.
- Re-simulating a recovered session before polling it. Post-payment reverts then produce a second payment.
- Stamping the Relayr session at payment time. Deadlines run from signing; a "still valid" resume dies at the forwarder.
- Rejecting an L1 `Safe` / L2 `SafeL2` singleton pair as a policy mismatch. Decode the initializer for `0xfe51f643` first.
- Treating a Relayr `Success` state as proof. Fetch the destination receipt on that chain.
