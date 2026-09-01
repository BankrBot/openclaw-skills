# Flash API reference (companion)

Canonical base URL: `https://flash.definitive.fi/v1`
Agent docs: https://flash.definitive.fi/docs/for-agents
OpenAPI: https://flash.definitive.fi/v1/openapi.json
Get a key / contact: https://www.definitive.fi/flash-api#contact
Official MCP: `@definitive-fi/flash-mcp` (github.com/DefinitiveCo/flash-mcp)

## Auth

Pass a Flash API key in the `x-definitive-api-key` header on every request.
**No HMAC / request signing** — the key alone authenticates. A shared integrator
key is published in the docs for testing; register your own org to get a
dedicated key.

## Supported chains

arbitrum, avalanche, base, bsc, ethereum, optimism, polygon, solana, hyperevm,
plasma, monad, robinhood.

## Endpoints

### GET /search
`GET /search?query=weth&chain=base&limit=1` — resolve a symbol/name/address to a
token `{ chain, address, symbol, decimals, price, ... }`. `chain` optional; `limit`
defaults to 10, max 25. Feed `address` + `chain` into `targetAsset`/`targetChain`
or `contraAsset`/`contraChain`.

### POST /quote
Body (essentials):
```jsonc
{
  "side": "buy",              // "buy" | "sell"
  "orderType": "market",     // market | limit | twap | stop | stop-loss | take-profit | bracket
  "targetAsset": "0x4200000000000000000000000000000000000006", // token bought/sold (hex EVM, base58 mint SVM)
  "targetChain": "base",
  "contraAsset": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", // funding/counter token
  "contraChain": "base",
  "qty": "500.0",             // decimal STRING, in the SPENT asset's units (contra on buy, target on sell)
  "funderAddress": "0x...",  // wallet that signs & funds (payload encodes this; omit -> empty signing payload)

  // limit:
  "limitNotionalPrice": "3200.0",
  // twap:
  "durationSeconds": 7200,     // >= 300
  // trigger orders (stop / stop-loss / take-profit / bracket):
  "triggers": [{ "triggerType": "lower", "price": "2900.0" }],
  // cross-chain market only:
  "recipientAddress": "0x...",
  // optional integrator fee (echo same value on /order):
  "flashIntegratorFeeBps": "10"
}
```
Returns: `quoteId` (echo on submit), `bridgeQuoteId` (crosschain), `from`/`to`
legs, `fees.estimatedFeeNotional`, `wrap` (null unless spending native gas), and
chain-specific signing payloads:
- **EVM:** `evm.orderTypedData` (EIP-712 to sign), optional `evm.permitTypedData`
  (Permit2), optional `evm.approveTx` (ERC-20 allowance to submit first).
- **Solana:** `svm.orderMessage` (UTF-8 to Ed25519-sign), `svm.nonce`,
  `svm.deadline`, optional `svm.ataSetupIxs`, `svm.delegateIx` /
  `svm.sponsoredDelegateTx`.

### 2. Sign
- **EVM:** `JSON.parse(quote.evm.orderTypedData)` → `signTypedData` → `userSignature`.
  If `evm.approveTx` present, submit it on-chain first. If Permit2, also sign
  `evm.permitTypedData`.
- **Solana:** Ed25519-sign `quote.svm.orderMessage`, base58-encode → `userSignature`.
  Run `ataSetupIxs` → wrap → `delegateIx` on-chain first where present.

### POST /order
Body: same trade fields + `funderAddress`, `quoteId`, `userSignature`.
- **EVM:** also `evmOrderTypedData` (echo of `quote.evm.orderTypedData`); if
  Permit2, `evmPermitTypedData` + `evmPermitSignature`. Optional
  `erc8021AttributionCode` (Base builder attribution).
- **Solana:** also `svmNonce`, `svmDeadline`; if sponsored, `svmSponsoredDelegateTx`.
- **Cross-chain:** also `recipientAddress` + non-null `bridgeQuoteId`.
Returns `{ orderId }`.

### GET /orders · GET /orders/{orderId} · PATCH /orders/{orderId} · POST /orders/{orderId}/cancel
List / fetch / update / cancel. Live updates via the Orders WebSocket.

## Errors
```jsonc
{ "error": { "code": "VALIDATION_ERROR", "message": "Invalid request", "details": {} } }
```
Status: 400, 401 (bad key), 404, 429 (rate limited), 5xx.

Flash is non-custodial: the user's wallet signs; Flash never custodies funds.
