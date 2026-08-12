# Bitcoin PSBT Batch Payments Reference

## Overview

Spraay supports non-custodial batch Bitcoin payments using Partially Signed Bitcoin Transactions (PSBTs). The gateway prepares the transaction — the user signs locally with their wallet. Chain #13 in the Spraay ecosystem.

**Key principle:** Spraay never holds private keys. The PSBT flow keeps the user in full control.

## Architecture

```
User Request → Spraay Gateway (prepare PSBT) → User Wallet (sign) → Spraay Gateway (broadcast)
```

1. User submits recipients and amounts
2. Gateway selects UTXOs, builds transaction, returns unsigned PSBT
3. User signs with UniSat, Xverse, or any PSBT-compatible wallet
4. User sends signed PSBT back to gateway for broadcast

## Endpoints

### Fee Estimation
```
GET https://gateway.spraay.app/api/bitcoin/fee-estimate
```

Response:
```json
{
  "fastestFee": 25,
  "halfHourFee": 18,
  "hourFee": 12,
  "economyFee": 6,
  "minimumFee": 2
}
```

### Prepare Batch PSBT
```
POST https://gateway.spraay.app/api/bitcoin/batch-prepare
```

Request:
```json
{
  "recipients": [
    {"address": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh", "amount": 50000},
    {"address": "bc1q9h5yjqka3pv4gn9j5dzqkl3c6eyzngr2t3fvf", "amount": 25000}
  ],
  "feeRate": 12,
  "changeAddress": "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| recipients | array | Yes | Array of {address, amount} (amount in sats) |
| feeRate | number | Yes | Fee rate in sat/vB |
| changeAddress | string | Yes | Address for change output |

Response:
```json
{
  "psbt": "cHNidP8BAH0CAAAA...",
  "fee": 1680,
  "totalInput": 76680,
  "totalOutput": 75000,
  "changeAmount": 0,
  "inputCount": 2,
  "outputCount": 2
}
```

### Broadcast Signed Transaction
```
POST https://gateway.spraay.app/api/bitcoin/batch-broadcast
```

Request:
```json
{
  "signedPsbt": "cHNidP8BAH0CAAAA..."
}
```

Response:
```json
{
  "txId": "a1b2c3d4e5f6...",
  "status": "broadcast",
  "explorerUrl": "https://mempool.space/tx/a1b2c3d4e5f6..."
}
```

### UTXO Query
```
GET https://gateway.spraay.app/api/bitcoin/utxos/:address
```

Returns available UTXOs for an address to help with transaction planning.

## Supported Wallets

| Wallet | PSBT Support | Signing Method |
|--------|-------------|----------------|
| UniSat | Full | In-browser |
| Xverse | Full | In-browser |
| Sparrow | Full | Desktop |
| BlueWallet | Full | Mobile |
| Ledger (BTC) | Full | Hardware |

## Address Types

Spraay supports all Bitcoin address types:
- **P2WPKH** (bc1q...): Native SegWit — recommended, lowest fees
- **P2TR** (bc1p...): Taproot
- **P2SH** (3...): Nested SegWit
- **P2PKH** (1...): Legacy

## Frontend Integration

The Spraay Bitcoin dApp at `btc.spraay.app` (also `spraay.app/bitcoin`) provides a UI for:
- Connecting UniSat/Xverse wallet
- Entering batch recipients
- Reviewing and signing the PSBT
- Broadcasting the signed transaction

Repository: `plagtech/spraay-bitcoin`

## Error Handling

| Error | Meaning | Resolution |
|-------|---------|------------|
| INSUFFICIENT_UTXOS | Not enough BTC in wallet | Fund the wallet or reduce batch size |
| INVALID_ADDRESS | Bad Bitcoin address format | Verify address encoding |
| FEE_TOO_LOW | Fee rate below network minimum | Increase feeRate |
| PSBT_INVALID | Signed PSBT is malformed | Re-sign with compatible wallet |
| BROADCAST_FAILED | Network rejected transaction | Check for double-spend or RBF conflict |

## Bankr Integration

For Bankr users who want to distribute BTC profits:

```javascript
// 1. Get fee estimate
const fees = await fetch("https://gateway.spraay.app/api/bitcoin/fee-estimate").then(r => r.json());

// 2. Prepare batch PSBT
const psbt = await fetch("https://gateway.spraay.app/api/bitcoin/batch-prepare", {
  method: "POST",
  headers: {"Content-Type": "application/json"},
  body: JSON.stringify({
    recipients: [
      {address: "bc1q...", amount: 100000},
      {address: "bc1q...", amount: 50000}
    ],
    feeRate: fees.halfHourFee,
    changeAddress: userChangeAddress
  })
}).then(r => r.json());

// 3. User signs with wallet (UniSat example)
const signedPsbt = await window.unisat.signPsbt(psbt.psbt);

// 4. Broadcast
const result = await fetch("https://gateway.spraay.app/api/bitcoin/batch-broadcast", {
  method: "POST",
  headers: {"Content-Type": "application/json"},
  body: JSON.stringify({signedPsbt})
}).then(r => r.json());
```
