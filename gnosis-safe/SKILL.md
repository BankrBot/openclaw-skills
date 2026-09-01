---
name: gnosis-safe
description: Interact with Gnosis Safe multisig wallets — propose transactions, check status, list pending proposals, and execute when threshold is met
metadata: {"clawdbot":{"emoji":"🔐","homepage":"https://safe.global","requires":{"bins":["curl","python3","bankr"]}}}
---

# Gnosis Safe Skill

Interact with Gnosis Safe multisig wallets on Base, Ethereum, and Polygon. Supports proposing transactions, approving via on-chain `approveHash`, querying pending proposals, and executing transactions when threshold is met.

---

## Prerequisites

- `curl` — for Safe Transaction Service API calls
- `python3` with `eth_utils` — for EIP-712 hash computation (`pip install eth-utils`)
- `bankr` — for on-chain calls (`approveHash`, `execTransaction`)

> ⚠️ **Important:** The Safe contract address must be in Bankr's **trusted recipients list** before you can call `approveHash` or `execTransaction` via Bankr. Add it via the Bankr dashboard, or run:
> ```
> bankr agent 'add 0xYourSafeAddress to my trusted recipient addresses'
> ```

---

## Chain Configuration

| Chain    | Chain ID | Safe TX Service URL                                  |
|----------|----------|------------------------------------------------------|
| Base     | 8453     | `https://safe-transaction-base.safe.global`          |
| Ethereum | 1        | `https://safe-transaction-mainnet.safe.global`       |
| Polygon  | 137      | `https://safe-transaction-polygon.safe.global`       |

Set `CHAIN` to `base`, `ethereum`, or `polygon`. Scripts auto-resolve the URL.

---

## Operation 1: Check Safe Info

Get current nonce, threshold, owners, and ETH balance for a Safe.

```bash
./scripts/safe_info.sh <SAFE_ADDRESS> <CHAIN>

# Example:
./scripts/safe_info.sh 0xYourSafeAddress base
```

**What it returns:**
- `nonce` — current transaction sequence number (use this when proposing)
- `threshold` — number of confirmations required to execute
- `owners` — list of owner addresses
- ETH balance from the blockchain

**API used:**
```
GET {TX_SERVICE}/api/v1/safes/{safe_address}/
```

---

## Operation 2: Propose a Transaction

Propose a new transaction to a Safe. This involves three steps:
1. Compute the EIP-712 `safeTxHash` in Python
2. Call `approveHash(bytes32)` on-chain via Bankr (registers your approval on-chain)
3. POST the proposal + contract signature to the Safe Transaction Service

```bash
python3 scripts/propose_tx.py \
  --safe    0xYourSafeAddress \
  --to      0xRecipientAddress \
  --value   0.01 \
  --chain   8453

# With explicit signer address (optional — auto-detected via 'bankr whoami' if omitted):
python3 scripts/propose_tx.py \
  --safe    0xYourSafeAddress \
  --to      0xRecipientAddress \
  --value   0.01 \
  --chain   8453 \
  --signer  0xYourSignerAddress

# With calldata (optional):
python3 scripts/propose_tx.py \
  --safe    0xYourSafeAddress \
  --to      0xContractAddress \
  --value   0 \
  --data    0xabcdef1234 \
  --chain   8453
```

**What happens under the hood:**

### Step A — EIP-712 Hash Computation

