---
name: cc0company-x402-payments
version: 1.0.0
description: Canonical x402 v2 client reference for cc0.company. Three signing patterns (viem one-liner, Bankr HTTP, CDP SDK), Coinbase Bazaar discovery, error matrix.
homepage: https://cc0.company
network: eip155:8453
facilitator: https://api.cdp.coinbase.com/platform/v2/x402
---

# x402 Payments on cc0.company — Skill for AI Agents

Two cc0.company endpoints are x402-gated:

- `POST /api/store/agent-services/:slug/invoke` — AI image generation (0.069 USDC)
- `POST /api/store/agent-assets/:slug/buy` — Buy a CC0 asset (price varies)

Both use **x402 v2** on Base mainnet. The flow is identical: call without payment → receive a 402 challenge → sign an EIP-3009 USDC `transferWithAuthorization` for the requested amount → retry with the signed payload in `PAYMENT-SIGNATURE`. The legacy `X-PAYMENT` header is still accepted on `/agent-assets/buy` for compatibility, but new integrations should use `PAYMENT-SIGNATURE`.

## Network + asset constants

```
Network:           Base mainnet (chainId 8453, CAIP-2 eip155:8453)
USDC contract:     0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
EIP-712 domain:    { name: "USD Coin", version: "2", chainId: 8453, verifyingContract: <USDC contract> }
Facilitator:       https://api.cdp.coinbase.com/platform/v2/x402 (Coinbase CDP)
```

The `payTo` address and `maxAmountRequired` value come from the **live 402 response** — never hard-code them.

## Pattern A — `@x402/fetch` + viem (recommended, one-liner)

Works for **any wallet where you can produce a viem-compatible signer**: throwaway hot keys (`generatePrivateKey()`), exported private keys from CDP / Base MCP, browser-extension wallets via WalletConnect, etc.

```bash
npm install @x402/fetch @x402/evm viem
```

```typescript
import { x402Client, wrapFetchWithPayment } from "@x402/fetch"
import { registerExactEvmScheme } from "@x402/evm/exact/client"
import { privateKeyToAccount } from "viem/accounts"

const signer = privateKeyToAccount(YOUR_PRIVATE_KEY as `0x${string}`)
const client = new x402Client()
registerExactEvmScheme(client, { signer })
const fetchWithPayment = wrapFetchWithPayment(fetch, client)

// Any fetch through this wrapper auto-handles 402 challenges:
const res = await fetchWithPayment(
  "https://cc0.company/api/store/agent-services/sartoshi-gen/invoke",
  {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Agent-Name": "your_handle" },
    body: JSON.stringify({ prompt: "..." }),
  }
)
const job = await res.json()
```

The wrapper catches the 402, signs `transferWithAuthorization` with your viem signer, attaches `PAYMENT-SIGNATURE`, and retries — zero manual typed-data work.

## Pattern B — Bankr (HTTP-only, no Node needed)

For agents running in environments where you can't import npm packages but you can `curl`. Bankr exposes a typed-data signing endpoint at `/wallet/sign` (the older `/agent/sign` is deprecated and returns HTML — make sure you hit the new path).

```bash
# 1. Get the 402 challenge — read paymentRequired from the response body
CHALLENGE=$(curl -s -X POST https://cc0.company/api/store/agent-services/sartoshi-gen/invoke \
  -H "Content-Type: application/json" \
  -d '{"prompt": "..."}')

PAY_TO=$(echo "$CHALLENGE" | jq -r '.paymentRequired.payTo')
AMOUNT=$(echo "$CHALLENGE" | jq -r '.paymentRequired.maxAmountRequired')
USDC="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
NONCE="0x$(openssl rand -hex 32)"
VALID_BEFORE=$(( $(date +%s) + 600 ))
FROM=$(bankr prompt "What is my wallet address on Base?" | jq -r '.address')

# 2. Ask Bankr to sign the EIP-712 typed data
SIG=$(curl -s -X POST https://api.bankr.bot/wallet/sign \
  -H "X-API-Key: $BANKR_KEY" \
  -H "Content-Type: application/json" \
  -d @- <<JSON | jq -r '.signature'
{
  "signatureType": "eth_signTypedData_v4",
  "typedData": {
    "types": {
      "TransferWithAuthorization": [
        {"name": "from",         "type": "address"},
        {"name": "to",           "type": "address"},
        {"name": "value",        "type": "uint256"},
        {"name": "validAfter",   "type": "uint256"},
        {"name": "validBefore",  "type": "uint256"},
        {"name": "nonce",        "type": "bytes32"}
      ]
    },
    "primaryType": "TransferWithAuthorization",
    "domain": {
      "name": "USD Coin", "version": "2", "chainId": 8453,
      "verifyingContract": "$USDC"
    },
    "message": {
      "from": "$FROM", "to": "$PAY_TO", "value": "$AMOUNT",
      "validAfter": "0", "validBefore": "$VALID_BEFORE", "nonce": "$NONCE"
    }
  }
}
JSON
)

# 3. CRITICAL: send x402v2 envelope. The accepted field MUST contain
# the FULL paymentRequirements object from the 402 verbatim — the
# server matches it with deepEqual. The v1 path is broken in
# @x402/core v2.12 (matcher reads paymentPayload.accepted.scheme but
# v1 schema doesn't have an `accepted` field) — use v2 always.
ACCEPTED=$(echo "$CHALLENGE" | jq -c '.accepts[0] // .paymentRequired')

PAYLOAD=$(jq -nc \
  --arg sig "$SIG" --arg from "$FROM" --arg to "$PAY_TO" --arg val "$AMOUNT" \
  --arg vb "$VALID_BEFORE" --arg n "$NONCE" --argjson acc "$ACCEPTED" \
  '{
    x402Version: 2,
    accepted: $acc,
    payload: {
      signature: $sig,
      authorization: { from: $from, to: $to, value: $val, validAfter: "0", validBefore: $vb, nonce: $n }
    }
  }' | base64 -w0)

# 4. Retry with PAYMENT-SIGNATURE
curl -X POST https://cc0.company/api/store/agent-services/sartoshi-gen/invoke \
  -H "Content-Type: application/json" \
  -H "PAYMENT-SIGNATURE: $PAYLOAD" \
  -d '{"prompt": "..."}'
```

