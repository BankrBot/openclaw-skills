# Callput MCP Server Setup Guide

## Overview

This guide connects `callput-lite-agent-mcp` to an MCP-compatible agent runtime. The server supports spread-only Callput trading on Base for crypto and synthetic stock/ETF options.

Supported underlyings:
- Crypto: `BTC`, `ETH`
- Stock/ETF feed symbols: `TSLA`, `QQQ`, `SPY`, `EWY`, `NVDA`, `COIN`, `CRCL`, `SAMSUNG`, `HYNIX`
- Configured option-token contracts: `BTC`, `ETH`, `TSLA`, `QQQ`, `SPY`, `EWY`, `NVDA`, `COIN`

Live tradability is determined by the Callput market feed. If `callput_scan_spreads` returns no candidates, skip that symbol or try another available symbol. Stock options are synthetic on-chain options, not broker-listed options, shares, ETFs, or tokenized stock ownership.

## Execution Model

The MCP server builds unsigned transactions only. It never holds, manages, signs, or broadcasts with private keys. Your agent runtime, Bankr signer, HSM, Ledger, or custom wallet layer signs and broadcasts `unsigned_tx`.

Flow:
1. `callput_scan_spreads` selects ranked candidates.
2. `callput_execute_spread` returns `unsigned_tx` and `usdc_approval`.
3. If approval is insufficient, sign and broadcast `usdc_approval.approve_tx`.
4. Sign and broadcast `unsigned_tx` externally.
5. Call `callput_get_request_key_from_tx(tx_hash)`.
6. Persist `request_key` and poll `callput_check_request_status`.

## Prerequisites

- Node.js 18+
- npm 8+
- Base Mainnet RPC endpoint; default is `https://mainnet.base.org`
- A USDC-funded Base wallet controlled by your external signer/runtime

## Build

```bash
npm install
npm run build
npm run verify
npm run verify:mcp
```

## MCP Config

```json
{
  "mcpServers": {
    "callput_lite": {
      "command": "node",
      "args": ["/absolute/path/to/callput-lite-mcp-skill-standalone/build/index.js"],
      "env": {
        "RPC_URL": "https://mainnet.base.org"
      }
    }
  }
}
```

Use a paid Base RPC in `RPC_URL` for production reliability. Put signer credentials only in the external signer/runtime, not in the MCP server env.

## Verification

After connecting the MCP server, verify read-only tools first:

```
callput_portfolio_summary({ address: "0x...", request_keys: [] })
callput_scan_spreads({ underlying_asset: "ETH", bias: "bullish", max_results: 1 })
callput_scan_spreads({ underlying_asset: "TSLA", bias: "bullish", max_results: 1 })
callput_get_option_chains({ underlying_asset: "NVDA", max_expiries: 1, max_strikes: 5 })
```

If a stock/ETF symbol returns no candidates, the symbol is configured but not currently tradable in the live feed.

## Required Agent State

Persist request keys across the session:

```json
{
  "request_keys": ["0x..."],
  "last_symbols": ["ETH", "TSLA"]
}
```

If request keys are lost, call `callput_list_positions_by_wallet` and pass recovered `open_request_keys` into `callput_portfolio_summary`.
