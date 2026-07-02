---
name: ironbridge-receipt
description: |
  Get a verifiable, result-bound receipt for a paid agent call. IronBridge settles the call on
  Base and issues a receipt that binds the exact request bytes, the exact response bytes, and
  the payment transaction — so anyone can later prove WHAT the call returned, not just that
  money moved.
  Use when an agent pays another agent or API and needs durable, recomputable proof of the
  result. Payment is pay-then-prove: send USDC on Base to the published receiver, then resend
  with the tx hash. IronBridge never takes custody of your wallet.
  Triggers: "give me a receipt for that call", "prove what this paid call returned", "settle
  this paid API call with proof", "pay and get verifiable evidence of the result".
---

# IronBridge — Receipt (pay-then-prove)

Payment proves money moved. IronBridge proves the *call* — it binds a payment to the exact
result it paid for, so anyone can check the pairing later without trusting the seller.

**Base URL:** `https://ironbridge.foundation` · **Network:** Base mainnet · **Asset:** USDC
**Receiver:** `0x5Bb0a8A570F73eE0575043B8A9c33b28D6891680` (a public 2-of-2 Safe)

## Paid lanes

Each lane is `POST /api/pay/<lane>/<tool>`, 0.1 USDC/call:

| Lane / tool | What it does |
|---|---|
| `POST /api/pay/bnkr/bnkr_llm_chat` | LLM chat completion (messages body) |
| `POST /api/pay/solvr/solvr_dex_search` | DEX search (query) |
| `POST /api/pay/solvr/solvr_dex_trending` | trending DEX tokens |
| `POST /api/pay/clerk/clerk_search` | search |
| `POST /api/pay/gitlawb/gitlawb_commit` | commit action |

## The flow

1. `POST` the lane with your JSON body → **HTTP 402** with
   `x-payment-info: {"scheme":"pay-then-prove","network":"base","receiver":"0x5Bb0…1680","price_usdc":0.1}`.
2. Send `price_usdc` USDC to `receiver` on Base **from your own wallet**. IronBridge holds no
   key and never takes custody.
3. Resend the **same** request with header `X-IB-Payment-Tx: <txHash>` → result + receipt id.

```bash
# 1) discover price + receiver
curl -s -X POST https://ironbridge.foundation/api/pay/bnkr/bnkr_llm_chat \
  -H 'content-type: application/json' \
  --data '{"messages":[{"role":"user","content":"one-line summary of ERC-8004"}]}'

# 2) pay 0.1 USDC to receiver on Base from your wallet (get <txHash>)

# 3) resend with proof of payment
curl -s -X POST https://ironbridge.foundation/api/pay/bnkr/bnkr_llm_chat \
  -H 'content-type: application/json' \
  -H 'X-IB-Payment-Tx: <txHash>' \
  --data '{"messages":[{"role":"user","content":"one-line summary of ERC-8004"}]}'
# -> result + receipt id
```

> Not the auto-settle x402 interceptor pattern — there is no `402 → auto-sign → retry` step.
> You send the USDC transfer yourself and prove it with the header. This keeps the buyer
> non-custodial.

## What the receipt binds

| Field | Meaning |
|---|---|
| `request_sha256` | SHA-256 of the exact request bytes — which input was paid for |
| `data_sha256` | SHA-256 of the exact response bytes — which output was returned |
| `txHash` | the Base USDC payment transaction |
| `payer` | the address that paid |
| `rid` | receipt id → `GET /api/receipt/<rid>` |

## Verify it (free)

Anyone — including you — can confirm the receipt for free with the **`ironbridge-verify`**
skill (or `GET /api/receipt/<rid>` and recompute the hashes). Share the human page at
`https://ironbridge.foundation/proof/<seal_id>` as portable evidence.
