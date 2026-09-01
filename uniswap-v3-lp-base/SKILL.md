---
name: uniswap-v3-lp-base
description: Open, monitor, and rebalance a concentrated-liquidity Uniswap V3 LP position on Base. Covers pool selection, tick math, approvals, mint, position read, range check, and both time-based and price-triggered rebalance automations. Token-agnostic — works for any ERC-20 / WETH pair on Base.
tags: [uniswap, v3, base, liquidity, dex, lp, concentrated-liquidity]
---

# Uniswap V3 LP on Base

End-to-end workflow for opening and maintaining a concentrated-liquidity position on Uniswap V3 (Base). Token-agnostic: the same steps work for BNKR/WETH, any Clanker/WETH, any ERC-20/ERC-20 pair.

## Canonical addresses (Base)
- V3 Factory: `0x33128a8fC17869897dcE68Ed026d694621f6FDfD`
- NonfungiblePositionManager (NPM): `0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1`
- SwapRouter02: `0x2626664c2603336E57B271c5C0b26F421741e481`
- WETH: `0x4200000000000000000000000000000000000006`
- Fee tiers: 100 (0.01%), 500 (0.05%), 3000 (0.3%), 10000 (1%)
- Tick spacings: 1, 10, 60, 200 respectively

## User-specific state
All user-specific position state lives in the user's memory file:
`/.memory/project_uniswap_v3_positions.md`

The file format is one block per position with these fields: `chain`, `npm`, `tokenId`, `pool`, `token0`, `token1`, `fee`, `tickSpacing`, `tickLower`, `tickUpper`, `currentTickAtOpen`, `rangeWidth`, `opened`, `initial_amounts`, `liquidity`, `notes`.

The skill NEVER stores position data inline. Always read that file to discover active positions.

## Workflow 1 — Open a new position

### Step 1: Pool selection
For a token pair, find all pools across fee tiers and pick the one with the deepest liquidity at the user's desired tier.

Call `getPool(address,address,uint24)` on the Factory for each fee tier (500, 3000, 10000). For each non-zero pool, call `liquidity()` on the pool contract and pick the deepest one — unless the user specifies a fee tier. For volatile tokens, 10000 (1%) is usually the right call; for stablecoin or WETH/wBTC pairs, 500 or 3000.

### Step 2: Read pool state
On the chosen pool:
- `slot0()` → returns `(uint160 sqrtPriceX96, int24 tick, ...)`
- `tickSpacing()` → int24
- `token0()`, `token1()` → confirm ordering (lower address = token0)
- `fee()` → confirm fee tier

Price of token0 in terms of token1: `(sqrtPriceX96 / 2^96)^2`. Multiply by `10^(decimals0 - decimals1)` to get human-readable.

### Step 3: Pick range
For a symmetric range of ±P% around the current price:
```
tickDelta = ceil( ln(1 + P/100) / ln(1.0001) )
tickDelta = ceil(tickDelta / tickSpacing) * tickSpacing   // snap up
centerTick = floor(currentTick / tickSpacing) * tickSpacing
tickLower = centerTick - tickDelta
tickUpper = centerTick + tickDelta
```
Common widths:
- ±10%: tight, high capital efficiency, frequent rebalances (days)
- ±25%: balanced (weeks)
- ±50%: loose, low rebalance cadence (months)
- ±100%: basically passive, minimal fees

Single-sided alternatives:
- All above current tick → deposits only token0, converts into token1 as price rises
- All below current tick → deposits only token1, converts into token0 as price falls

### Step 4: Size the two legs
For a two-sided mint at a chosen range, compute token amounts from desired USD size using Uniswap V3 math. The NPM refunds the unused side automatically, so an approximate 50/50 USD split around the current tick is fine — it will bind on whichever side runs out first.

Approve both tokens to the NPM with a small headroom buffer (1.01x) before minting:
```
ERC20(token).approve(NPM, amountDesired * 1.01)
```

### Step 5: Mint
Call `mint` on the NPM with the tuple:
```
(token0, token1, fee, tickLower, tickUpper,
 amount0Desired, amount1Desired,
 amount0Min, amount1Min,
 recipient, deadline)
```
- `amount0Min` / `amount1Min`: set to 0 for first-time opens, or 95% of desired for slippage protection.
- `deadline`: block timestamp + 1200 (20 min).
- `recipient`: the user's wallet.

Function signature for `write_contract`:
```
mint((address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)
```

### Step 6: Persist the position
After the mint lands, parse the `IncreaseLiquidity` and `Transfer` event logs from the receipt to get the `tokenId`. Write a new block to `/.memory/project_uniswap_v3_positions.md` with all fields listed above. Do NOT inline position state into the skill.

## Workflow 2 — Check if a position is in range

