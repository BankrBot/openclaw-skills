# Endpoints

Base URL `https://www.hoodgrow.com`. All GET. Send
`Authorization: Bearer $HOODGROW_API_KEY`.

| Endpoint | Returns | Quota |
| --- | --- | --- |
| `/api/agent/token/{SYMBOL}` | price, adjusted supply, DeFi depth, actions | 1 |
| `/api/agent/tokens` | the full catalog | 10 |
| `/api/corporate-actions?symbol=NVDA` | pending + recent actions; omit `symbol` for all | 1 |
| `/api/agent/slippage/{SYMBOL}?amountUsd=5000&side=buy` | price impact of a trade size | 1 |
| `/api/agent/defi/{SYMBOL}` | Morpho supply APY, Uniswap V3 TVL | 1 |
| `/api/agent/holders/{SYMBOL}` | holder distribution | 1 |
| `/api/agent/ohlc/{SYMBOL}?interval=1d&from=&to=` | candles; interval `1h`, `4h`, `1d` | 1 |
| `/api/agent/markets` | market overview | 1 |
| `/api/agent/trades?symbol=&limit=` | recent trades | 1 |
| `/api/agent/base/tokens` | Base-chain tokens — a different chain | 1 |

Prefer `/api/agent/token/{SYMBOL}` over the catalog for a single symbol: it
costs a tenth as much and returns the same fields for that token. The
catalog weighs 10 because it returns every token, not because it is slow —
reaching for it to read one symbol is the expensive mistake this table
exists to prevent.

`side` is `buy` (spend USDG for the token) or `sell` (the reverse).

## What to tell the user

- Slippage is a per-pool estimate, not an optimal multi-pool route. A
  `likelyCrossesTick` flag means the trade may be large enough that the
  estimate understates real impact — suggest splitting into tranches.
- An unknown symbol fails rather than returning empty. An empty result is
  a real answer, not a lookup that quietly missed.
- Prices come from on-chain Chainlink feeds, not from Robinhood's app, so
  they can differ from what the Robinhood UI shows.
- Price and slippage read from snapshots refreshed every 15 minutes, not
  from live pool state at call time. Each response carries `observedAt` —
  quote the age rather than implying the number is live.

## If an MCP server is connected

Optional, and separate from this skill. If
`https://www.hoodgrow.com/api/mcp` is added as an MCP server, the same data
is available as ten tools (`get_token`, `get_corporate_actions`, ...) with
no URL building. Same data, same prices, and the same x402 fallback when a
budget runs out. Use it when it is present; this skill does not need it.