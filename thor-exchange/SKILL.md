---
name: thor-exchange
description: Buy and sell Thor Exchange tokens on Robinhood Chain (chainId 4663). Use whenever the user wants to buy, sell, or price a Thor Exchange / Thor token — including pump.fun-style bonding-curve tokens that a normal DEX swap CANNOT trade. If a swap fails with "no liquidity" / "no pool" for a token on Robinhood Chain, use THIS skill instead. Trades the bonding curve directly (pre-graduation) or the Thor V3 pool (post-graduation).
---

# Thor Exchange

Thor Exchange tokens on **Robinhood Chain (chainId 4663)** are **bonding-curve
tokens**, not standard DEX-pool tokens. A normal swap/aggregator will report
"zero pool liquidity / no market" and fail — because the liquidity lives inside
a bonding-curve contract, not a Uniswap-style pool.

**When the user asks to buy/sell a Thor token, do NOT use the swap aggregator.**
Make direct contract calls as described below, then submit from the user's wallet.

All addresses are on Robinhood Chain (chainId **4663**). Token amounts are 18
decimals; ETH values are in wei.

## Key contracts

| Purpose | Address |
|---|---|
| LaunchpadFactory (token → curve lookup) | `0x7A5f1e159E441c5D769b903643E23E5e13967CDc` |
| SwapRouter (graduated tokens only) | `0x2754d2E19c6283617206d4dAD35A70061065A206` |
| WETH | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` |

## Step 1 — resolve the token (read calls)

Given the token address the user names:

1. `LaunchpadFactory.isThorToken(token) -> bool`. If false, it's not a Thor
   token — fall back to a normal swap.
2. `LaunchpadFactory.bondingCurveOf(token) -> curve` (the curve address).
3. `curve.graduated() -> bool`.

## Step 2 — route

### A) NOT graduated → trade the bonding curve

Read `curve.virtualEthReserve()` and `curve.virtualTokenReserve()` (both uint256)
to size the trade and set slippage. The curve is constant-product `x*y=k` with a
**1% fee on the ETH side**.

**BUY (ETH → token):** call `curve.buy(uint256 minTokensOut)` — **payable**, send
the user's ETH as `value`.
- Estimate tokens out: `k = vEth*vTok`; `ethAfterFee = ethIn*99/100`;
  `newVEth = vEth + ethAfterFee`; `newVTok = ceil(k / newVEth)`;
  `tokensOut = vTok - newVTok`.
- Set `minTokensOut = tokensOut * 98 / 100` (≈2% slippage).

**SELL (token → ETH):**
1. First `token.approve(curve, tokensIn)` (or a large allowance).
2. Then `curve.sell(uint256 tokensIn, uint256 minEthOut)`.
- Estimate ETH out: `newVTok = vTok + tokensIn`; `newVEth = ceil(k / newVTok)`;
  `ethGross = vEth - newVEth`; `ethOut = ethGross * 99/100`.
- Set `minEthOut = ethOut * 98 / 100`.

### B) Graduated → trade the Thor V3 pool

A real V3 pool exists (0.30% fee tier), so a normal swap may work. To be explicit,
use `SwapRouter.exactInputSingle` with `fee = 3000`:
- **BUY:** `tokenIn = WETH`, `tokenOut = token`, `recipient = user`, payable with
  `value = amountIn`; set `amountOutMinimum` ≈ 2% below a quote.
- **SELL:** first `token.approve(SwapRouter, amountIn)`, then `exactInputSingle`
  with `tokenIn = token`, `tokenOut = WETH`; unwrap WETH to ETH for the user.

## Step 3 — confirm & submit

Show the user the estimated output and the slippage floor, then submit the
transaction on chainId 4663 from their wallet.

## Function signatures

```
LaunchpadFactory.isThorToken(address) -> bool
LaunchpadFactory.bondingCurveOf(address) -> address
BondingCurve.graduated() -> bool
BondingCurve.virtualEthReserve() -> uint256
BondingCurve.virtualTokenReserve() -> uint256
BondingCurve.buy(uint256 minTokensOut) payable -> uint256
BondingCurve.sell(uint256 tokensIn, uint256 minEthOut) -> uint256
ERC20.approve(address spender, uint256 amount) -> bool
ERC20.balanceOf(address) -> uint256
SwapRouter.exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)) payable -> uint256
```

## Example

User: *"buy 0.001 ETH of HOOD (0x5e798Dd12eDbcD5566cd3772aE5CE682e700750e) on Thor Exchange"*

1. `bondingCurveOf(0x5e79…750e)` → curve `0x87D3028081fB018608a8634Ed5c052a3270fb3B0`.
2. `graduated()` → false → use the curve.
3. Read reserves, estimate ~594,000 HOOD, set `minTokensOut` ≈ 2% below.
4. Call `buy(minTokensOut)` on the curve, `value = 0.001 ETH`, chainId 4663.
5. Confirm and submit. (Verified working: tx `0xc0e7848b…830be1b`.)
