---
name: rh-wallet
description: >
  Manage Robinhood Crypto (pairs like BTC-USD) via RH Wallet gateway or paid
  x402 API, and route Robinhood stocks/options to Agentic MCP. Use for Robinhood
  crypto prices, balance, buy/sell crypto, OR stocks (SPCX, GME), options
  (calls/puts) when Agentic MCP is connected. Crypto: RH_API_KEY +
  RH_PRIVATE_KEY_BASE64 in Bankr env + optional x402 (USDC on Base). Stocks/options:
  connect https://agent.robinhood.com/mcp/trading via OAuth (no crypto API keys).
  Never post account numbers on X — see references/RESPONSE-SAFETY.md.
tags: [robinhood, crypto, trading, wallet, bankr, usd]
visibility: public
metadata:
  clawdbot:
    emoji: "🟩"
    homepage: "https://github.com/anondevv69/RH-Wallet"
    requires:
      bins: [curl, jq]
      optional_bins: [bankr]
---

# Robinhood Crypto Wallet (via RH Wallet Gateway)

Trade and inspect a **Robinhood Crypto** account through a **stateless RH Wallet Gateway**. Robinhood keys live in **Bankr Agent tool environment** — the gateway signs requests but does **not** store your keys.

> **US only.** Robinhood Crypto Trading API is available to US customers and is subject to the Robinhood Crypto Customer Agreement.

For setup see [references/setup.md](references/setup.md).  
Hosted URL + public gateway secret: [references/hosted-config.md](references/hosted-config.md).  
For safety see [references/trading-safety.md](references/trading-safety.md).  
For endpoints see [references/api-reference.md](references/api-reference.md).  
For paid x402 API + natural-language routing see [references/x402.md](references/x402.md).  
For **stocks & options** (Agentic MCP) see [references/AGENTIC-TRADING.md](references/AGENTIC-TRADING.md).  
For which product to use see [references/WALLET-ROUTING.md](references/WALLET-ROUTING.md).  
For **public X safety** (never tweet account numbers) see [references/RESPONSE-SAFETY.md](references/RESPONSE-SAFETY.md).

## Prerequisites — two setups

### A. Robinhood Crypto (rh-wallet) — env vars

Set in **Bankr → gear → Agent tool environment**:

| Variable | Required? | What |
|----------|-----------|------|
| `RH_API_KEY` | **Yes** | Robinhood API key (`rh-api-...`) from crypto settings |
| `RH_PRIVATE_KEY_BASE64` | **Yes** | Ed25519 private key from `scripts/generate_rh_keypair.py` |
| `RH_GATEWAY_SECRET` | No | Defaults to public value in [hosted-config.md](references/hosted-config.md) |
| `RH_WALLET_API_URL` | No | Defaults to `https://rh-wallet-production.up.railway.app` |
| `RH_MAX_ORDER_USD` | No | Your personal cap (≤ host `MAX_ORDER_USD`) |
| `RH_REQUIRE_CONFIRMATION` | No | `true` to always require confirm |

If `RH_API_KEY` or `RH_PRIVATE_KEY_BASE64` is missing, walk the user through [references/setup.md](references/setup.md). **Never** ask them to paste private keys into chat.

### B. Robinhood Agentic (stocks & options) — MCP OAuth

**No env API keys for stocks.** User connects MCP once:

```
https://agent.robinhood.com/mcp/trading
```

OAuth in desktop browser → open **Agentic account** → optional options approval.

Robinhood’s docs list Claude/Cursor/ChatGPT — **not Bankr by name**. This skill teaches Bankr how to route. Full steps: [references/AGENTIC-TRADING.md](references/AGENTIC-TRADING.md).

## Agent rules

1. **Route first.** Crypto pairs → rh-wallet/x402. Stock tickers / options → Agentic MCP. Table: [references/WALLET-ROUTING.md](references/WALLET-ROUTING.md).
2. **Disambiguate wallets.** Bankr onchain ≠ Robinhood Crypto ≠ Robinhood Agentic.
3. **Estimate before crypto buy.** Call `/v1/estimate` before placing crypto orders.
4. **Confirm size.** Send `"confirm": true` only after the user clearly agrees.
5. **Prefer USD for crypto buys** (`quote_amount`). Prefer `asset_quantity` for sells.
6. **Never echo private credentials.** Do not print `RH_PRIVATE_KEY_BASE64` or `RH_API_KEY`. The hosted gateway secret is public (see hosted-config.md).
7. **Never share account identifiers publicly.** See [references/RESPONSE-SAFETY.md](references/RESPONSE-SAFETY.md). **Especially on X:** no account numbers, no raw JSON, no keys — Crypto or Agentic. MCP `get_accounts` may return account numbers; **strip them** from public replies.
8. **Respect max size.** Gateway rejects orders above `MAX_ORDER_USD` (default $50).
9. **Crypto symbols** are uppercase pairs like `BTC-USD`.
10. **Natural language → crypto x402.** When the user asks for Robinhood **crypto** prices, balance, holdings, buy, or sell, use [references/x402.md](references/x402.md). Prefer **rh-buy** ($0.50). Fall back to free `rh()` if no USDC or user prefers free.
11. **Confirm crypto trades on x402.** For `rh-buy` / `rh-order`, set `"confirm": true` only after the user clearly agrees.
12. **Stocks/options → Agentic MCP.** SPCX, GME, “buy a call”, etc. — not crypto x402. If MCP not connected, give setup URL above. Always confirm before `place_equity_order` / `place_option_order` on public X.

