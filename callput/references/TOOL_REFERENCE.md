# Tool Reference

Complete tool documentation for the Callput Lite MCP Server.

---

## Unsigned-TX Flow Overview

The Callput Lite MCP server follows a **unsigned-TX architecture**: MCP builds transaction calldata and returns `unsigned_tx` (ready to sign), but does NOT sign or broadcast transactions itself.

### Key Design Principle

**Note:** The unsigned-tx flow shown here is agent-agnostic. The MCP server builds the transaction calldata and returns `unsigned_tx`. Responsibility for signing varies by deployment:
- **Bankr**: Uses `/agent/sign` internally to sign with your secure wallet
- **Standalone agents** (OpenClaw, custom): Call `ethers.signer.signTransaction()` with the agent's own key
- **Other runtimes**: May use HSM, Ledger, or other signing infrastructure

The MCP server **never holds, manages, or signs private keys**. The agent runtime is responsible for signing and broadcasting.

---

## Request Key Persistence & Ownership

### Session State Management

Every time you broadcast an unsigned transaction built by `callput_execute_spread` or `callput_close_position`, extract the resulting `request_key` from the receipt. This key is **critical for P&L tracking**.

**Important:** The MCP server does NOT persist `request_keys`. Your agent runtime (Bankr, OpenClaw, etc.) must save and manage request_keys to track open positions across sessions.

### Why This Matters

- Without persisted `request_keys`, you lose cost-basis information and cannot compute accurate P&L
- Lost `request_keys` can be recovered by scanning on-chain events with `callput_list_positions_by_wallet`, but this is slower and requires RPC queries
- Modern agent runtimes (Bankr, OpenClaw) include built-in session state — use it

### Recovery Pattern

If `request_keys` are lost:
```
callput_list_positions_by_wallet({ address, from_block: optional })
```
This scans on-chain `GenerateRequestKey` events to recover all open position keys.

---

## Supported Underlyings

- Crypto: `BTC`, `ETH`
- Stock/ETF feed symbols: `TSLA`, `QQQ`, `SPY`, `EWY`, `NVDA`, `COIN`, `CRCL`, `SAMSUNG`, `HYNIX`
- Configured option-token contracts: `BTC`, `ETH`, `TSLA`, `QQQ`, `SPY`, `EWY`, `NVDA`, `COIN`
- Live tradability is feed-driven. A supported symbol can still return no candidates if every contract is unavailable.
- Leg IDs may be decimal strings or `0x` hex strings from the live Callput feed.

## Tool Definitions (10 Tools)

### 1. callput_scan_spreads

**Purpose**: Primary market scan. Returns up to 5 pre-ranked, ready-to-execute spread candidates anchored at ATM.

**Schema**:
```javascript
{
  underlying_asset: string,        // "ETH", "BTC", "TSLA", "NVDA", "COIN", "EWY", etc.
  bias: enum,                      // "bullish" | "bearish" | "neutral-bearish" | "neutral-bullish"
  max_results: number (optional)   // default 3, max 5
}
```

**Response**:
```javascript
{
  atm_iv: number,                  // ATM implied volatility (0–100%)
  expiry_date: string,             // "2026-03-28"
  days_to_expiry: number,
  spot_price: number,
  spreads: [
    {
      rank: number,
      long_leg_id: string,         // Pass to execute_spread
      short_leg_id: string,        // Pass to execute_spread
      strike_pair: string,         // "3200/3100 PUT"
      cost_usd: number,            // For buy spreads
      credit_usd: number,          // For sell spreads
      cost_pct_of_max: number,     // ↓ lower = better value
      max_profit: number,
      max_loss: number,
      rr_ratio: number             // Risk/reward
    }
  ]
}
```

**Rules**:
- Higher ATM IV favors sell spreads; apply ETH/BTC numeric thresholds only to ETH/BTC
- Prefer `rank 1` unless `days_to_expiry < 1`
- Skip if `cost_pct_of_max > 40%` (overpaying)

---

### 2. callput_execute_spread

**Purpose**: Build an unsigned spread transaction. Returns `unsigned_tx` (ready to sign) and USDC allowance check.

**Schema**:
```javascript
{
  strategy: enum,                  // "BuyCallSpread" | "SellCallSpread" | "BuyPutSpread" | "SellPutSpread"
  from_address: string,            // Wallet address (checksummed)
  long_leg_id: string,             // From scan_spreads.long_leg_id (decimal or 0x hex)
  short_leg_id: string,            // From scan_spreads.short_leg_id (decimal or 0x hex)
  size: number,                    // Positive, whole contracts
  min_fill_ratio: number (optional) // 0.01–1.0, default 0.95
}
```

