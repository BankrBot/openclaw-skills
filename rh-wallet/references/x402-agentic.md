# x402 Agentic (stocks & options) — planned

**Status: not deployed.** Crypto x402 is live; Agentic x402 is a future layer.

## Why separate from crypto x402

| | Crypto x402 (live) | Agentic x402 (planned) |
|--|-------------------|------------------------|
| Auth | `RH_API_KEY` in request body | User MCP OAuth session |
| Products | BTC-USD, DOGE-USD, … | SPCX, GME, options |
| Backend | RH Wallet Railway gateway | Robinhood MCP proxy |

Robinhood Agentic uses [MCP + OAuth](https://robinhood.com/us/en/support/articles/agentic-trading-overview/), not Ed25519 API keys.

## Planned endpoints (publisher: `0x374d91a5674fa7cf86e725093b5848b97e1e13b4`)

| Service | Price | Flow |
|---------|-------|------|
| `rh-equity-quote` | $0.25 | `get_equity_quotes` + tradability |
| `rh-equity-buy` | $0.50 | quote + portfolio check + `place_equity_order` |
| `rh-option-chain` | $0.25 | `get_option_chains` for symbol |
| `rh-option-buy` | $1.00 | chain + quote + review + `place_option_order` |

## Until live

Use Robinhood Agentic MCP directly — [AGENTIC-TRADING.md](AGENTIC-TRADING.md).

Crypto continues to use live x402 — [x402.md](x402.md).