For each position in `/.memory/project_uniswap_v3_positions.md`:
1. `positions(tokenId)` on the NPM → returns `(nonce, operator, token0, token1, fee, tickLower, tickUpper, liquidity, feeGrowthInside0LastX128, feeGrowthInside1LastX128, tokensOwed0, tokensOwed1)`
2. `slot0()` on the pool → returns current tick
3. In range if: `tickLower <= currentTick < tickUpper`
4. If out of range on the upper side, the position is 100% token1 (and vice versa).

## Workflow 3 — Rebalance

When a position is out of range OR the user asks to recenter:
1. `decreaseLiquidity((tokenId, liquidity, amount0Min, amount1Min, deadline))` with full liquidity → burns LP, leaves tokens owed inside the position
2. `collect((tokenId, recipient, amount0Max=type(uint128).max, amount1Max=type(uint128).max))` → pulls both tokens to wallet
3. `burn(tokenId)` → destroys the empty NFT (optional, saves a slot)
4. Swap ~50% of the now-combined balance to the other token via SwapRouter02 to rebalance to the new center
5. Re-run the **Open a new position** flow to mint fresh at the new range
6. Update `/.memory/project_uniswap_v3_positions.md` — remove old block, add new one

## Automations — BOTH time-based and price-triggered

### Automation A — Time-based range watchdog (free, notification-only)
Runs on a cron, reads the positions file, calls `positions(tokenId)` + `slot0()` for each, notifies the user if any are out of range. Cheap because it does no writes.

Setup:
- schedule: `0 * * * *` (hourly) — lower cadence for wider ranges
- maxExecutions: 168 (1 week) — users should re-up
- command template (imperative, "right now"):

> Read file /.memory/project_uniswap_v3_positions.md. For every position block, call positions(uint256 tokenId) on the NonfungiblePositionManager at 0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1 on base to get tickLower and tickUpper. Then call slot0() on the pool address from the file to get the current tick. For each position, if currentTick < tickLower OR currentTick >= tickUpper, notify me with: tokenId, pool, currentTick, [tickLower, tickUpper], and which side (upper/lower) is breached. If all positions are in range, reply "all LP positions in range".

### Automation B — Price-triggered rebalance (actually rebalances)
Two triggers per position (one for each edge of the range). Fires only when the underlying token actually crosses the range boundary, so no wasted executions.

Convert the tick boundaries to USD prices using `price = (1.0001^tick) * 10^(decimals0 - decimals1) * ethUsdPrice` (when token1 is WETH). Set `priceTriggerPrice` at each boundary in USD terms on `priceTriggerToken = token0`.

Command template for each trigger (imperative, "right now"):

> Read file /.memory/project_uniswap_v3_positions.md for position with tokenId {tokenId}. Call positions({tokenId}) on the NPM at 0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1 on base and slot0() on the pool to confirm the position is actually out of range. If in range, reply "price crossed but position still in range — skipping" and stop. Otherwise execute a full rebalance: call decreaseLiquidity((tokenId, liquidity, 0, 0, block.timestamp + 1200)) with the full current liquidity, then collect((tokenId, my wallet, type(uint128).max, type(uint128).max)) to pull both tokens. Swap roughly 50% of the dominant side to the other token via SwapRouter02 to rebalance around the current tick. Compute a fresh ±{rangeWidth}% range around the current tick using tickSpacing snapping. Approve both tokens to the NPM with 1% headroom and mint a new position. After mint lands, update /.memory/project_uniswap_v3_positions.md: remove the block for tokenId {tokenId} and append a new block with the new tokenId, pool, ticks, amounts, and liquidity.

### Why run both
- **Watchdog (time)**: drift detection, catches indexer lag / oracle desync / user-facing anomalies, also notifies on non-triggering slow moves.
- **Trigger (price)**: real rebalance action, only fires on real movement, no wasted executions.

## Gotchas
- token0 is ALWAYS the lower address — if you pass them reversed to `mint`, the tx reverts.
- `tickLower` and `tickUpper` MUST be multiples of `tickSpacing`. Always snap.
- Fee tier and tickSpacing are paired — you can't pick them independently.
- `slot0().tick` is the live tick, not TWAP — fine for LP decisions, not for oracle use.
- The NPM holds custody of the NFT; `ownerOf(tokenId)` returns your wallet. Do not transfer the NFT unless you mean to give away the position.
- `decreaseLiquidity` does NOT pull tokens — you MUST also call `collect` to receive them.
- After `burn`, the tokenId is gone forever — only call it after liquidity=0 and both tokens are collected.
- Base gas is cheap but rebalance costs still add up: mint + decrease + collect + swap + mint ≈ ~800k gas. Avoid rebalancing for <0.5% fee gain.
