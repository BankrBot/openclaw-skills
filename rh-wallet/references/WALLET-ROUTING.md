# Wallet routing — which path for which request

**Mandatory.** Wrong routing causes trades on the wrong product (crypto vs stocks vs onchain).

## Decision table

| User says | Contract `0x…`? | Pair like `BTC-USD`? | Stock/options ticker? | Route |
|-----------|-----------------|----------------------|-------------------------|--------|
| Robinhood Crypto, DOGE, BTC-USD | No | Yes | No | **rh-wallet** (Crypto API / x402) |
| Buy HOODIE, memecoin on chain | **Yes** | No | No | **Bankr onchain** — NOT rh-wallet |
| hood.markets, Robinhood Chain | Often yes | No | No | **hoodmarkets** skill |
| SPCX, GME, AAPL, “buy a call” | No | No | **Yes** | **Robinhood Agentic MCP** — see [AGENTIC-TRADING.md](AGENTIC-TRADING.md) |
| “My Robinhood balance” (ambiguous) | — | — | — | **Ask:** Crypto (USD pairs) vs stocks (Agentic) |

## rh-wallet handles (Robinhood Crypto)

- Pairs: `BTC-USD`, `ETH-USD`, `DOGE-USD`, etc.
- Auth: `RH_API_KEY` + `RH_PRIVATE_KEY_BASE64` in Bankr env
- Free gateway or paid x402 — [x402.md](x402.md)

## rh-wallet does NOT handle

- Token contract addresses → Bankr onchain / hoodmarkets
- Robinhood Chain memecoins → hoodmarkets
- **Stocks, ETFs, options** → Robinhood Agentic MCP (separate OAuth)
- ACH / deposits → Robinhood app only

## If user mentions “Robinhood” but gives a contract address

**Stop.** Reply:

> That token uses a contract address — rh-wallet only trades Robinhood **Crypto pairs** (e.g. ETH-USD). For onchain tokens use Bankr’s onchain wallet or the hoodmarkets skill.

## If user asks for a stock or option on Robinhood

**Do not** use `rh()` or crypto x402. Route to Agentic MCP — [AGENTIC-TRADING.md](AGENTIC-TRADING.md).
