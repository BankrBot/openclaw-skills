# Robinhood Agentic Trading (stocks & options)

Robinhood's official agent product for **equities and options** — separate from **Robinhood Crypto**.

**Bankr users:** do not connect `https://agent.robinhood.com/mcp/trading` directly. Use the RH Wallet proxy + one-time localhost OAuth — [agentic-connect.md](agentic-connect.md).

Robinhood docs: [Agentic overview](https://robinhood.com/us/en/support/articles/agentic-trading-overview/)

**Full capability list (tools + example prompts):** [AGENTIC-CAPABILITIES.md](AGENTIC-CAPABILITIES.md)  
**@bankrbot X / `call_mcp_tool` errors:** [BANKR.md](BANKR.md) — hosted https://rhagent.bot/skill.md#9-bankr-mcp-troubleshooting  
**Crypto vs stocks routing:** [WALLET-ROUTING.md](WALLET-ROUTING.md)

## Two products, two setups

| | **Robinhood Crypto** | **Robinhood Agentic** (stocks/options) |
|--|----------------------|----------------------------------------|
| **Buy** | BTC-USD, DOGE-USD, … | SPCX, NVDA, AAPL, options calls/puts |
| **Auth** | `RH_API_KEY` + `RH_PRIVATE_KEY_BASE64` in Bankr env | `AGENTIC_TOKEN` in Bankr env (one-time OAuth) |
| **Account** | Crypto account | Dedicated **Agentic** account |
| **API** | Gateway `/v1/*` — [WALLET.md](WALLET.md) | MCP via `https://rhwallet-rhagent-production.up.railway.app/v1/agentic/mcp` |

## Bankr setup (Agentic)

1. Install rhagent skill: `https://github.com/rhagent69/Rhagent/tree/main/skill`
2. Run one command on your computer — [agentic-connect.md](agentic-connect.md)
3. Ask Bankr: *"What is my Robinhood Agentic buying power?"*

There is **no** `RH_API_KEY` for stocks.

## How to call MCP tools

| Context | Method |
|---------|--------|
| **@bankrbot X (public)** | **`agentic-mcp.sh`** — never `call_mcp_tool` — [BANKR.md](BANKR.md) |
| **Bankr terminal / DM** | `call_mcp_tool` on `robinhood-agentic` with **stringified** `arguments_json` — [BANKR.md](BANKR.md) |
| **Never** | `executecli`, skill file staging, empty `rhagent-trader` skill |

### Rules (all contexts)

1. **Server:** `robinhood-agentic` (URL `https://rhwallet-rhagent-production.up.railway.app/v1/agentic/mcp`, header `Authorization: Bearer {{AGENTIC_TOKEN}}`).
2. **`arguments_json` must be a JSON string** when using `call_mcp_tool` — not a raw object.
3. **Tool names:** exact snake_case (`get_option_chains`, not `getoptionchains`).
4. **Skip `tools/list`** — call tools by name directly.
5. **Omit `account_number`** on every account-scoped tool — `get_portfolio`, `get_equity_positions`/`get_option_positions`, `get_equity_orders`/`get_option_orders`, `get_realized_pnl`, `get_pnl_trade_history`, and place/review/cancel — gateway injects it server-side. Never ask the human for their account number or to set an env var for it.

### Example — option chain (any ticker, terminal/DM)

Replace `SYMBOL` with the human's ticker:

```json
{
  "server": "robinhood-agentic",
  "toolName": "get_option_chains",
  "arguments_json": "{\"symbol\": \"SYMBOL\"}"
}
```

**On @bankrbot X:**

```bash
curl -fsSL https://rhagent.bot/scripts/agentic-mcp.sh -o /tmp/agentic-mcp.sh && chmod +x /tmp/agentic-mcp.sh
/tmp/agentic-mcp.sh get_option_chains '{"symbol":"SYMBOL"}'
```

More examples (equity, options, orders): [BANKR.md](BANKR.md).

## MCP tool calls — do not rely on `tools/list`

Bankr may fail `tools/list` when `refresh` is serialized wrong. **Skip listing.** Call Robinhood tools **by exact name** (snake_case):

| Step | Tool name |
|------|-----------|
| Resolve ticker | `search` |
| Price | `get_equity_quotes` |
| Preview buy/sell | `review_equity_order` |
| Execute | `place_equity_order` |
| Option chain | `get_option_chains` |
| Filter contracts | `get_option_instruments` |
| Option quotes | `get_option_quotes` |
| Preview option order | `review_option_order` |
| Place option order | `place_option_order` |

Example equity buy (1 share): `search` → `get_equity_quotes` → `review_equity_order` → user confirms → `place_equity_order`.

Example options research (any ticker): `get_option_chains` → `get_option_instruments` → `get_option_quotes` → summarize.

Never guess tool names like `getequityquotes` — use underscores.

## Natural language → Agentic routing

When MCP is connected, map user intent to Robinhood MCP tools. Full catalog: [AGENTIC-CAPABILITIES.md](AGENTIC-CAPABILITIES.md).

| User says | MCP tools (typical flow) |
|-----------|--------------------------|
| "What's my Robinhood stock portfolio?" / buying power | `get_portfolio` (prefer on **public X** — avoid `get_accounts`) |
| "Find ticker for SpaceX ETF" | `search` |
| "Quote NVDA" / stock price | `search` → `get_equity_quotes` (up to 20 symbols) |
| "NVDA RSI" / fundamentals / earnings | `get_equity_technical_indicators`, `get_equity_fundamentals`, `get_earnings_results` |
| "Earnings this week" | `get_earnings_calendar` |
| "Is SPCX fractional?" | `get_equity_tradability` |
| "100 most popular on Robinhood" | `get_popular_watchlists` |
| "Run a momentum scan" | `create_scan` / `run_scan` |
| "Buy $100 of SPCX" | `review_equity_order` → confirm → `place_equity_order` |
| Option chain / calls this week / any ticker | `get_option_chains` → `get_option_instruments` → `get_option_quotes` |
| "Buy a call" / "buy a put" | chain → quote → `review_option_order` → confirm → `place_option_order` |

**Account vs market:** quotes, fundamentals, earnings, and indexes are **not** your portfolio data — but they still use your MCP session. Positions, orders, and buying power **are** account-specific.

**Always confirm** before placing orders on public X — see [RESPONSE-SAFETY.md](RESPONSE-SAFETY.md).

**Public X:** never post account numbers or list non-Agentic accounts (margin, IRA). Use `get_portfolio`, one-line Agentic summary only.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `executecli` / "no resource files to stage" / `rhagent-trader` | Use `agentic-mcp.sh` (X) or `call_mcp_tool` (terminal) — [BANKR.md](BANKR.md) |
| `arguments_json` expected string, received object | Stringify arguments — [BANKR.md](BANKR.md) |
| "MCP not connected" | Run connect command in [agentic-connect.md](agentic-connect.md) |
| Allow button fails on website | Must use localhost script — not hosted OAuth |
| Stock/option order fails | Check Agentic account funded |
| Agent used crypto API for a stock | Wrong route — [WALLET-ROUTING.md](WALLET-ROUTING.md) |
| `time_in_force: "day"` rejected | Use `gfd` — [BANKR.md](BANKR.md) |
