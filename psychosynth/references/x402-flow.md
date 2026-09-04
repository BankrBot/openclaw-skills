# Psychosynth x402 payment flow

Two settlement models are accepted on Base. Standard EIP-3009 is the
recommended path and the one Bankr platform wallets sign automatically.

## Path A — standard x402 (EIP-3009, server settles)

1. `GET /api/v1/query/{slug}` without `X-PAYMENT` → `402` JSON:

   ```
   {
     "x402Version": 1,
     "accepts": [
       {
         "scheme": "exact",
         "network": "base",
         "payTo": "0x…",
         "maxAmountRequired": "10000",        // USDC base units (6 decimals)
         "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
         "resource": "<url>",
         "maxTimeoutSeconds": 86400,
         "extra": { "name": "USD Coin", "version": "2",
                    "assetTransferMethod": "eip3009" }
       },
       { …optional solana entry (Path B only)… }
     ],
     "tiers": [ { "tier": "base", … }, { "tier": "pack-5k", … } ],
     "settlement": { "methods": ["eip3009", "txhash"] },
     "binding": { "required": true, "appliesTo": "txhash settlements only", … }
   }
   ```

2. Sign EIP-712 `TransferWithAuthorization` against the USDC contract:

   ```
   domain   = { name: extra.name, version: extra.version,
                chainId: 8453, verifyingContract: accepts.asset }
   primary  = "TransferWithAuthorization"
   types    = { TransferWithAuthorization: [
                  { name: "from",        type: "address" },
                  { name: "to",          type: "address" },
                  { name: "value",       type: "uint256" },
                  { name: "validAfter",  type: "uint256" },
                  { name: "validBefore", type: "uint256" },
                  { name: "nonce",       type: "bytes32" },
                ] }
   message  = { from: <your wallet>, to: accepts.payTo,
                value: accepts.maxAmountRequired,
                validAfter: 0, validBefore: now + 3600,
                nonce: <random 32 bytes> }
   ```

3. Retry the same URL with the payment header:

   ```
   X-PAYMENT: base64({
     "x402Version": 1, "scheme": "exact", "network": "base",
     "payload": { "signature": "0x…", "authorization": { … } }
   })
   ```

   The server verifies and settles through an x402 facilitator (the
   facilitator broadcasts and pays gas), then serves the data in the
   same HTTP response. The settlement tx hash becomes the single-use
   payment reference — an authorization cannot be redeemed twice
   (on-chain nonce) and a served payment cannot be replayed (unique
   `payment_sig` guard).

No binding signature is required on this path.

## Path B — self-settled txHash (fallback; also the only Solana path)

1. Transfer the exact USDC amount to `accepts[].payTo` yourself (Base or
   Solana; wait for finality).
2. Sign the binding challenge from the 402 quote (`binding.challenge`,
   newline-separated, values filled in) with the PAYING wallet:
   - Base: `eip191-personal-sign`
   - Solana: `ed25519`
3. Send:

   ```
   X-PAYMENT: base64({
     "x402Version": 1, "scheme": "exact", "network": "base" | "solana",
     "payload": { "txHash": "…", "payer": "<paying wallet>",
                  "signature": "<binding signature>" }
   })
   ```

Binding is enforced in production for this path — it stops observers
from front-running a public txHash. Payments are single-use and
tier-bound; an underpaying tx cannot redeem a more expensive tier.

## Retry posture

- `425 not_ready` / `503 infra`: the payment was NOT consumed — retry
  the same payment after a short backoff.
- `402` after sending payment: re-fetch the quote and re-sign; prices or
  quote fields may have changed.
- `409 replay`: that txHash is spent. Do not retry; investigate before
  paying again.
