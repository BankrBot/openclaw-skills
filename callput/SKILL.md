---
name: callput-lite-trader
description: Build and manage risk-defined Callput option spreads on Base through a public MCP. Supports BTC/ETH and synthetic stock/ETF options. Trigger on Callput, on-chain options, crypto option spreads, stock option spreads, or ETF option spreads.
version: 1.2.0
homepage: https://callput.app
license: MIT
visibility: public
tags: [options, crypto, stocks, etf, base, trading]
mcp:
  required:
    - name: callput-lite-agent-mcp
      setup: See references/SETUP.md
---

# Callput Lite Trader

Use Callput to scan, prepare, monitor, close, and settle risk-defined option spreads on Base. The public MCP builds unsigned transactions only. It never receives a private key, signs, or broadcasts. Bankr must show its confirmation UI before every approval or order.

## Products

- Crypto: BTC and ETH.
- Synthetic stock/ETF options: TSLA, QQQ, SPY, EWY, NVDA, COIN, SPCX, MU, and SKHY.
- Availability is live-feed driven. A configured symbol may temporarily have no tradable candidates.
- Stock/ETF products are synthetic on-chain options, not broker-listed contracts, stock ownership, ETFs, or tokenized shares.

## Setup

Connect the public MCP before using this skill:

- URL: `https://mcp.callput.app/api/mcp`
- Transport: HTTP
- Authentication: None
- Chain: Base mainnet (`8453`)

See [references/SETUP.md](references/SETUP.md) for the read-only verification prompt.

## Required flow

1. Read the wallet portfolio and USDC balance.
2. Scan the requested symbol and bias. Never invent a candidate when the scan is empty.
3. Present strategy, asset, expiry, both strikes, size, wallet, Base network, maximum USDC at risk, and native execution fee.
4. Ask the user to confirm before preparing or submitting any approval/order.
5. If USDC approval is required, confirm it separately and wait for confirmation.
6. Confirm the order in Bankr.
7. Reconcile by the actual transaction hash and persist the returned request key.
8. Poll request status until executed or cancelled.

## Bias mapping

| User view | Strategy |
| --- | --- |
| Bullish | BuyCallSpread |
| Bearish | BuyPutSpread |
| Neutral-bearish | SellCallSpread |
| Neutral-bullish | SellPutSpread |

## Hard safety rules

- Spread-only; never construct a single-leg option order.
- Calls: long lower strike, short higher strike. Puts: long higher strike, short lower strike.
- Public preparation enforces a maximum of 100 USDC risk per trade by default. Treat this as a ceiling, not a target.
- Never change the wallet, asset, legs, size, or strategy after review without preparing and reviewing again.
- Never auto-confirm a transaction or ask for a private key.
- Never use an arbitrary latest wallet request for reconciliation. Use the transaction hash returned by the signer.
- Before close or settlement, show expected output and obtain a positive explicit minimum-output floor. Never pass zero or silently substitute `1`.
- Manage positions expiring within 24 hours before opening additional risk.

## Tool routing

| Intent | Tool |
| --- | --- |
| Discover ranked spreads | `callput_scan_spreads` |
| Inspect raw chains/IV | `callput_get_option_chains` |
| Review balance, positions, P&L | `callput_portfolio_summary` |
| Prepare a spread | `callput_execute_spread` |
| Extract request key from receipt | `callput_get_request_key_from_tx` |
| Poll keeper status | `callput_check_request_status` |
| Recover wallet request keys | `callput_list_positions_by_wallet` |
| Prepare pre-expiry close | `callput_close_position` |
| Prepare post-expiry settlement | `callput_settle_position` |
| Read settled payouts | `callput_get_settled_pnl` |

For parameter details and lifecycle constraints, read [references/TOOL_REFERENCE.md](references/TOOL_REFERENCE.md).

## Example prompts

- “Scan bullish TSLA spreads and explain rank 1. Do not prepare a transaction.”
- “Prepare one BTC bullish spread, then show all risk and transaction fields before confirmation.”
- “Review my Callput positions and flag anything expiring within 24 hours.”
- “Prepare a close only after I approve the exact positive minimum USDC output.”
