# Robinhood Agentic Trading (stocks & options)

Robinhood’s official agent product for **equities and options** — separate from **Robinhood Crypto** (rh-wallet).

Robinhood’s docs describe generic MCP setup (Claude, Cursor, ChatGPT, etc.). They do **not** mention Bankr or third-party skills. **This skill** tells your Bankr agent when and how to use Agentic vs Crypto.

Docs:
- [Agentic Trading overview](https://robinhood.com/us/en/support/articles/agentic-trading-overview/)
- [Trading with your agent](https://robinhood.com/us/en/support/articles/trading-with-your-agent/)

## Two products, two setups

| | **Robinhood Crypto** (rh-wallet) | **Robinhood Agentic** (stocks/options) |
|--|-----------------------------------|----------------------------------------|
| **Buy** | BTC-USD, DOGE-USD, … | SPCX, GME, AAPL, options calls/puts |
| **Auth** | `RH_API_KEY` + `RH_PRIVATE_KEY_BASE64` in Bankr env | **OAuth** via MCP (browser login) |
| **Account** | Crypto account | Dedicated **Agentic** account |
| **API** | RH Wallet gateway / x402 | MCP tools at `https://agent.robinhood.com/mcp/trading` |
| **Env vars** | Yes — see [setup.md](setup.md) | **No API keys** — MCP connection only |

You can use **both**: Crypto keys in env **and** Agentic MCP connected.

## User setup (Agentic)

1. **Primary Robinhood account** in good standing (Robinhood requirement).
2. **Connect MCP** in Bankr (or your agent platform):
   ```
   https://agent.robinhood.com/mcp/trading
   ```
3. **Complete OAuth in a desktop browser** when prompted (Robinhood requirement).
4. **Open an Agentic account** during onboarding if Robinhood prompts you.
5. **Options:** Apply for options trading on the Agentic account if user wants calls/puts (`get_option_level_upgrade_info`).

There is **no** `RH_API_KEY` for stocks — do not ask users to paste stock “API keys” into env. Crypto keys do **not** work for Agentic.

### Bankr-specific (typical flow)

- Bankr → settings / MCP / tools → add connector with URL above
- Authenticate as **robinhood-trading** (or name shown in UI)
- Verify with a read-only ask: “What is my Agentic portfolio buying power?”

Exact UI labels may change; the MCP URL is stable.

## Natural language → Agentic routing

When MCP is connected, map user intent to Robinhood MCP tools (names from Robinhood docs):

| User says | MCP tools (typical flow) |
|-----------|--------------------------|
| “What's my Robinhood stock portfolio?” | `get_portfolio`, `get_accounts` |
| “Quote on SPCX” / “price of GME” | `search` → `get_equity_quotes` |
| “Can I buy SPCX?” | `get_equity_tradability` |
| “Buy $100 of SPCX” | `review_equity_order` → confirm → `place_equity_order` |
| “Buy a GME call” | `get_option_chains` → `get_option_instruments` → `get_option_quotes` → `review_option_order` → confirm → `place_option_order` |
| “Cancel my SPCX order” | `get_equity_orders` → `cancel_equity_order` |

**Always confirm** symbol, side, size, and (for options) contract details before placing orders — especially on **public X**.

## Public X / @Bankr replies

Follow [RESPONSE-SAFETY.md](RESPONSE-SAFETY.md). **Never tweet:**

- Account numbers (Robinhood MCP can return them — **strip before replying**)
- API keys, OAuth tokens, MCP session details
- Full raw JSON from MCP
- Options orders without user confirmation on size/contract

**Safe public reply example:**

```
Robinhood Agentic: reviewed GME call · $25 strike · exp 2026-08-15 · est. $1.20/contract — confirm to place?
```

After fill:

```
Placed: 1 GME call · filled · Agentic account
```

## Agent rules (Agentic)

1. **Route stocks/options here**, not rh-wallet crypto x402.
2. **MCP not connected?** Tell user to add `https://agent.robinhood.com/mcp/trading` and complete OAuth — do not fall back to crypto API.
3. **Options require approval** — if tools fail, suggest options enrollment via Robinhood.
4. **Trades go to Agentic account only** (Robinhood policy).
5. **User is responsible** for all agent-placed trades (Robinhood disclosure).
6. **Never skip confirmation** on public X for options or size > user’s stated intent.

## Future: Agentic x402 (Phase 4 — not live yet)

Paid wrappers (USDC on Base) may mirror crypto x402:

| Planned endpoint | Price | Purpose |
|------------------|-------|---------|
| `rh-equity-quote` | $0.25 | Quote + tradability |
| `rh-equity-buy` | $0.50 | Review + place stock order |
| `rh-option-chain` | $0.25 | Option chain for symbol |
| `rh-option-buy` | $1.00 | Review + place option order |

These will require **MCP OAuth session** (not `RH_API_KEY`). See [x402-agentic.md](x402-agentic.md) when shipped.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| “MCP not connected” | Add MCP URL, re-auth desktop browser |
| Stock order fails | Check Agentic account funded, symbol tradable |
| Options fail | Options not approved on Agentic account |
| Agent used crypto API for SPCX | Wrong route — see [WALLET-ROUTING.md](WALLET-ROUTING.md) |
