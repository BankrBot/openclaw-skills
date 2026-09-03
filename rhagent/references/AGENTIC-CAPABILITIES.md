# Robinhood Agentic — what you can do

Once `AGENTIC_TOKEN` is set and the `robinhood-agentic` MCP is connected, Bankr can use **Robinhood's official Trading MCP** through the RH Wallet proxy. Setup: [agentic-connect.md](agentic-connect.md).

Robinhood source: [Trading with your agent](https://robinhood.com/us/en/support/articles/trading-with-your-agent/)

**Trading flows & routing:** [AGENTIC-TRADING.md](AGENTIC-TRADING.md)  
**@bankrbot MCP format:** [BANKR.md](BANKR.md)

## Two kinds of data

| Kind | Returns info about **you** | Returns **market** info |
|------|---------------------------|-------------------------|
| **Account tools** | Yes — portfolio, positions, orders, P&amp;L, watchlists | No |
| **Market / research tools** | No — same data for any logged-in user | Yes — quotes, fundamentals, earnings, indexes, scans |

**Important:** Market and research tools still require **your** `AGENTIC_TOKEN` to call the API — but they do **not** read your holdings or order history. Account tools do.

**Bankr safety:** Never show account numbers (full, masked, or last-4) in any reply — [RESPONSE-SAFETY.md](RESPONSE-SAFETY.md). Redact before responding even when MCP returns them.

---

## Account & portfolio

| Tool | What it does |
|------|--------------|
| `get_accounts` | All Robinhood accounts — **avoid on public X**; redact all account numbers in every reply |
| `get_portfolio` | Total value, asset-class breakdown, **buying power** |
| `get_realized_pnl` | Realized P&amp;L over a custom window, by asset class |
| `get_pnl_trade_history` | Trade-by-trade realized P&amp;L history |
| `search` | Company name or partial name → ticker symbol |

**Try asking Bankr:**

- *"What is my Robinhood Agentic buying power?"*
- *"Show my Robinhood stock portfolio"*
- *"What's my realized P&amp;L this month on Agentic?"*
- *"Find the ticker for SpaceX ETF"* → `search`

---

## Watchlists

| Tool | What it does |
|------|--------------|
| `get_watchlists` | List your watchlists |
| `get_watchlist_items` | Symbols in a specific watchlist |
| `get_option_watchlist` | Load an options watchlist |
| `get_popular_watchlists` | Robinhood lists (e.g. "100 most popular") |
| `create_watchlist` | Create a custom watchlist |
| `update_watchlist` | Rename or update description |
| `follow_watchlist` / `unfollow_watchlist` | Follow or unfollow a Robinhood list |
| `add_to_watchlist` / `remove_from_watchlist` | Add/remove stocks, crypto, or indexes |
| `add_option_to_watchlist` / `remove_option_from_watchlist` | Add/remove option contracts |

**Try asking Bankr:**

- *"Show my Robinhood watchlists"*
- *"What's on Robinhood's 100 most popular list?"*
- *"Add NVDA to my Agentic watchlist"*

---

## Market data & research (not your account)

| Tool | What it does | Limits |
|------|--------------|--------|
| `get_equity_quotes` | Real-time quotes + prior close | Up to **20 symbols** per call |
| `get_equity_historicals` | OHLCV price bars over a time range | — |
| `get_equity_fundamentals` | P/E, market cap, 52-week range, dividends, today's OHLCV | — |
| `get_equity_technical_indicators` | RSI, MACD, Bollinger Bands, moving averages, etc. | — |
| `get_earnings_results` | EPS history, estimates vs actual, next report date | Per symbol |
| `get_earnings_calendar` | Market-wide earnings schedule | Up to **31 days**; optional large-cap filter |
| `get_indexes` | Look up indexes by symbol | — |
| `get_index_quotes` | Real-time index values | — |
| `get_equity_tradability` | Can trade? Fractional? | Robinhood-specific |

**Try asking Bankr:**

- *"Quote SPCX, NVDA, and AAPL on Robinhood Agentic"*
- *"What's NVDA's RSI over the last 3 months?"*
- *"Show AAPL fundamentals — market cap and P/E"*
- *"When does TSLA report earnings next?"*
- *"What earnings are coming up this week?"*
- *"Is SPCX tradable and fractional on Robinhood?"*
- *"What's the S&amp;P 500 at right now?"*

---

## Equities — positions, orders & trading

| Tool | What it does |
|------|--------------|
| `get_equity_positions` | Open positions with quantity and cost basis |
| `get_equity_orders` | Equity order status history |
| `get_equity_tradability` | Tradability + fractional flags |
| `review_equity_order` | Simulate order + pre-trade warnings |
| `place_equity_order` | Place an equity order |
| `cancel_equity_order` | Cancel an open equity order |

**Typical flow:** `search` → `get_equity_quotes` → `review_equity_order` → user confirms → `place_equity_order`

**Try asking Bankr:**

- *"What stocks do I hold on Agentic?"*
- *"Buy $25 of SPCX on my Agentic account"* — confirm before placing
- *"Cancel my open SPCX order on Robinhood Agentic"*

**Always confirm** before placing orders on public X — [RESPONSE-SAFETY.md](RESPONSE-SAFETY.md).

---

## Options

| Tool | What it does |
|------|--------------|
| `get_option_level_upgrade_info` | Link to apply for options access |
| `get_option_chains` | Load option chains for a symbol |
| `get_option_instruments` | Filter contracts by expiry, strike, type |
| `get_option_quotes` | Real-time option contract quotes |
| `get_option_positions` | Open or closed options positions |
| `get_option_orders` | Options order history |
| `review_option_order` | Simulate options order + alerts |
| `place_option_order` | Place a real options order |
| `cancel_option_order` | Cancel an open options order |

**Typical flow:** `get_option_chains` → `get_option_instruments` → `get_option_quotes` → `review_option_order` → confirm → `place_option_order`

**Try asking Bankr (any ticker):**

- *"Show the NVDA option chain for next month"*
- *"Quote the AAPL $200 call expiring next Friday"*
- *"What are cheap calls on TSLA this week?"*
- *"Buy one call on SYMBOL"* — confirm contract details first

**On @bankrbot X:** use `agentic-mcp.sh` — [BANKR.md](BANKR.md#options--any-ticker-research--trades).

---

## Scanners

| Tool | What it does |
|------|--------------|
| `get_scans` | List your saved scans |
| `create_scan` | New scan from preset or custom filters |
| `run_scan` | Run a saved scan → live results |
| `update_scan_filters` | Change filters on a saved scan |
| `update_scan_config` | Change sort order of results |

**Try asking Bankr:**

- *"Run my top-gainers scan on Robinhood"*
- *"Create a scan for large-cap tech stocks up more than 5% today"*

---

## What Agentic does NOT do (use other paths)

| Request | Route instead |
|---------|---------------|
| BTC-USD, DOGE-USD, crypto pairs | Robinhood **Crypto** — [WALLET.md](WALLET.md) |
| Onchain tokens / contract `0x…` | Bankr onchain / hoodmarkets — [WALLET-ROUTING.md](WALLET-ROUTING.md) |
| Deposits, ACH, bank transfers | Robinhood app only |
| Direct MCP URL | Use RH Wallet proxy — [agentic-connect.md](agentic-connect.md) |
| rhagents feed posts | **curl** rhagents API — [POST.md](POST.md) — never MCP |

---

## How Bankr reaches these tools

```
Bankr agentic-mcp.sh (X) or call_mcp_tool (terminal, arguments_json as string)
  → https://rhwallet-rhagent-production.up.railway.app/v1/agentic/mcp
  → Robinhood agent.robinhood.com/mcp/trading
```

**Call format:** [AGENTIC-TRADING.md](AGENTIC-TRADING.md) · [BANKR.md](BANKR.md)

RH Wallet gateway is a **stateless pass-through**. We do not store your token or account data on Railway.

---

## Quick capability map

| You want | Category | Example prompt |
|----------|----------|----------------|
| Buying power / portfolio value | Account | *"Agentic buying power?"* |
| Live stock price | Market | *"Quote NVDA on Agentic"* |
| Fundamentals / technicals | Research | *"NVDA RSI and P/E"* |
| Earnings | Research | *"When does AAPL report?"* |
| Fractional / tradable? | Market (RH-specific) | *"Is SPCX fractional?"* |
| Buy / sell stock | Trading | *"Buy $10 of SPCX"* |
| Options chain / buy call | Options | *"NVDA call chain"* |
| Custom screeners | Scanner | *"Run my momentum scan"* |
| Popular lists | Watchlists | *"Robinhood 100 most popular"* |

For routing rules see [AGENTIC-TRADING.md](AGENTIC-TRADING.md) and [WALLET-ROUTING.md](WALLET-ROUTING.md).
