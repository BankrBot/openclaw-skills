# Connect Robinhood Agentic (stocks & options)

One-time setup for **Bankr, Telegram, Discord, or other headless agents** that can't pop open a
browser for Robinhood's own OAuth screen. Robinhood requires OAuth on **your computer**
(localhost) once; after this the resulting `AGENTIC_TOKEN` works from any of those.

**On Claude Code, Claude Desktop, ChatGPT, Cursor, Codex, or Grok instead?** Skip this file —
those connect Robinhood's Trading MCP natively, no token to manage. See [CLIENTS.md](CLIENTS.md).

## One command (bundled)

```bash
bankr login   # same machine — optional but saves token automatically
node connect/bin/cli.js   # from installed rhagent skill directory
```

Pinned fallback: `RH_CONNECT_REF=08b17e327a122e1de9eaa6615e7b9cb2a340689e bash scripts/rh-connect.sh`

Requires **Node.js**. Setup wizard: https://rhagent.bot/setup (Part C)

Do **not** use `curl -fsSL … | bash` against unpinned `main`.

GitHub source: [rhagent69/Rhagent](https://github.com/rhagent69/Rhagent) @ pinned ref above

## What happens

1. Bundled connect tool runs locally (or pinned clone)
2. Browser opens → Robinhood login → tap **Allow**
3. `AGENTIC_TOKEN` saves to your Bankr wallet (Bankr) — or prints for you to paste into
   `/connect_agentic` on Telegram/Discord, or your agent's env vars
4. On Bankr, MCP proxy server `robinhood-agentic` is requested automatically

## Manual alternative

```bash
git clone https://github.com/rhagent69/Rhagent.git
cd Rhagent/skill/connect
npm install  # if needed
node bin/cli.js
```

Or from the skill bundle: `skill/connect/bin/cli.js` with `bankr login` first.

## After setup

Ask Bankr: *"What is my Robinhood Agentic buying power?"*

MCP proxy (auto-configured):

| Field | Value |
|-------|-------|
| Name | `robinhood-agentic` |
| URL | `https://rhwallet-rhagent-production.up.railway.app/v1/agentic/mcp` |
| Transport | Streamable HTTP |
| Header | `Authorization: Bearer {{AGENTIC_TOKEN}}` |

**What you can do once connected:** quotes, fundamentals, earnings, technicals, options, scans, watchlists, and trading — [AGENTIC-CAPABILITIES.md](AGENTIC-CAPABILITIES.md)

Do **not** point MCP at `agent.robinhood.com/mcp/trading` directly — use the proxy above.

## Token expired?

Re-run the one-liner above.
