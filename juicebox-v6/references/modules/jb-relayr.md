---
name: jb-relayr
description: |
  Relayr API for multi-chain transaction bundling. Use when: (1) deploying omnichain Juicebox
  projects (pay gas once, execute on all chains), (2) implementing ERC-2771 meta-transactions
  through the Juicebox ERC2771Forwarder, (3) debugging Relayr quote/status errors or
  SimulationReverted, (4) bundling sequential same-chain transactions (virtual nonces),
  (5) building cross-chain UX where the user pays on one preferred chain. Covers ForwardRequest
  signing, bundle polling, and error handling.
version: 6.0.0
---

# Relayr — Multi-Chain Transaction Bundling

Relayr is a permissionless meta-transaction relay by 0xBASED. The user signs an ERC-2771 forward request per target chain, pays once on a chain of their choice, and Relayr executes on every chain. No API key.

```
1. Sign an ERC2771 ForwardRequest for each target chain
2. POST the bundle to Relayr → quote with per-chain payment options
3. Pay once on the chosen chain
4. Poll the bundle until every transaction reports Success
```

```
API:       https://api.relayr.ba5ed.com
Dashboard: https://relayr.ba5ed.com
```

## API endpoints

### 1. Create bundle — `POST /v1/bundle/prepaid`

```json
{
  "transactions": [
    { "chain": 1,  "target": "0x…forwarder", "data": "0x…execute-calldata", "value": "0", "virtual_nonce": 0 },
    { "chain": 10, "target": "0x…forwarder", "data": "0x…execute-calldata", "value": "0", "virtual_nonce": 0 }
  ],
  "virtual_nonce_mode": "ChainIndependent"
}
```

| Field | Notes |
|-------|-------|
| `chain` | Target chain ID (number) |
| `target` | Contract to call — the `ERC2771Forwarder` for meta-transactions |
| `data` | Encoded `forwarder.execute(request)` calldata |
| `value` | ETH the relayer must attach, as a string. Nonzero when the forwarded call itself forwards ETH (e.g. a project-creation fee) — Relayr's quote covers it |
| `virtual_nonce` | Per-chain ordering index (0,1,2… in intended execution order) |
| `virtual_nonce_mode` | `"Disabled"` or `"ChainIndependent"` |

**Virtual nonce modes.** `ChainIndependent`: chains execute in parallel, but one chain's transactions run strictly in `virtual_nonce` order, each simulated against the previous one's resulting state. Required for sequential same-chain transactions (e.g. Safe `execTransaction`s at consecutive nonces) — in `Disabled` mode every transaction is quoted against current state, so a future-nonce transaction fails with `SimulationReverted`. One-transaction-per-chain bundles behave identically in both modes (every tx gets `virtual_nonce: 0`).

**Response:**

```json
{
  "bundle_uuid": "550e8400-…",
  "payment_info": [
    { "chain": 1, "target": "0x…", "amount": "1234567890", "calldata": "0x…", "token": "0x…", "payment_deadline": "…" }
  ]
}
```

Pay by sending a transaction on `payment_info[i].chain` to `target` with `value: amount` and `data: calldata`. One payment funds all chains.

### 2. Bundle status — `GET /v1/bundle/{bundle_uuid}`

Each entry in `transactions[]` carries a nested status object:

```javascript
tx.status.state                 // "Success" | "Failed" | pending states
tx.status.data.hash             // destination tx hash once Success
tx.status.data.transaction.hash // tx hash in non-final states
```

Poll every ~2.5s; done when every `tx.status.state === 'Success'`; fail fast on any `'Failed'`. Quotes expire — pay promptly and re-quote if gas moved.

## ERC-2771 forward requests

The forwarder is the OpenZeppelin `ERC2771Forwarder` deployed at the `ERC2771Forwarder` address in `references/shared/chain-config.json` (same address on every chain). All Juicebox V6 core contracts, hooks, suckers, and deployers trust it, so `_msgSender()` inside those contracts is the original signer.

