# Safe Transaction Service API Reference

Reference for the Gnosis Safe Transaction Service REST API endpoints used by this skill.

Base documentation: https://safe-transaction-base.safe.global/ (replace `base` with chain name)

---

## Base URLs by Chain

| Chain    | Chain ID | Base URL                                             |
|----------|----------|------------------------------------------------------|
| Base     | 8453     | `https://safe-transaction-base.safe.global`          |
| Ethereum | 1        | `https://safe-transaction-mainnet.safe.global`       |
| Polygon  | 137      | `https://safe-transaction-polygon.safe.global`       |
| Arbitrum | 42161    | `https://safe-transaction-arbitrum.safe.global`      |
| Optimism | 10       | `https://safe-transaction-optimism.safe.global`      |

---

## Endpoints Used by This Skill

### GET /api/v1/safes/{address}/

Retrieve Safe information: nonce, threshold, owners, version, master copy, etc.

**Request:**
```
GET https://safe-transaction-base.safe.global/api/v1/safes/0xYourSafeAddress/
Accept: application/json
```

**Response (200):**
```json
{
  "address": "0xYourSafeAddress",
  "nonce": 5,
  "threshold": 2,
  "owners": [
    "0xOwner1Address",
    "0xOwner2Address"
  ],
  "masterCopy": "0x...",
  "modules": [],
  "fallbackHandler": "0x...",
  "guard": "0x0000000000000000000000000000000000000000",
  "version": "1.3.0"
}
```

**Key fields:**
- `nonce` — use this value when proposing a new transaction
- `threshold` — number of approvals required to execute
- `owners` — list of authorized signers

---

### GET /api/v1/safes/{address}/multisig-transactions/

List multisig transactions for a Safe. Supports filtering and ordering.

**Query parameters:**

| Parameter   | Type    | Description                                         |
|-------------|---------|-----------------------------------------------------|
| `executed`  | bool    | `false` for pending, `true` for executed, omit both for all |
| `ordering`  | string  | Field to sort by. Use `-nonce` for newest first, `nonce` for oldest first |
| `limit`     | int     | Max results to return (default 10, max 100)         |
| `offset`    | int     | Pagination offset                                   |
| `nonce`     | int     | Filter by exact nonce                               |
| `nonce__gte`| int     | Filter nonce >= value                               |
| `to`        | address | Filter by destination address                       |
| `trusted`   | bool    | `true` to return only trusted (confirmed) proposals |

**Request (pending txs):**
```
GET https://safe-transaction-base.safe.global/api/v1/safes/0xYourSafeAddress/multisig-transactions/?executed=false&ordering=-nonce&limit=20
```

**Response (200):**
```json
{
  "count": 2,
  "next": null,
  "previous": null,
  "results": [
    {
      "safe": "0xYourSafeAddress",
      "to": "0xRecipientAddress",
      "value": "10000000000000000",
      "data": null,
      "operation": 0,
      "gasToken": "0x0000000000000000000000000000000000000000",
      "safeTxGas": 0,
      "baseGas": 0,
      "gasPrice": "0",
      "refundReceiver": "0x0000000000000000000000000000000000000000",
      "nonce": 5,
      "submissionDate": "2024-01-15T10:30:00.000000Z",
      "modified": "2024-01-15T10:31:00.000000Z",
      "blockNumber": null,
      "transactionHash": null,
      "safeTxHash": "0xabcdef...",
      "executor": null,
      "isExecuted": false,
      "isSuccessful": null,
      "ethGasPrice": null,
      "maxFeePerGas": null,
      "maxPriorityFeePerGas": null,
      "gasUsed": null,
      "fee": null,
      "origin": null,
      "dataDecoded": null,
      "confirmationsRequired": 2,
      "confirmations": [
        {
          "owner": "0xOwner1Address",
          "submissionDate": "2024-01-15T10:30:00.000000Z",
          "transactionHash": null,
          "signature": "0x...",
          "signatureType": "CONTRACT_SIGNATURE"
        }
      ],
      "trusted": true,
      "signatures": "0x...",
      "isExecutable": false
    }
  ]
}
```

**Key fields per transaction:**
- `safeTxHash` — unique identifier for this proposal (EIP-712 hash)
- `nonce` — must match current Safe nonce for execution
- `confirmationsRequired` — threshold (from Safe config)
- `confirmations` — list of owners who have approved
- `isExecutable` — `true` when enough confirmations to execute
- `isExecuted` — `true` once the tx has been sent on-chain

---

### POST /api/v1/safes/{address}/multisig-transactions/

Propose a new multisig transaction. Requires a valid EIP-712 hash and signature.

**Request:**
```
POST https://safe-transaction-base.safe.global/api/v1/safes/0xYourSafeAddress/multisig-transactions/
Content-Type: application/json
```

**Request body:**
```json
{
  "to": "0xRecipientAddress",
  "value": "10000000000000000",
  "data": null,
  "operation": 0,
  "safeTxGas": 0,
  "baseGas": 0,
  "gasPrice": "0",
  "gasToken": "0x0000000000000000000000000000000000000000",
  "refundReceiver": "0x0000000000000000000000000000000000000000",
  "nonce": 5,
  "contractTransactionHash": "0xabcdef...",
  "sender": "0xYourSignerAddress",
  "signature": "0x000000000000000000000000YourSignerAddress000000000000000000000000000000000000000000000000000000000000000001"
}
```

