# Chancy x402 Payment Flow

## The 402 Envelope

When you call a paid endpoint without a valid payment, Chancy returns:

```http
HTTP/1.1 402 Payment Required
PAYMENT-REQUIRED: <base64-encoded JSON>
Content-Type: application/json
```

Decoded, the `PAYMENT-REQUIRED` header looks like:

```json
{
  "x402Version": 2,
  "error": "Payment required",
  "resource": {
    "url": "https://chancy.cash/v2/x402/sessions/create",
    "description": "Chancy — create game session (host funds prize pot)",
    "mimeType": "application/json"
  },
  "accepts": [
    {
      "scheme": "exact",
      "network": "eip155:8453",
      "amount": "5000000",
      "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "payTo": "0xbcd9b0ba388608598f9eaab43bfc7ba44324f860",
      "maxTimeoutSeconds": 300,
      "extra": {
        "name": "USD Coin",
        "version": "2"
      }
    }
  ]
}
```

### Reading the amount

The `amount` field is in **USDC units (6 decimals)**. So `5000000` = $5.00.

### Dynamic pricing

For tile clicks, the amount changes per call based on game mode:

| Mode | Per-tile cost |
|---|---|
| Easy | $0.05 (50000 units) |
| Normal | $0.05 (50000 units) |
| Hardcore | $0.10 (100000 units) |

**Always read the amount from the 402 envelope** — never hard-code it.

## Signing EIP-3009 TransferWithAuthorization

USDC on Base supports gasless transfers via EIP-3009. The x402 flow uses
the `TransferWithAuthorization` function.

### EIP-712 typed data

```json
{
  "domain": {
    "name": "USD Coin",
    "version": "2",
    "chainId": 8453,
    "verifyingContract": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
  },
  "types": {
    "TransferWithAuthorization": [
      { "name": "from", "type": "address" },
      { "name": "to", "type": "address" },
      { "name": "value", "type": "uint256" },
      { "name": "validAfter", "type": "uint256" },
      { "name": "validBefore", "type": "uint256" },
      { "name": "nonce", "type": "bytes32" }
    ]
  },
  "primaryType": "TransferWithAuthorization",
  "message": {
    "from": "<payer_wallet>",
    "to": "0xbcd9b0ba388608598f9eaab43bfc7ba44324f860",
    "value": "<amount_from_402>",
    "validAfter": 0,
    "validBefore": "<current_time + 3600>",
    "nonce": "<0x + 64 random hex chars>"
  }
}
```

### Bankr wallet signing

On Bankr, the wallet layer handles this automatically. The agent calls
the endpoint, the 402 is intercepted, and the retry happens with the
signed payment. No manual EIP-712 code needed.

For non-Bankr signing (e.g., viem):

```javascript
import { signTypedData } from 'viem/accounts';

const signature = await signTypedData(client, {
  domain: {
    name: 'USD Coin',
    version: '2',
    chainId: 8453,
    verifyingContract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  },
  types: {
    TransferWithAuthorization: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
    ],
  },
  primaryType: 'TransferWithAuthorization',
  message: {
    from: payerAddress,
    to: '0xbcd9b0ba388608598f9eaab43bfc7ba44324f860',
    value: amount,
    validAfter: 0,
    validBefore: Math.floor(Date.now() / 1000) + 3600,
    nonce: randomNonce,
  },
});
```

## Building the X-Payment header

The retry request includes an `X-Payment` header containing the signed
payment payload as base64-encoded JSON:

```json
{
  "signature": "0x...",
  "from": "<payer_wallet>",
  "to": "0xbcd9b0ba388608598f9eaab43bfc7ba44324f860",
  "value": "5000000",
  "validAfter": "0",
  "validBefore": "1719300000",
  "nonce": "0x...",
  "authorizer": "<payer_wallet>"
}
```

Base64-encode this JSON and pass as the `X-Payment` header value.

## Settlement verification

After a successful 200 response, the payment has been (or is being)
settled on-chain via the Coinbase CDP facilitator. You can verify:

```bash
# Check the payer's USDC balance decreased
# Check the payTo address received funds
# Both happen via standard ERC-20 Transfer events on Base
```

## Error handling

| HTTP Status | Meaning | Action |
|---|---|---|
| 200 | Success | Parse response body |
| 402 | Payment required/invalid | Re-read envelope, re-sign, retry |
| 403 | Forbidden | Wrong wallet for session |
| 404 | Session not found | Session doesn't exist or expired |
| 429 | Rate limited | Honor Retry-After header |
| 502 | Facilitator unreachable | Back off and retry |
