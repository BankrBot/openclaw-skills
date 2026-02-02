---
name: clawpay
version: 1.0.0
description: Private payments for AI agents - no on-chain link between sender and recipient
author: clawpay
homepage: https://clawpay.dev
tags: [privacy, payments, railgun, usdt, agents, tips]
metadata:
  emoji: 🦞
  category: payments
  api_base: https://clawpay.dev
---

# ClawPay 🦞

**Private payments for AI agents. Recipient sees funds from Railgun - no link to you.**

> **Network: BSC (BNB Chain)** | Tokens: USDT, USDC | Proof time: ~60 seconds

> ⚠️ **Security**: Your signature proves wallet ownership. Never share it with untrusted services.

## TL;DR for Agents

```typescript
const API = 'https://clawpay.dev'
const SIG_MSG = 'b402 Incognito EOA Derivation'

// 1. Sign message (proves you own the wallet)
// ethers.js:
const signature = await wallet.signMessage(SIG_MSG)
// viem:
// const signature = await walletClient.signMessage({ message: SIG_MSG })
// web3.js:
// const signature = await web3.eth.personal.sign(SIG_MSG, myAddress, '')

// 2. Get your invoice address
const { invoiceAddress } = await fetch(
  `${API}/invoice?eoa=${myAddress}&signature=${encodeURIComponent(signature)}`
).then(r => r.json())

// 3. Send USDT to invoice (standard ERC20 transfer)
await usdtContract.transfer(invoiceAddress, parseUnits('1.00', 18))

// 4. Execute private transfer
const { transferId } = await fetch(`${API}/transfer`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    eoa: myAddress,
    signature,
    recipient: '0xRecipient...',
    amount: '1.00',
    token: 'USDT'
  })
}).then(r => r.json())

// Done! Recipient gets funds from Railgun in ~60s (ZK proof time)
```

## Response Format

All endpoints return JSON:
```json
// Success
{ "success": true, "invoiceAddress": "0x...", ... }

// Error
{ "success": false, "error": "message", "hint": "how to fix" }
```

## How It Works

```
YOU                           API                          RECIPIENT
 │                             │                               │
 ├─ Send USDT to invoice ─────►│                               │
 │  (public transfer)          │                               │
 │                             │                               │
 ├─ Sign message ─────────────►│                               │
 │  (proves ownership)         │                               │
 │                             │                               │
 ├─ POST /transfer ───────────►│                               │
 │                             ├─► Shield to Railgun           │
 │                             ├─► Generate ZK proof           │
 │                             ├─► Unshield to recipient ─────►│
 │                             │                               │
 │                             │   Funds appear from Railgun   │
 │                             │   NO LINK TO YOU              │
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Check API status |
| `/invoice?eoa=...&signature=...` | GET | Get invoice address (signature required) |
| `/balance?eoa=...&signature=...&token=USDT` | GET | Check shielded balance |
| `/transfer` | POST | Execute private transfer |
| `/status/:id` | GET | Check transfer status |
| `/faucet` | POST | Get BNB for gas (demo) |

## Step-by-Step for Agents

### 1. Check if you have BNB for gas

You need ~0.0003 BNB to transfer USDT to the invoice address.

```typescript
const API_URL = process.env.CLAWPAY_API_URL || 'https://clawpay.dev'

// If you don't have BNB, request from faucet (demo only)
const faucetRes = await fetch(`${API_URL}/faucet`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ address: myWalletAddress })
})
```

### 2. Sign the authorization message FIRST

```typescript
const SIGN_MESSAGE = 'b402 Incognito EOA Derivation'
const signature = await wallet.signMessage(SIGN_MESSAGE)
// Keep this signature - you'll use it for both /invoice and /transfer
```

### 3. Get your invoice address (requires signature)

```typescript
const invoiceRes = await fetch(
  `${API_URL}/invoice?eoa=${myWalletAddress}&signature=${encodeURIComponent(signature)}`
)
const { invoiceAddress } = await invoiceRes.json()
// invoiceAddress: where to send tokens
```

### 4. Send USDT to invoice address

Standard ERC20 transfer:
```typescript
const usdt = new ethers.Contract(USDT_ADDRESS, ERC20_ABI, wallet)
await usdt.transfer(invoiceAddress, ethers.parseUnits('0.10', 18))
```

### 5. Execute private transfer (same signature)

```typescript
const transferRes = await fetch(`${API_URL}/transfer`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    eoa: myWalletAddress,
    signature,  // Same signature from step 2
    recipient: recipientAddress,
    amount: '0.10',
    token: 'USDT'
  })
})

const { transferId, status } = await transferRes.json()
// status: 'pending' → funds will arrive in 1-5 minutes (ZK proof generation)
```

## Privacy Guarantees

- **No on-chain link**: Recipient sees transfer from Railgun contract, not your address
- **ZK proofs**: Cryptographic proof that funds are valid without revealing source
- **Fast delivery**: ~60 seconds for ZK proof generation, then immediate unshield

## Supported Tokens

| Token | Address |
|-------|---------|
| USDT | `0x55d398326f99059fF775485246999027B3197955` |
| USDC | `0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d` |

## Rate Limits

- Faucet: 1 claim per address per 24 hours
- Transfers: No limit (but ZK proof takes 1-5 minutes)

## Example: Tip an Agent

```typescript
// Agent receives a tip and wants to pay it forward
async function tipAgent(recipientAddress: string, amount: string) {
  const API_URL = process.env.CLAWPAY_API_URL || 'https://clawpay.dev'
  const SIGN_MESSAGE = 'b402 Incognito EOA Derivation'

  // 1. Sign first (needed to derive invoice address)
  const signature = await wallet.signMessage(SIGN_MESSAGE)

  // 2. Get invoice address (with signature)
  const { invoiceAddress } = await fetch(
    `${API_URL}/invoice?eoa=${myAddress}&signature=${encodeURIComponent(signature)}`
  ).then(r => r.json())

  // 3. Transfer USDT to invoice
  const usdt = new ethers.Contract(USDT_ADDRESS, ERC20_ABI, wallet)
  await usdt.transfer(invoiceAddress, ethers.parseUnits(amount, 18))

  // 4. Execute private transfer (same signature)
  const result = await fetch(`${API_URL}/transfer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eoa: myAddress,
      signature,
      recipient: recipientAddress,
      amount,
      token: 'USDT'
    })
  }).then(r => r.json())

  console.log(`Transfer initiated: ${result.transferId}`)
  console.log('Recipient will receive funds in 1-5 minutes (ZK proof time)')
}
```

## Troubleshooting

| Error | Solution |
|-------|----------|
| "Insufficient balance" | Make sure you transferred USDT to the invoice address |
| "Signature does not match" | Sign the exact message: "b402 Incognito EOA Derivation" |
| "No spendable UTXOs" | Wait 1-2 minutes for indexing after transfer |

---

**Built on Railgun** | Privacy for the agent economy

Learn more: https://clawpay.dev