**Field notes:**
- `contractTransactionHash` — the EIP-712 safeTxHash (computed off-chain)
- `sender` — address that called `approveHash` on-chain
- `signature` — contract signature (see encoding below)
- All non-essential fields should be zero/null

**Contract signature encoding (v=1):**
```
r = sender_address padded to 32 bytes (64 hex chars)
s = 32 zero bytes (64 hex chars)
v = "01" (1 byte = contract signature type)
full = "0x" + r + s + v  (= 130 hex chars = 65 bytes)
```

**Response:**
- `201 Created` — success, no body
- `200 OK` — success (some versions)
- `422 Unprocessable Entity` — invalid data (wrong hash, invalid signer, wrong nonce)
- `400 Bad Request` — malformed request

**Common error codes:**
- `1337` — nonce collision or invalid signature
- Verify signer is an owner of the Safe
- Verify nonce matches current Safe nonce (not future or past)

---

### GET /api/v1/safes/{address}/multisig-transactions/{safe_tx_hash}/

Get details for a specific transaction by its safeTxHash.

**Request:**
```
GET https://safe-transaction-base.safe.global/api/v1/safes/0xYourSafeAddress/multisig-transactions/0xabcdef.../
```

Returns same structure as individual item in the list endpoint.

---

### POST /api/v1/multisig-transactions/{safe_tx_hash}/confirmations/

Add a confirmation (signature) to an existing proposal without re-proposing.

Used when a second owner wants to approve an already-proposed transaction.

**Request:**
```
POST https://safe-transaction-base.safe.global/api/v1/multisig-transactions/0xabcdef.../confirmations/
Content-Type: application/json

{
  "signature": "0x..."
}
```

For contract signatures (approveHash), the signature format is the same as during proposal.

---

## On-Chain Contract Interface

These are the Safe contract functions called directly (not through the TX service).

### approveHash(bytes32 hashToApprove)

**Selector:** `0xd4d9bdcd`

Marks a hash as approved by the caller. Sets `approvedHashes[msg.sender][hashToApprove] = 1`.

```
bankr call \
  --to <safe_address> \
  --key <bankr_key> \
  --rpc <rpc_url> \
  --abi "approveHash(bytes32)" \
  --args '["<safe_tx_hash>"]'
```

---

### approvedHashes(address owner, bytes32 hash) returns (uint256)

**Selector:** `0x7d832974`

Read-only check. Returns `1` if `owner` has approved `hash`, else `0`.

```
bankr call \
  --to <safe_address> \
  --rpc <rpc_url> \
  --abi "approvedHashes(address,bytes32)(uint256)" \
  --args '["<owner_address>", "<safe_tx_hash>"]'
```

---

### execTransaction(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,bytes) returns (bool)

**Selector:** `0x6a761202`

Execute a transaction when threshold is met. Requires packed signatures sorted by owner address ascending.

```
bankr call \
  --to <safe_address> \
  --key <bankr_key> \
  --rpc <rpc_url> \
  --abi "execTransaction(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,bytes)(bool)" \
  --args '["<to>","<value>","<data>",0,0,0,0,"0x000...000","0x000...000","<packed_sigs>"]'
```

**Packed signatures:** Concatenate contract signatures for all approvers sorted by address (ascending). Each is 65 bytes.

---

### getOwners() returns (address[])

**Selector:** `0xa0e67e2b`

Returns the list of current Safe owners.

---

### getThreshold() returns (uint256)

**Selector:** `0xe75235b8`

Returns the current confirmation threshold.

---

### nonce() returns (uint256)

**Selector:** `0xaffed0e0`

Returns the current nonce. Note: the TX service also exposes this but on-chain is the source of truth.

---

## EIP-712 Hash Computation

The `safeTxHash` is an EIP-712 typed data hash. It uniquely identifies a transaction proposal.

### Type Hashes

```
DOMAIN_SEPARATOR_TYPEHASH = keccak256("EIP712Domain(uint256 chainId,address verifyingContract)")

SAFE_TX_TYPEHASH = keccak256(
  "SafeTx(address to,uint256 value,bytes data,uint8 operation,"
  "uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,"
  "address gasToken,address refundReceiver,uint256 nonce)"
)
```

### Computation Steps

1. `domainSeparator = keccak256(DOMAIN_SEPARATOR_TYPEHASH || chainId || safe_address)`
2. `safeTxHashInner = keccak256(SAFE_TX_TYPEHASH || to || value || keccak256(data) || operation || safeTxGas || baseGas || gasPrice || gasToken || refundReceiver || nonce)` (all fields padded to 32 bytes)
3. `safeTxHash = keccak256(0x1901 || domainSeparator || safeTxHashInner)`

All simple types (address, uint) are ABI-encoded as 32-byte big-endian. `bytes` type is hashed with `keccak256`.

---

## Notes

- The Safe Transaction Service is operated by Safe{DAO}. It is off-chain infrastructure.
- Proposals stored in the service are not binding — they're just a coordination layer.
- The on-chain `approveHash` call is what actually records the approval on-chain.
- During `execTransaction`, Safe checks each signature: for contract signatures (v=1), it reads `approvedHashes[r_address][txHash]`.
- Always use checksummed addresses (EIP-55) when interacting with the service.