### Bankr API key gotchas

Three separate flags can each cause a `403 Forbidden` on `/wallet/sign` or `/agent/submit`:

1. **"Disable arbitrary contract calls"** toggle (default ON for new accounts). Blocks raw deploys / mints / custom contract calls. Fix: [bankr.bot/security](https://bankr.bot/security) → flip OFF.
2. **`readOnly: true`** on the API key. Blocks every write endpoint. Fix: edit the key, flip OFF.
3. **`allowedRecipients` restriction.** Blocks any raw submission since Bankr can't verify recipients from calldata. Fix: clear it.

If you can't or won't change these, use Pattern A (CDP / viem) — no Bankr-side config to manage.

## Pattern C — CDP SDK / Coinbase Agentic Wallet

The CDP SDK's `cdp.evm.getOrCreateAccount(...)` returns an account that already implements viem's `LocalAccount` interface — including `signTypedData`. **No wrapping needed.** Plug it straight into Pattern A's `registerExactEvmScheme({ signer })`. Keys stay in Coinbase's Nitro Enclave the whole time.

```typescript
import { CdpClient } from "@coinbase/cdp-sdk"
import { x402Client, wrapFetchWithPayment } from "@x402/fetch"
import { registerExactEvmScheme } from "@x402/evm/exact/client"

const cdp = new CdpClient({
  apiKeyId: process.env.CDP_API_KEY_ID,
  apiKeySecret: process.env.CDP_API_KEY_SECRET,
})

// This account exposes signTypedData natively — pass directly.
const signer = await cdp.evm.getOrCreateAccount({ name: "my-agent" })

const client = new x402Client()
registerExactEvmScheme(client, { signer })
const fetchWithPayment = wrapFetchWithPayment(fetch, client)

// Use exactly like Pattern A.
```

> **CDP gotcha:** don't call `wallet.sign()` — that's raw-bytes
> signing only. The account from `getOrCreateAccount()` is a viem
> `LocalAccount`; pass it as `signer`. If you genuinely need manual
> typed-data signing, call `account.signTypedData({ domain, types,
> primaryType, message })` directly.
>
> If your `@coinbase/cdp-sdk` is older than v1.40, upgrade:
> `npm i @coinbase/cdp-sdk@latest`.

## What cc0.company actually needs from your wallet

1. A Base EVM address (`0x...`).
2. The ability to sign EIP-3009 `transferWithAuthorization` for x402 payments.
3. (For ERC1155 mint) the ability to send arbitrary transactions (`sendTransaction`) for collection deploys.

If your wallet does all three, you can use every cc0.company endpoint.

## Bazaar discovery + agentic.market

Every paid endpoint on cc0.company is automatically indexed by the **Coinbase x402 Bazaar** after its first successful settlement. **agentic.market** reads from the same Bazaar index — so once an agent has paid us at least once, the entire catalogue surfaces on `https://agentic.market` and at the CDP discovery API.

```bash
# Returns every cc0.company service from the CDP discovery index:
curl "https://api.cdp.coinbase.com/platform/v2/x402/discovery/merchant?payTo=<X402_RECEIVER_ADDRESS>"

# Semantic search across the Bazaar:
curl "https://api.cdp.coinbase.com/platform/v2/x402/discovery/search?query=cc0+image+generation&network=eip155:8453"

# Browse from agentic.market:
curl "https://agentic.market/v1/services/search?q=cc0"
```

The CDP catalogue refreshes on a ~6-hour schedule. Newly-deployed services may take a refresh cycle to appear.

## Error matrix

| Code | Means | What to do |
|---|---|---|
| `400` | Invalid prompt or missing buyer wallet | Fix payload + retry |
| `402` | Payment required (first request) | Sign + retry |
| `402 verification failed` | Signed but the payment doesn't cover `maxAmountRequired` or tx is invalid | Re-quote, re-sign |
| `425` | Tx pending (humans only — `pay-and-invoke` flow) | Retry with backoff |
| `5xx` | Server / generation failure | Payment auto-cancels; retry once |
| Job `failed` after retry | Generation crashed twice | Backend auto-refunds; `refund_tx_hash` in the job |

## Related skills

- [`../agent-services/SKILL.md`](../agent-services/SKILL.md) — the
  5 image-gen models pay via this protocol
- [`../erc1155-mint/SKILL.md`](../erc1155-mint/SKILL.md) — uses ETH
  not USDC, but the agent flow (quote → pay → retry with tx_hash)
  has the same shape

## License

CC0.
