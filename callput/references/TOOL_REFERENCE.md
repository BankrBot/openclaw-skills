# Callput MCP tool reference

Endpoint: `https://mcp.callput.app/api/mcp`
Chain: Base mainnet (`8453`)

## Read tools

- `callput_scan_spreads(underlying_asset, bias, max_results?)` — ranked risk-defined candidates and ATM IV. Use first for market discovery.
- `callput_get_option_chains(underlying_asset, option_type?, expiry_date?, max_expiries?, max_strikes?)` — bounded raw chain inspection.
- `callput_portfolio_summary(address, request_keys?)` — USDC balance, positions, urgency, and P&L. Request keys are bounded and wallet-scoped.
- `callput_check_request_status(request_key, is_open)` — keeper state: pending, executed, or cancelled.
- `callput_list_positions_by_wallet(address, from_block?)` — bounded event recovery for wallet request keys.
- `callput_get_settled_pnl(address, from_block?)` — bounded settled payout history.
- `callput_get_request_key_from_tx(tx_hash)` — verifies a successful PositionManager transaction and extracts its request key.

## Transaction builders

- `callput_execute_spread(strategy, from_address, long_leg_id, short_leg_id, size, min_fill_ratio?)`
  - Returns an unsigned Base transaction and bounded USDC approval when needed.
  - Present quote, maximum risk, execution fee, allowance state, and decoded intent before confirmation.
- `callput_close_position(underlying_asset, from_address, option_token_id, size, min_amount_out_raw, min_out_when_swap_raw)`
  - Requires verified ownership, matching asset, pre-expiry lifecycle, sufficient balance, and positive user-approved floors.
- `callput_settle_position(underlying_asset, from_address, option_token_id, min_out_when_swap_raw)`
  - Requires verified ownership, matching asset, expired lifecycle, and a positive user-approved swap floor.

## Lifecycle

1. Scan.
2. Review risk and intent.
3. Prepare.
4. Confirm approval if required.
5. Confirm order.
6. Extract and persist the request key from the actual transaction hash.
7. Poll status.
8. Review portfolio.
9. Close before expiry or settle after expiry with explicit positive output floors.

## Failure handling

- Empty scan: try another live symbol/bias; do not invent prices.
- Stale market data: stop and retry later.
- Risk-policy rejection: reduce size; do not split automatically to evade the cap.
- Pending request: poll every 30 seconds for up to three minutes.
- Missing request key: recover from the confirmed transaction hash first; use the bounded wallet event scan only for historical recovery.
- RPC indexing delay: retry after the canonical receipt/log is indexed.

Callput never needs or accepts the user's private key.
