---
name: bankrbot-mcp
description: Builder-focused MCP server for Bankr. Use when the user wants to use Bankr (prices, swaps, portfolio, NFTs, leverage, market analysis) inside Cursor, Claude Desktop, Claude Code, or other MCP-capable tools. Exposes Bankr Agent API as tools so builders can prototype and ship DeFi features without leaving the editor. Requires BANKR_API_KEY; supports Base, Ethereum, Polygon, Solana, Unichain.
metadata:
  clawdbot:
    emoji: "🛠️"
    homepage: "https://www.npmjs.com/package/bankrbot-mcp"
    requires: { "bins": ["npx"] }
---

# BankrBot MCP

Builder-focused [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server for [Bankr](https://bankr.bot). Use it in **Cursor**, **Claude Desktop**, **Claude Code**, and other MCP clients to get real-time prices, balances, swaps, limit orders, DCA, bridging, NFTs, leveraged trading, and market analysis — without leaving your editor.

## When to use this skill

- The user is building a trading tool, dashboard, or DeFi app and wants Bankr data or actions inside their IDE.
- The user uses Cursor, Claude, or another MCP client and wants to query Bankr (prices, portfolio, execute test swaps, etc.) via the AI assistant.
- The user prefers MCP (stdio) over the Bankr CLI or direct REST API for their workflow.

## Prerequisites

- **Bankr API key** — Get one at [bankr.bot/api](https://bankr.bot/api) with Agent API access (key starts with `bk_`).
- **Node.js** — For `npx`. Optional: set `DEFAULT_WALLET` if the user wants a default wallet for balance/trading tools.

## Install and configure

Install by adding the MCP server to the user's client config. No global install required — `npx` runs the package on demand.

### Cursor

Edit `mcp.json` (Cursor Settings → MCP → Open config, or `~/.cursor/mcp.json`). Add inside `mcpServers`:

```json
"bankrbot": {
  "command": "npx",
  "args": ["-y", "bankrbot-mcp"],
  "env": {
    "BANKR_API_KEY": "bk_your_key_here",
    "DEFAULT_WALLET": "0x_your_trading_wallet"
  }
}
```

Replace `bk_your_key_here` and `0x_your_trading_wallet` with the user's values. If the user sees `spawn npx ENOENT`, use the full path to `npx` as `command` (e.g. `/opt/homebrew/bin/npx` — have them run `which npx` in a terminal).

### Claude Desktop

Add to `claude_desktop_config.json` (e.g. `~/Library/Application Support/Claude/claude_desktop_config.json` on Mac):

```json
"mcpServers": {
  "bankrbot": {
    "command": "npx",
    "args": ["-y", "bankrbot-mcp"],
    "env": {
      "BANKR_API_KEY": "bk_your_key_here",
      "DEFAULT_WALLET": "0x_your_trading_wallet"
    }
  }
}
```

### Claude Code

```bash
claude mcp add bankrbot -- npx -y bankrbot-mcp
```

Ensure `BANKR_API_KEY` (and optionally `DEFAULT_WALLET`) are set in the environment where Claude Code runs.

### Other MCP clients

Use the same command: `npx -y bankrbot-mcp`, with `BANKR_API_KEY` and optionally `DEFAULT_WALLET` in the client’s env config.

## Tools provided

| Tool | Use when |
|------|----------|
| `get_price` | User needs live token price on a chain. |
| `get_trending` | User wants trending tokens or market activity. |
| `get_balance` / `get_portfolio_summary` | User wants wallet balances or portfolio breakdown. |
| `get_transaction_history` | User wants recent trades/transfers. |
| `execute_swap` | User wants to swap tokens (e.g. test a flow). |
| `place_limit_order` / `setup_dca` / `bridge_assets` | User wants limit orders, DCA, or cross-chain bridge. |
| `transfer_token` | User wants to send tokens to an address. |
| `nft_operations` | User wants to buy, list, mint, or transfer NFTs. |
| `leveraged_trade` | User wants leveraged positions via Avantis. |
| `market_analysis` | User wants charts, TA, sentiment for a token. |
| `check_job_status` | User wants to poll a long-running Bankr job. |

Chains supported: Base, Ethereum, Polygon, Solana, Unichain.

## Package and repo

- **npm:** [bankrbot-mcp](https://www.npmjs.com/package/bankrbot-mcp)
- **Source:** See the npm package homepage or repository link on [npm](https://www.npmjs.com/package/bankrbot-mcp).

## Related

- **Bankr CLI / REST** — For terminal or server use without MCP, see the main [bankr](../SKILL.md) skill in this repo (CLI and REST API).
- **Bankr docs:** [docs.bankr.bot](https://docs.bankr.bot)
