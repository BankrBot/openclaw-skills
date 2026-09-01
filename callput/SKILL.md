---
name: callput-lite-trader
description: Spread-only on-chain options trading skill for Base. Supports BTC/ETH plus synthetic stock/ETF options. MCP builds unsigned transactions; agent signs via Bankr /agent/sign and broadcasts via /agent/submit.
version: 1.0.0
homepage: https://callput.app
license: MIT
mcp:
  required:
    - name: callput-lite-agent-mcp
      setup: See references/SETUP.md
---

# Callput Lite Trader

Trade Callput crypto and synthetic stock/ETF spreads on Base. MCP builds unsigned_tx; Bankr signs and broadcasts.

## Supported Underlyings

Crypto: `BTC`, `ETH`. Stock/ETF feed symbols: `TSLA`, `QQQ`, `SPY`, `EWY`, `NVDA`, `COIN`, `CRCL`, `SAMSUNG`, `HYNIX`. Configured option-token contracts cover `BTC`, `ETH`, `TSLA`, `QQQ`, `SPY`, `EWY`, `NVDA`, `COIN`; live tradability is feed-driven. Stock options are synthetic on-chain options, not broker-listed options or tokenized shares.

## Integration Pattern (Bankr)

1. callput_execute_spread -> unsigned_tx + usdc_approval
2. If usdc_approval.sufficient == false -> sign + broadcast approve_tx first
3. POST /agent/sign(unsigned_tx) -> signed_tx
4. POST /agent/submit(signed_tx) -> tx_hash
5. callput_get_request_key_from_tx(tx_hash) -> request_key
6. Persist request_key -> poll callput_check_request_status

## Hard Rules

1. Spread-only. No single-leg execution.
2. Always callput_portfolio_summary before new position.
3. MCP never holds private keys.
4. Save every request_key from get_request_key_from_tx.
5. High IV favors sell spreads; use ETH/BTC thresholds only for ETH/BTC and evaluate stock IV by symbol regime.

## Tool Reference

| Tool | Purpose |
|---|---|
| callput_scan_spreads | Crypto/stock market scan — ranked candidates + ATM IV |
| callput_execute_spread | Build unsigned open tx + USDC check |
| callput_get_request_key_from_tx | Parse request_key from receipt |
| callput_check_request_status | Poll keeper |
| callput_portfolio_summary | Balance + positions + P&L |
| callput_close_position | Build unsigned close tx |
| callput_settle_position | Build unsigned settle tx |
| callput_list_positions_by_wallet | Recover request_keys |
| callput_get_settled_pnl | Realized payout history |
| callput_get_option_chains | Raw crypto/stock chain data + IV |
