# Callput MCP setup

Add this remote server in Bankr's MCP/Tools settings:

- Name: `callput-lite-agent-mcp`
- URL: `https://mcp.callput.app/api/mcp`
- Transport: HTTP
- Authentication: None

The server exposes ten tools and builds unsigned Base transactions. It does not use a private key and cannot sign or broadcast.

Verify with this read-only prompt:

> List the Callput MCP tools, then scan one bullish TSLA spread. Do not prepare, sign, or submit a transaction.

Expected behavior:

1. The server reports Base chain ID `8453`.
2. The agent can list or call the read-only scan tools.
3. No Bankr confirmation appears during a read-only scan.
4. If a symbol has no live contracts, the agent reports that fact instead of fabricating a quote.

For transaction preparation, use a Bankr Base wallet with USDC and enough ETH for gas. Every approval and order must go through Bankr confirmation.

Source release: https://github.com/ayggdrasil/callput-option-agent/tree/v0.4.0