```python
from eth_utils import keccak

def compute_safe_tx_hash(safe_address, to, value_wei, nonce, chain_id, data=b""):
    DOMAIN_SEPARATOR_TYPEHASH = keccak(b"EIP712Domain(uint256 chainId,address verifyingContract)")
    domain_data = (DOMAIN_SEPARATOR_TYPEHASH +
                   chain_id.to_bytes(32, 'big') +
                   bytes.fromhex(safe_address[2:].lower().zfill(64)))
    domain_separator = keccak(domain_data)

    SAFE_TX_TYPEHASH = keccak(b"SafeTx(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,uint256 nonce)")

    to_bytes = bytes.fromhex(to[2:].lower().zfill(64))
    value_bytes = value_wei.to_bytes(32, 'big')
    data_hash = keccak(data)
    zeros = bytes(32)

    safe_tx_data = (SAFE_TX_TYPEHASH + to_bytes + value_bytes + data_hash +
                    zeros + zeros + zeros + zeros + zeros + zeros +
                    nonce.to_bytes(32, 'big'))
    safe_tx_hash_inner = keccak(safe_tx_data)
    final_hash = keccak(b"\x19\x01" + domain_separator + safe_tx_hash_inner)
    return "0x" + final_hash.hex()
```

All non-essential fields (`operation`, `safeTxGas`, `baseGas`, `gasPrice`, `gasToken`, `refundReceiver`) default to zero.

### Step B — On-Chain Approval via Bankr

The script uses `bankr agent` with a raw-transaction prompt to call `approveHash(bytes32)` on-chain:

```
bankr agent "Submit raw transaction on Base (chain 8453):
- to: <safe_address>
- data: 0xd4d9bdcd<safe_tx_hash_without_0x_padded_to_64_chars>
- value: 0
Wait for confirmation and return the tx hash."
```

Function selector: `0xd4d9bdcd` (`approveHash(bytes32)`)

This records your approval on-chain. The Safe contract's `approvedHashes[caller][txHash]` mapping is set to `1`.

### Step C — Contract Signature Encoding

Since Bankr holds the key server-side, use a **contract signature** (v=1):

```python
def build_contract_signature(signer_address):
    r = signer_address[2:].lower().zfill(64)  # address padded to 32 bytes
    s = "0" * 64                               # 32 zero bytes
    v = "01"                                   # type 1 = contract signature
    return "0x" + r + s + v
```

### Step D — POST to Safe Transaction Service

```bash
curl -X POST "{TX_SERVICE}/api/v1/safes/{safe_address}/multisig-transactions/" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "<to>",
    "value": "<value_wei>",
    "data": "<hex_data_or_null>",
    "operation": 0,
    "safeTxGas": 0,
    "baseGas": 0,
    "gasPrice": "0",
    "gasToken": "0x0000000000000000000000000000000000000000",
    "refundReceiver": "0x0000000000000000000000000000000000000000",
    "nonce": <nonce>,
    "contractTransactionHash": "<safe_tx_hash>",
    "sender": "<signer_address>",
    "signature": "<contract_signature>"
  }'
```

---

## Operation 3: List Pending Transactions

Show all pending (unexecuted) proposals with confirmation counts.

```bash
./scripts/list_pending.sh <SAFE_ADDRESS> <CHAIN>

# Example:
./scripts/list_pending.sh 0xYourSafeAddress base
```

**Output includes:**
- `safeTxHash` — the EIP-712 hash uniquely identifying this proposal
- `nonce` — transaction sequence number
- `to`, `value`, `data` — destination, ETH value, calldata
- `confirmations` — list of addresses that have approved
- `confirmationsRequired` — threshold

**API used:**
```
GET {TX_SERVICE}/api/v1/safes/{safe_address}/multisig-transactions/?executed=false&ordering=-nonce
```

---

## Operation 4: Check If a Hash Is Approved

Query whether a specific owner has approved a given `safeTxHash` on-chain via the Safe TX Service:

```bash
curl -s "{TX_SERVICE}/api/v1/safes/{safe_address}/multisig-transactions/?safe_tx_hash={safe_tx_hash}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('Confirmed' if d['results'][0]['confirmations'] else 'Not confirmed')"
```

Or use `bankr agent` to query on-chain:

```bash
bankr agent "Call approvedHashes on Safe {safe_address} on Base with args ['{owner_address}', '{safe_tx_hash}']. Return 1 if approved, 0 if not."
```