**Response**:
```javascript
{
  unsigned_tx: {
    to: string,                    // Callput contract address
    data: string,                  // 0x-prefixed calldata
    value: string,                 // execution fee in wei
    chain_id: number               // 8453 (Base)
  },
  usdc_approval: {
    sufficient: boolean,           // Is USDC allowance >= required cost?
    required: number,              // Required approval amount in wei
    approve_tx: {                  // Only if sufficient == false
      to: string,                  // USDC token contract
      data: string,                // approve() calldata
      value: string                // "0"
    }
  },
  estimate: {
    cost_usd: number,              // For buy spreads
    collateral_usd: number,        // For sell spreads
    max_profit: number,
    max_loss: number
  }
}
```

**Flow**:
1. If `usdc_approval.sufficient == false`, sign and broadcast `approve_tx` first
2. Wait for approval confirmation (~12 blocks on Base)
3. Then sign and broadcast `unsigned_tx`
4. Retrieve `request_key` from receipt with `callput_get_request_key_from_tx`

---

### 3. callput_get_request_key_from_tx

**Purpose**: Extract `request_key` from a transaction receipt after broadcasting a spread execution or close.

**Schema**:
```javascript
{
  tx_hash: string                  // 0x-prefixed transaction hash
}
```

**Response**:
```javascript
{
  request_key: string,             // Save this for P&L tracking
  is_open: boolean,                // true if open-position, false if close
  block_number: number,
  timestamp: number
}
```

**Responsibility**: Agent runtime must persist `request_key` to session state for P&L queries later.

---

### 4. callput_check_request_status

**Purpose**: Poll keeper status by `request_key`. Call after broadcasting until status is executed or cancelled.

**Schema**:
```javascript
{
  request_key: string,
  is_open: boolean                 // from get_request_key_from_tx
}
```

**Response**:
```javascript
{
  status: enum,                    // "pending" | "executed" | "cancelled"
  fill_ratio: number,              // If executed: 0–1
  total_fill_amount: number,       // If executed: filled notional
  execution_time: number (optional),
  keeper_message: string (optional)
}
```

**Polling pattern**:
- Call every 30 seconds
- Max 6 polls (~3 minutes) before stopping
- On `pending` > 3 min, check RPC and network status

---

### 5. callput_portfolio_summary

**Purpose**: Returns USDC balance, all active positions with mark values, and P&L (if `request_keys` provided).

**Schema**:
```javascript
{
  address: string,                 // Wallet address
  request_keys: string[] (optional) // Saved from prior execute_spread calls
}
```

**Response**:
```javascript
{
  usdc_balance: number,            // USDC balance in decimal units
  positions: [
    {
      request_key: string,
      strategy: string,            // "BuyCallSpread" etc.
      underlying: string,          // "ETH", "BTC", "TSLA", "NVDA", "COIN", "EWY", etc.
      long_strike: number,
      short_strike: number,
      size: number,
      days_to_expiry: number,

      // Only if request_key provided:
      entry_cost_usd: number,      // Cost basis from openPositionRequests
      current_value_usd: number,   // Mark-based (fair value mid)
      unrealized_pnl_usd: number,  // current - entry
      unrealized_pnl_pct: number,  // As %

      close_bid_value_usd: number, // Conservative bid-based close estimate
      close_pnl_est_usd: number,   // Realistic exit P&L
      close_pnl_est_pct: number    // Use for profit-taking decisions
    }
  ],
  urgent_count: number             // Positions expiring < 24h
}
```