**Read the EIP-712 domain from the contract** via EIP-5267 `eip712Domain()` instead of hardcoding it (the deployed name is `"Juicebox"`, version `"1"`):

```javascript
const [, name, version] = await pub.readContract({ address: forwarder, abi, functionName: 'eip712Domain' });
const domain = { name, version, chainId: BigInt(chainId), verifyingContract: forwarder };
```

**Signed type** (includes `nonce`):

```javascript
const types = { ForwardRequest: [
  { name: 'from', type: 'address' }, { name: 'to', type: 'address' },
  { name: 'value', type: 'uint256' }, { name: 'gas', type: 'uint256' },
  { name: 'nonce', type: 'uint256' }, { name: 'deadline', type: 'uint48' },
  { name: 'data', type: 'bytes' },
]};
```

**Execute struct** (what goes on-chain — `nonce` is NOT a member; `signature` is):

```javascript
const executeAbi = [{ type: 'function', name: 'execute', stateMutability: 'payable', inputs: [{
  name: 'request', type: 'tuple', components: [
    { name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'value', type: 'uint256' },
    { name: 'gas', type: 'uint256' }, { name: 'deadline', type: 'uint48' },
    { name: 'data', type: 'bytes' }, { name: 'signature', type: 'bytes' },
  ]}], outputs: [] }];
```

Per-chain flow:

```javascript
const nonce = await pub.readContract({ address: forwarder, abi, functionName: 'nonces', args: [from] });
const deadline = Math.floor(Date.now() / 1000) + 47 * 3600;   // < Relayr's 48h max
const message = { from, to, value: 0n, gas: 500000n, nonce, deadline, data };
const signature = await wallet.signTypedData({ domain, types, primaryType: 'ForwardRequest', message });
const execData = encodeFunctionData({ abi: executeAbi, functionName: 'execute',
  args: [{ from, to, value: 0n, gas: 500000n, deadline, data, signature }] });
// bundle entry: { chain, target: forwarder, data: execData, value: '0' }
```

**Wallet must be on the target chain to sign.** MetaMask (and Ledger-via-MetaMask) rejects `eth_signTypedData_v4` when the domain's `chainId` differs from the wallet's active chain. Switch chains before signing each per-chain request, and switch again to the payment chain before paying.

## Error handling

| Symptom | Cause | Fix |
|---------|-------|-----|
| `SimulationReverted` on quote | Calldata reverts against current chain state; or sequential same-chain txs quoted in `Disabled` mode | Debug the call on that chain; use `ChainIndependent` + `virtual_nonce` for sequences |
| HTTP 4xx/5xx on quote | Malformed transactions array | Read the response body — Relayr returns a text detail |
| Nonce too low | Forwarder nonce already consumed | Re-read `nonces(from)` and re-sign |
| Deadline expired | Signature older than its `deadline` | Re-sign; keep deadlines < 48h |
| Payment ignored | Quote expired before payment | Request a fresh quote immediately before paying |
| One chain `Failed`, others `Success` | Per-chain execution is independent | Handle partial completion; the failed chain's calldata usually reverts on-chain — debug there |

## Best practices

1. Quote immediately before paying — gas prices move.
2. Read the forwarder nonce fresh per chain, per bundle.
3. Set `gas` generously (the forwarder enforces the signed gas as a minimum for the inner call).
4. Poll at 2–3s, time out after ~5 minutes, and surface per-chain states.
5. For sequential same-chain work, order the transactions array and use `ChainIndependent`.
6. When the inner call needs ETH (creation fees, `toRemote` fees), set the same amount as the request's `value`, the bundle entry's `value`, and let the quote price it in.

## Related skills

- `jb-suckers` — deploying suckers symmetrically across chains via one bundle
- `jb-omnichain-per-chain-projectids` — use the right projectId per chain in each transaction's calldata
