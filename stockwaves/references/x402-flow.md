# x402 Payment Flow

Two ways to pay, in order of preference.

## 1. Bankr wallet signing (preferred)
If running inside Bankr, let Bankr sign: call `/agent/sign` with a Bankr API key (`X-API-Key`, Agent API + signing enabled, not read-only). Bankr handles the 402 challenge/settle for you — you just issue the request.

## 2. Vanilla x402 (any agent)
For non-Bankr agents, do the standard challenge → sign → retry. This is the recipe verified end-to-end against these endpoints (the load-bearing detail is the `PAYMENT-SIGNATURE` request header — not `X-PAYMENT`).

### Protocol
1. Send the request (GET, or POST with a JSON body) without payment headers.
2. If status is `402`, base64-decode the `PAYMENT-REQUIRED` response header → the challenge JSON (`accepts` offers Base `eip155:8453` AND Solana; asset USDC; scheme `exact`).
3. Build a payment payload from the challenge and encode it as the `PAYMENT-SIGNATURE` header.
4. Retry the SAME request (do not mutate path/query/body) with that header.
5. On success, read the data and the `PAYMENT-RESPONSE` settle receipt.

### Reference implementation (TypeScript)
```ts
import { x402Client, x402HTTPClient } from "@x402/core/client";
import { encodePaymentSignatureHeader } from "@x402/core/http";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const signer = privateKeyToAccount(process.env.EVM_PRIVATE_KEY as `0x${string}`);
const client = new x402Client();
registerExactEvmScheme(client, { signer });
const http = new x402HTTPClient(client);

export async function pay(url: string, init: RequestInit = {}) {
  let res = await fetch(url, init);
  if (res.status === 402) {
    const challenge = JSON.parse(Buffer.from(res.headers.get("PAYMENT-REQUIRED")!, "base64").toString());
    const sig = encodePaymentSignatureHeader(await http.createPaymentPayload(challenge));
    res = await fetch(url, { ...init, headers: { ...init.headers, "PAYMENT-SIGNATURE": sig } });
  }
  return res.json();
}
```

### Reliability rules
- Do NOT change path/query/body between the challenge and the paid retry.
- One nonce settles once: a duplicate/replayed `PAYMENT-SIGNATURE` is rejected (the facilitator dedups in-flight). Build a fresh payment per logical call.
- Settlement happens only when the handler returns status < 400 — a `4xx` (bad params) means you were NOT charged.
- Pay on EITHER rail; pick Solana if your wallet is SPL-funded, Base if EVM-funded.