**P&L Note**:
- **Mark-based**: theoretical (mid-fair value, not tradeable)
- **Bid-based**: realistic (what you'd actually receive closing)
- Use `close_pnl_est_usd` for profit-taking, `unrealized_pnl_usd` for monitoring

---

### 6. callput_close_position

**Purpose**: Build an unsigned close-position transaction.

**Schema**:
```javascript
{
  underlying_asset: string,        // "ETH", "BTC", "TSLA", "NVDA", "COIN", "EWY", etc.
  from_address: string,
  option_token_id: string,         // From portfolio_summary
  size: number                     // Positive, whole contracts
}
```

**Response**:
```javascript
{
  unsigned_tx: {
    to: string,
    data: string,
    value: string,                 // "0"
    chain_id: number
  },
  close_estimate: {
    bid_value: number,
    pnl_usd: number,
    pnl_pct: number
  }
}
```

**When to call**:
- `days_to_expiry < 1`
- `close_pnl_est_pct > 50` (profit-taking)
- Before position expires (to avoid forced settlement)

---

### 7. callput_settle_position

**Purpose**: Build an unsigned settle transaction for an expired position.

**Schema**:
```javascript
{
  underlying_asset: string,        // "ETH", "BTC", "TSLA", "NVDA", "COIN", "EWY", etc.
  option_token_id: string          // From portfolio_summary
}
```

**Response**:
```javascript
{
  unsigned_tx: {
    to: string,
    data: string,
    value: string,
    chain_id: number
  },
  settlement: {
    payout_usd: number,            // Gross USDC returned
    realized_pnl: number           // payout - entry_cost
  }
}
```

**When to call**:
- After expiry date has passed
- To recover max profit or loss
- Required to free up collateral for new trades

---

### 8. callput_list_positions_by_wallet

**Purpose**: Recover all `request_keys` from on-chain `GenerateRequestKey` events. Use after session loss.

**Schema**:
```javascript
{
  address: string,
  from_block: number (optional)    // default ~50k blocks back (~1 day on Base)
}
```

**Response**:
```javascript
{
  open_request_keys: string[],     // Pass to portfolio_summary
  close_request_keys: string[],    // Closed positions
  lookback_blocks: number
}
```

**Use case**: Session crash, lost state, wallet recovery.

---

### 9. callput_get_settled_pnl

**Purpose**: Query `SettlePosition` events to retrieve realized payout history.

**Schema**:
```javascript
{
  address: string,
  from_block: number (optional)    // default ~50k blocks back
}
```

**Response**:
```javascript
{
  settled_positions: [
    {
      request_key: string,
      position_type: string,       // "BuyCallSpread" etc.
      payout_usd: number,          // Gross USDC at settlement
      block_number: number,
      timestamp: number
    }
  ]
}
```

**Note**: Subtract `entry_cost_usd` (from portfolio_summary) to compute realized P&L.

---

### 10. callput_get_option_chains

**Purpose**: Fetch raw tradable options from Callput market feed. Prefer `callput_scan_spreads` for normal use; use this only for raw chain inspection or IV analysis.

**Schema**:
```javascript
{
  underlying_asset: string,        // "ETH", "BTC", "TSLA", "NVDA", "COIN", "EWY", etc.
  option_type: string (optional),  // "Call" | "Put"
  expiry_date: string (optional),  // "2026-03-28"
  max_expiries: number (optional), // default 3, max 5
  max_strikes: number (optional)   // default 15, max 30
}
```

**Response**:
```javascript
{
  chains: [
    {
      expiry_date: string,
      option_type: string,
      options: [
        {
          id: string,              // Pass to execute_spread as leg_id
          strike: number,
          iv: number,              // Implied volatility (0–100%)
          bid: number,
          ask: number,
          mid: number,
          delta: number,           // -1 to +1
          gamma: number
        }
      ]
    }
  ]
}
```

---

## Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `RPC_URL` | No | `https://mainnet.base.org` | RPC endpoint for Base Mainnet |

**Note**: `CALLPUT_PRIVATE_KEY` is NOT used by the MCP server. Configure signing secrets only in the external agent/runtime that signs and broadcasts `unsigned_tx`.

---

## Error Codes & Recovery

| Error | Likely Cause | Fix |
|-------|--------------|-----|
| `execute_spread failed: insufficient USDC balance` | Not enough balance for cost + fees | Deposit more USDC |
| `execute_spread failed: wrong leg order` | Call spread has long > short, or put spread has long < short | Check scan output and select valid rank |
| `scan_spreads failed: No available options` | Symbol is supported but no live contracts are currently available | Try another symbol such as ETH, TSLA, NVDA, EWY, or COIN |
| `check_request_status failed: request_key not found` | Key was never persisted or is malformed | Use `list_positions_by_wallet` to recover |
| `close_position failed: position already closed` | Already exited before this call | Check portfolio_summary first |
| `settle_position failed: position not expired` | Called before expiry date | Wait until expiry or check current date |

---

## Summary

1. **Scan** with `callput_scan_spreads` to find candidates
2. **Build** with `callput_execute_spread` to get `unsigned_tx`
3. **Handle USDC approval** if `usdc_approval.sufficient == false`
4. **Sign & broadcast** with agent's own key
5. **Extract request_key** with `callput_get_request_key_from_tx`
6. **Persist** `request_key` in agent session state
7. **Poll** with `callput_check_request_status` until executed
8. **Manage** with `callput_portfolio_summary` (pass saved `request_keys`)
9. **Close** with `callput_close_position` when profitable or expiring soon
10. **Settle** with `callput_settle_position` after expiry

For P&L tracking, always pass saved `request_keys` to `portfolio_summary`. Use `close_pnl_est_usd` for profit-taking decisions.