## Natural language routing (full table)

| User says | Route |
|-----------|--------|
| Crypto balance, DOGE, BTC-USD prices/buy | x402 or free gateway — [x402.md](references/x402.md) |
| Stock quote, buy SPCX, sell GME | Agentic MCP — [AGENTIC-TRADING.md](references/AGENTIC-TRADING.md) |
| Buy GME call, option chain | Agentic MCP options tools — confirm contract details |
| Contract address `0x…` | Bankr onchain / hoodmarkets — NOT this skill |

## Natural language examples (crypto x402)

| User says | Do this |
|-----------|---------|
| "What's my Robinhood balance?" | x402 `rh-account` with `view: "account"` |
| "What crypto do I hold on Robinhood?" | x402 `rh-account` with `view: "holdings"` |
| "Get BTC and DOGE prices from Robinhood" | x402 `rh-prices` with `symbol: "BTC-USD,DOGE-USD"` |
| "Buy $1 of DOGE on Robinhood" | x402 `rh-buy` — confirm first, then `confirm: true` |
| "Sell my DOGE on Robinhood" | x402 `rh-buy` with `side: "sell"` — confirm quantity first |

Full command templates: [references/x402.md](references/x402.md).

## Base curl helper (free gateway)

```bash
# Hosted gateway (default) — see references/hosted-config.md
RH_WALLET_API_URL="${RH_WALLET_API_URL:-https://rh-wallet-production.up.railway.app}"
RH_GATEWAY_SECRET="${RH_GATEWAY_SECRET:-uniqueissomethingimtesting}"

rh() {
  local method="$1"; shift
  local path="$1"; shift
  local auth_header=()
  local user_headers=()
  if [ -n "${RH_GATEWAY_SECRET:-}" ]; then
    auth_header=(-H "Authorization: Bearer ${RH_GATEWAY_SECRET}")
  fi
  if [ -n "${RH_MAX_ORDER_USD:-}" ]; then
    user_headers+=(-H "X-Max-Order-USD: ${RH_MAX_ORDER_USD}")
  fi
  if [ -n "${RH_REQUIRE_CONFIRMATION:-}" ]; then
    user_headers+=(-H "X-Require-Confirmation: ${RH_REQUIRE_CONFIRMATION}")
  fi
  curl -sS -X "$method" \
    "${RH_WALLET_API_URL}${path}" \
    "${auth_header[@]}" \
    "${user_headers[@]}" \
    -H "X-RH-API-Key: ${RH_API_KEY}" \
    -H "X-RH-Private-Key-Base64: ${RH_PRIVATE_KEY_BASE64}" \
    -H "Content-Type: application/json" \
    "$@"
}
```

Always pipe JSON through `jq` when available.

## Workflows

### Health / connectivity

```bash
curl -sS "${RH_WALLET_API_URL:-https://rh-wallet-production.up.railway.app}/health" | jq
```

### Account + buying power

```bash
rh GET /v1/account | jq
```

Reply with **status** and **buying_power** only — never `account_number` (gateway strips it; do not recover from `raw`).

### Holdings

```bash
rh GET /v1/holdings | jq
rh GET "/v1/holdings?asset_code=BTC" | jq
```

### Prices

```bash
rh GET "/v1/prices?symbol=BTC-USD" | jq
```

### Estimated price

```bash
rh GET "/v1/estimate?symbol=BTC-USD&side=ask&quantity=0.0001" | jq
```

### Market buy

```bash
rh POST /v1/orders --data '{
  "side": "buy",
  "symbol": "BTC-USD",
  "quote_amount": "10.00",
  "confirm": true
}' | jq
```

### Market sell

```bash
rh POST /v1/orders --data '{
  "side": "sell",
  "symbol": "BTC-USD",
  "asset_quantity": "0.0001",
  "confirm": true
}' | jq
```

### Orders

```bash
rh GET /v1/orders | jq
rh POST /v1/orders/<order-id>/cancel | jq
```

## Errors

- `401` — missing/invalid RH headers or `RH_GATEWAY_SECRET`
- `400` `confirmation_required` — get user confirm, retry with `confirm: true`
- `400` `order_too_large` — over `MAX_ORDER_USD`
- `410` on `/connect` — key storage disabled (expected); use Bankr env instead

Never invent balances or fill prices.