Function selector: `0x7d832974` (`approvedHashes(address,bytes32)`)

Returns `1` if approved, `0` if not.

---

## Operation 5: Execute a Transaction

Once the required number of approvals (`threshold`) is reached, execute via `bankr agent`:

```bash
bankr agent "Call execTransaction on Safe contract 0xYourSafeAddress on Base with:
- to: 0xRecipient
- value: <value_wei>
- data: 0x
- operation: 0
- safeTxGas: 0
- baseGas: 0
- gasPrice: 0
- gasToken: 0x0000000000000000000000000000000000000000
- refundReceiver: 0x0000000000000000000000000000000000000000
- signatures: <packed_signatures>"
```

Function selector: `0x6a761202` (`execTransaction(...)`)

**Packed signatures** — concatenate all contract signatures sorted by signer address (ascending). Each signature is 65 bytes: r (32 bytes, address padded) + s (32 bytes, zeros) + v (1 byte, `0x01`).

```python
def build_packed_signatures(signer_addresses):
    """Build packed signatures sorted by address (required by Safe)."""
    sorted_addresses = sorted(signer_addresses, key=lambda a: a.lower())
    packed = "0x"
    for addr in sorted_addresses:
        packed += addr[2:].lower().zfill(64)  # r: address as bytes32
        packed += "0" * 64                     # s: 32 zero bytes
        packed += "01"                          # v: contract signature type
    return packed
```

> 💡 Alternatively, use the Safe UI at `app.safe.global` — connect your wallet and execute from there once threshold is met. The Transaction Service will show it as ready.

---

## Typical Workflow

```
1. Check Safe info to get current nonce and threshold
   └─ ./scripts/safe_info.sh 0xSafe base

2. Propose transaction (computes hash, approves on-chain, posts to service)
   └─ python3 scripts/propose_tx.py --safe 0xSafe --to 0xRecipient --value 0.5 --chain 8453

3. Share safeTxHash with other owners so they can approve
   └─ They can approve via Safe UI or another approveHash call

4. List pending to check confirmation count
   └─ ./scripts/list_pending.sh 0xSafe base

5. Once threshold is met, execute
   └─ bankr agent "Call execTransaction on Safe 0xSafe on Base with to 0xRecipient ..."
      OR use Safe UI at app.safe.global
```

---

## Error Reference

| Error | Cause | Fix |
|-------|-------|-----|
| `1337` (Safe TX service) | Nonce already used or invalid signature | Check nonce with `safe_info.sh`, verify signer is an owner |
| `approveHash` reverts | Safe address not in Bankr trusted list | Add via Bankr dashboard or `bankr agent 'add 0xSafe to my trusted recipient addresses'` |
| `CALL_EXCEPTION` | Wrong RPC or contract address | Verify chain ID matches RPC and safe address |
| `confirmations not met` | Not enough approvals | Check threshold vs confirmed count with `list_pending.sh` |

---

## Function Selectors Reference

| Function | Selector |
|----------|----------|
| `approveHash(bytes32)` | `0xd4d9bdcd` |
| `approvedHashes(address,bytes32)` | `0x7d832974` |
| `execTransaction(...)` | `0x6a761202` |
| `getOwners()` | `0xa0e67e2b` |
| `getThreshold()` | `0xe75235b8` |
| `nonce()` | `0xaffed0e0` |

---

## Notes

- All transactions default to `operation=0` (CALL). Use `operation=1` for DELEGATECALL only if you know what you're doing.
- `gasToken` and `refundReceiver` are set to zero address (no gas refund).
- `safeTxGas`, `baseGas`, `gasPrice` are all `0` — Safe will use whatever gas is available.
- The Safe TX Service is off-chain infrastructure — it queues proposals and tracks signatures but does NOT execute transactions itself.
- Contract signatures (v=1) rely on the Safe checking `approvedHashes[signer][txHash] == 1` on-chain during execution.
