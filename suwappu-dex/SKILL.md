---
name: suwappu-dex
description: "Cross-chain token swaps, quotes, portfolio and prices across 14 chains via the Suwappu DEX MCP server. Read-only by default; swap execution is opt-in and gated."
homepage: https://suwappu.bot
metadata:
  {
    "openclaw":
      {
        "emoji": "🌸",
        "os": ["darwin", "linux", "win32"],
        "requires": { "env": ["SUWAPPU_API_KEY"] },
        "tags": ["dex", "defi", "swap", "cross-chain", "trading", "finance"],
      },
  }
---

# Suwappu — Cross-chain DEX 🌸

Swap, quote, and track tokens across **14 chains** (12 EVM + Solana + TRON) through Suwappu's
hosted **MCP server**. Routing is automatic across 10+ providers (Li.Fi, CoW Protocol, Jupiter,
Wormhole, Across, CCTP, …). This skill wraps the live server — no SDK or wrapper code required.

## Setup (one command)

1. Get a free API key:
   ```bash
   curl -X POST https://api.suwappu.bot/v1/agent/register \
     -H "Content-Type: application/json" -d '{"name":"my-openclaw"}'
   # -> save the suwappu_sk_... value
   export SUWAPPU_API_KEY=suwappu_sk_...
   ```
2. Register the MCP server with OpenClaw. **Read-only by default** (swap execution excluded):
   ```bash
   openclaw mcp add suwappu \
     --url https://api.suwappu.bot/mcp \
     --transport streamable-http \
     --header "Authorization=Bearer $SUWAPPU_API_KEY" \
     --exclude execute_swap
   openclaw mcp probe suwappu      # should list the tools
   ```
3. To **enable swap execution**, re-add without `--exclude execute_swap` on a dedicated trading
   agent only (see Safety). Verify with `openclaw mcp doctor`.

## Tools (live)

Read-only (safe, no funds move):
- `get_quote <from> <to> <amount> <chain>` — best route, price impact, gas, fees, expiry
- `get_prices <token> [chain]` — USD price + 24h change
- `get_portfolio [chain]` — balances + USD values across chains
- `list_chains` / `list_tokens <chain>` — supported chains / popular tokens
- `get_tempo_tokens` — trending tokens
- `browse_mpp_directory` — market/provider directory
- `predict_markets` / `predict_market_detail` — Polymarket-style prediction markets

State-changing (gated, opt-in):
- `execute_swap <quote_id>` — execute a previously returned quote. **Excluded unless explicitly enabled.**

## Typical flow

1. `list_chains` → see what's available
2. `get_quote ETH USDC 0.1 base` → best route (returns a `quote_id`)
3. (trading agent only) confirm with the user → `execute_swap <quote_id>`
4. `get_portfolio` → verify it landed

## Examples

- "Quote 0.5 ETH to USDC on Base" → `get_quote`
- "What's my portfolio worth across chains?" → `get_portfolio`
- "Best price to bridge 500 USDC to Arbitrum" → `get_quote`

## Safety

- **Read-only by default.** `execute_swap` is excluded via `--exclude` and should only be enabled
  on an isolated trading agent with explicit tool-allowlisting (`agents.json`).
- **Agent proposes, user approves.** Always `get_quote` first, show the route/price impact, and
  require user confirmation before any `execute_swap`. Preserve the `quote_id` end to end for audit.
- **Non-custodial.** Keys live in Turnkey TEE enclaves; Suwappu enforces 2FA + per-swap/hourly/daily
  spending limits + tx simulation server-side — these guardrails hold even if the agent errs.
- **Never** put `SUWAPPU_API_KEY` in committed files — pass it as an env var / SecretRef.

## Fees & docs

0.3% per swap, gas from wallet balance, no subscription. Full API: https://api.suwappu.bot/docs
