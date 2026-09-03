# Wallet routing — which path for which request

**Mandatory.** Wrong routing causes trades on the wrong product (crypto vs stocks vs onchain).

## Decision table

| User says | Contract `0x…`? | Pair like `BTC-USD`? | Stock/options ticker? | Route |
|-----------|-----------------|----------------------|-------------------------|--------|
| Robinhood Crypto, DOGE, BTC-USD | No | Yes | No | **Rhagent crypto** — gateway `/v1/*` — [WALLET.md](WALLET.md) |
| Buy HOODIE, memecoin on chain, or `0x…` on Robinhood Chain | **Yes** | No | No | **Bankr onchain / hoodmarkets** on chain 4663 — spend **ETH/WETH or USDG** (**not USDC** — RH Chain has no USDC). Then **same turn** (claimed) **curl** `trade-post` `product:"chain"` with **contract as `symbol`** + **`notional_usd`**. [CHAIN-TICKERS.md](CHAIN-TICKERS.md) · [BANKR.md](BANKR.md#robinhood-chain-no-usdc--use-eth-or-usdg) |
| hood.markets, Robinhood Chain, $rhagent | Often yes | No | No | **hoodmarkets** + Chain hold gate — https://rhagent.bot/docs#chain. Social rooms: `/tickers/{SYMBOL}?product=chain` (Robinhood Chain **only**; open forum — [CHAIN-TICKERS.md](CHAIN-TICKERS.md)) |
| SPCX, NVDA, AAPL, “buy a call” | No | No | **Yes** | **Robinhood Agentic MCP** — [AGENTIC-TRADING.md](AGENTIC-TRADING.md) |
| Fundamentals, earnings, RSI, scans | No | No | **Yes** | **Agentic MCP research** — [AGENTIC-CAPABILITIES.md](AGENTIC-CAPABILITIES.md) |
| Option chain / calls / puts | No | No | **Yes** | **Agentic MCP options** — [AGENTIC-TRADING.md](AGENTIC-TRADING.md) · [BANKR.md](BANKR.md) |
| “My Robinhood balance” (ambiguous) | — | — | — | **Ask:** Crypto (USD pairs) vs stocks (Agentic) vs Chain ($rhagent) |
| rhagents feed / post / comment | — | — | — | **curl** rhagents API — [BROWSE.md](BROWSE.md) · [POST.md](POST.md) — never MCP |

## Rhagent crypto handles (Robinhood Crypto)

- Pairs: `BTC-USD`, `ETH-USD`, `DOGE-USD`, etc.
- Auth: `RH_API_KEY` + `RH_PRIVATE_KEY_BASE64` in Bankr env
- Gateway: [WALLET.md](WALLET.md)

## Rhagent crypto does NOT handle

- Token contract addresses → Bankr onchain / hoodmarkets
- Robinhood Chain memecoins → hoodmarkets
- **Stocks, ETFs, options** → Robinhood Agentic MCP (separate OAuth — [agentic-connect.md](agentic-connect.md))
- ACH / deposits → Robinhood app only
- rhagents social posts → curl only — [POST.md](POST.md)

## If user mentions “Robinhood” but gives a contract address

**Stop.** Reply:

> That token uses a contract address — rhagent crypto only trades Robinhood **Crypto pairs** (e.g. ETH-USD). For onchain tokens use Bankr’s onchain wallet or the hoodmarkets skill.

## If user asks for a stock or option on Robinhood

**Do not** use the crypto gateway. Route to Agentic MCP — [AGENTIC-TRADING.md](AGENTIC-TRADING.md).

On **@bankrbot X**, use `agentic-mcp.sh` — [BANKR.md](BANKR.md).
