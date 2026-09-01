---
name: flash
description: Non-custodial on-chain trade execution for agents via Definitive Flash. Use when the user wants to buy or sell a token, place a market, limit, TWAP, stop, stop-loss, take-profit, or bracket order, get a swap quote, or manage open orders across 12 EVM chains and Solana. Flow is quote → sign → submit; the user's wallet signs every order and Flash never holds funds. Ships an official MCP server (@definitive-fi/flash-mcp).
---

# Definitive Flash

Flash is Definitive's execution API for apps and agents. It turns a plain-English
trade intent into a properly routed, best-execution on-chain order — with advanced
order types most swap tools don't have — while staying fully non-custodial: the
end user's wallet signs every order and Flash never takes custody.

## Fastest path: the Flash MCP server

Flash ships an official open-source MCP server that implements the whole
quote → sign → submit flow (wrapping, approvals, signing, fill polling) across EVM
and Solana. If your agent speaks MCP, add it and you're done:

```bash
claude mcp add definitive-flash -- npx -y @definitive-fi/flash-mcp
```

Tools: `flash_setup`, `flash_status`, `flash_quote`, `flash_balances`,
`flash_submit_order`, `flash_get_order`, `flash_list_orders`, `flash_cancel_order`.
npm: `@definitive-fi/flash-mcp` · source: `github.com/DefinitiveCo/flash-mcp`

Prefer raw REST? See "REST flow" below.

## Capabilities

- **Order types:** `market`, `limit`, `twap`, and trigger orders (`stop`,
  `stop-loss`, `take-profit`, `bracket`).
- **Smart execution & routing** across DEX liquidity, with live quotes and fee
  estimates before signing.
- **TWAP** scheduled execution over a duration (`durationSeconds`, min 300s).
- **12 chains:** arbitrum, avalanche, base, bsc, ethereum, optimism, polygon,
  solana, hyperevm, plasma, monad, robinhood. Cross-chain `market` orders
  supported (requires `recipientAddress`).
- **Order lifecycle:** quote, submit, list, fetch, update, cancel; plus a live
  Orders WebSocket.
- **Non-custodial:** `/quote` returns an EIP-712 payload (EVM) or a UTF-8 message
  (Solana) that the user signs; `/order` submits it. Flash cannot spend user funds.

## Usage Examples

"buy $500 of WETH on Base at market"
"limit buy 2 ETH at 3,200 USDC"
"TWAP sell 1,000,000 BONK on Solana over the next 2 hours"
"set a stop-loss on my WETH if it drops below 2,900"
"take-profit: sell my SOL if it hits 240"
"show my open Flash orders"
"cancel order <orderId>"

## REST flow (quote → sign → submit)

Base URL: `https://flash.definitive.fi/v1`

1. **Find the asset:** `GET /search?query=weth&chain=base` → returns the address.
2. **Quote:** `POST /quote` with `side`, `orderType`, `targetAsset`/`targetChain`,
   `contraAsset`/`contraChain`, `qty` (decimal **string**, in the spent asset's
   units), and `funderAddress` (the wallet that signs & funds). Response includes
   `quoteId` and `evm.orderTypedData` (EVM) or `svm.orderMessage` (Solana).
3. **Sign:** the user's wallet signs the returned payload → `userSignature`.
4. **Submit:** `POST /order` with the same trade fields plus `funderAddress`,
   `quoteId`, `userSignature`, and (EVM) `evmOrderTypedData` echoed back. Returns
   an `orderId`.
5. **Track / manage:** `GET /orders`, `GET /orders/{orderId}`,
   `PATCH /orders/{orderId}`, `POST /orders/{orderId}/cancel`, or the Orders WS.

| Method | Path | Purpose |
|---|---|---|
| GET | `/search` | Resolve tokens by symbol / address |
| POST | `/quote` | Price an intent; returns `quoteId` + payload to sign |
| POST | `/order` | Submit a signed order |
| GET | `/orders` | List orders |
| GET | `/orders/{orderId}` | Get one order |
| PATCH | `/orders/{orderId}` | Update an open order |
| POST | `/orders/{orderId}/cancel` | Cancel an order |

See `references/flash-api.md` for the full field-by-field request/response schema.

## Requirements

- A **Flash API key**, passed as the `x-definitive-api-key` header on every
  request. No request signing — the key alone authenticates. Get a key:
  https://www.definitive.fi/flash-api#contact (a shared integrator key is shown in
  the docs for testing).
- A user wallet (EVM and/or Solana) able to sign the returned order payload. Flash
  is non-custodial and never holds funds.

## Notes & limits

- Amounts (`qty`) are decimal **strings**, in the spent asset's units (contra on a
  buy, target on a sell).
- Cross-chain is `market`-only and needs `recipientAddress`.
- TWAP uses `durationSeconds` (≥ 300).
- Optional `flashIntegratorFeeBps` charges an integrator fee (same value on quote
  and order); on Base, `erc8021AttributionCode` attributes the settlement tx.
- Full agent docs: https://flash.definitive.fi/docs/for-agents
