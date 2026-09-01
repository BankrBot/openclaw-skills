# x402 buyer flow — reference for the hyperD skill

Brief reference: how an agent calls a paid hyperD endpoint. The skill's main `SKILL.md` describes WHEN to call which endpoint; this reference covers HOW the payment handshake works so an agent can debug if a call fails.

## The four-step handshake

1. **Agent makes a normal GET** — no auth header, no API key. Just the URL.

   ```http
   GET /api/risk/wallet?address=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 HTTP/2
   Host: api.hyperd.ai
   ```

2. **Server returns HTTP 402** with a machine-readable `payment-required` header.

   ```
   HTTP/2 402
   payment-required: eyJ4NDAyVmVyc2lvbiI6Mi4uLg==
   content-type: application/json

   {
     "x402Version": 2,
     "accepts": [{
       "scheme": "exact",
       "network": "eip155:8453",
       "amount": "100000",
       "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
       "payTo": "0x61b51131E1e44552dE2F151Ca59DAc707D9cf1C6"
     }]
   }
   ```

3. **Agent signs an EIP-3009 USDC transfer authorization** on Base, with the buyer wallet, scoped to this exact request. Retries with `X-Payment` and `X-Payment-Signature` headers.

4. **Coinbase facilitator settles** in ~2 seconds. Server returns the actual data (200) with response headers carrying the settlement transaction hash.

## Reference clients

- **TypeScript** — `@x402/fetch` + `@x402/evm`:
  ```ts
  import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
  import { ExactEvmScheme } from "@x402/evm";
  import { privateKeyToAccount } from "viem/accounts";

  const account = privateKeyToAccount("0x...");
  const fetchWithPay = wrapFetchWithPaymentFromConfig(globalThis.fetch, {
    schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(account) }],
  });

  const res = await fetchWithPay("https://api.hyperd.ai/api/risk/wallet?address=0x...");
  const data = await res.json();
  ```

- **Python** — see [hyperd-mcp/examples/python/risk_sentinel.py](https://github.com/hyperd-ai/hyperd-mcp/blob/main/examples/python/risk_sentinel.py) for a 50-line reference implementation (`eth-account` + `requests`).

- **Bankr/Claude inside an agent** — use `@hyperd-ai/plugin-hyperd` (ElizaOS) or the MCP server (`npx -y hyperd-mcp`); both abstract the handshake away.

## Funding the buyer wallet

The agent needs USDC on Base. ~$5 is plenty for hundreds of calls. Bridge from Ethereum, buy directly on Base via Coinbase or Coinbase Wallet.

## Failure modes worth knowing

- **402 returned a second time after retry** — payment was rejected by facilitator. Most common cause: insufficient USDC balance, or `payTo` mismatch (verify the wallet returned in the 402 challenge matches what your client signed).
- **Settlement timeout** — facilitator is slow. Retry the original GET; the payment authorization is valid for the EIP-3009 deadline window.
- **400 on first GET** — endpoint param validation failed. Check the canonical query-string format under each endpoint's section in SKILL.md.

## Sources of truth

- **Catalog**: `GET https://api.hyperd.ai/api/catalog` returns the full machine-readable catalog with prices and methods.
- **Pricing**: `GET https://api.hyperd.ai/api/pricing` is a price-list-only view.
- **Discovery**: `GET https://api.hyperd.ai/api/discover` is the Bazaar-format catalog (resource URLs, accept arrays).
- **Health**: `GET https://api.hyperd.ai/api/health` for liveness and current version.

All four are free (no x402 handshake).
