---
name: copy-snipe-launch
description: Copy-trade new token launches on Base or Robinhood Chain — buy when a tracked wallet buys, sell on a configurable pump %.
recommended-models: [claude-fable-5, gpt-5.5]
---

# Copy-Snipe Launch

Automates copy-trading newly launched tokens on **Base** or **Robinhood Chain**. The agent watches a list of "tracker wallets" and, when one of them buys a freshly launched token, the agent buys the same token. It then sells the position once the token pumps a user-defined percentage.

## Configuration (ask the user once, then persist)

Before running, collect these from the user and save them to `/.memory/copy-snipe-config.md`:

- `tracker_wallets` — list of EVM addresses to copy (one or more). Required.
- `chain` — `base` or `robinhood`. Default `base`.
- `buy_amount_usd` — USD value to spend per buy. Default `$10`.
- `buy_token` — token to fund buys with. Default `USDC` on the chosen chain; fall back to native ETH, then any other held token (confirm with user before substituting).
- `pump_sell_pct` — % gain at which to auto-sell the full position. Default `100%` (2x).
- `min_token_age_minutes` — only buy tokens launched within this window (filters out old tokens the tracker wallet randomly accumulates). Default `60`.
- `min_liquidity_usd` — minimum pool liquidity to qualify a buy. Default `$5,000`.
- `max_slippage_pct` — slippage tolerance for swaps. Default `10`.

If any required field is missing, ask the user. Never guess `tracker_wallets` or `pump_sell_pct`.

## Workflow

### 1. Detect a tracker buy
- Poll each tracker wallet's recent transfers/transactions on the chosen chain using `read_contract` / `get_user_balances` / on-chain logs (Transfer events from the tracker wallet to a DEX pair, or swaps logged by Uniswap V4 / the launch curve).
- A qualifying buy = tracker wallet received an ERC-20 token AND that token was launched within `min_token_age_minutes` AND the token's pool liquidity ≥ `min_liquidity_usd`.
- Use `get_token_launch_info` (Doppler) or `token_search` to confirm launch time and liquidity.

### 2. Buy the token
- Resolve the token contract address from the tracker's buy.
- Use `smart_cross_chain_swap` to swap `buy_amount_usd` worth of `buy_token` → the new token on the chosen chain.
- Apply `max_slippage_pct` as slippage.
- Record the buy in `/.memory/copy-snipe-positions.md` with: token address, buy tx hash, buy price, buy amount, timestamp, tracker wallet that triggered it.

### 3. Monitor and sell on pump
- After a buy, periodically poll the token's USD price via `get_solana_token_price_in_usd` (Solana) or `token_search` / market data tools (EVM).
- Compute current gain % vs the recorded buy price.
- When gain % ≥ `pump_sell_pct`, sell the FULL position back to `buy_token` (or native ETH) via `smart_cross_chain_swap`.
- Record the sell tx hash, sell price, and realized PnL in `/.memory/copy-snipe-positions.md`.

### 4. Safety rails
- Never buy a token the tracker bought more than `min_token_age_minutes` ago — avoids stale bags.
- Never buy a token with liquidity below `min_liquidity_usd`.
- One buy per token per tracker wallet (dedupe against `copy-snipe-positions.md`).
- If a swap fails (slippage, insufficient balance, rug), log it and continue — do not retry blindly.
- Confirm funding token with the user before substituting away from USDC/native.

## Running it

Two modes:

**One-shot scan** — user says "scan for tracker buys now" → run step 1, act on any new qualifying buys, then stop.

**Scheduled** — user says "run copy-snipe every 5 minutes" → set up an automation via `automate_agent_command` that re-runs the scan on a schedule. Use the Automation tools (category `trading`) to register the recurring command.

## Files

- `/.memory/copy-snipe-config.md` — user configuration (tracker wallets, thresholds).
- `/.memory/copy-snipe-positions.md` — running log of buys/sells/PnL.

## Notes

- This skill performs real on-chain swaps with the user's wallet. Always confirm the config before the first run.
- Robinhood Chain tokenized-stock launches follow the same ERC-20 flow; use `chain: robinhood` and the Doppler deploy/launch tools to read launch info.
- For Base, default to Uniswap V4 / Doppler multicurve launches.
