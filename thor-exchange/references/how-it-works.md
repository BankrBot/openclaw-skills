# How the Thor Exchange skill works

## Lifecycle → routing

A Thor token lives in one of two states, and the skill routes to the right venue
automatically by reading the chain:

1. **On the bonding curve** (`graduated() == false`)
   - Buy: send ETH to `BondingCurve.buy{value}(minTokensOut)`.
   - Sell: `approve` the curve, then `BondingCurve.sell(tokensIn, minEthOut)`.
   - Quotes use the live `virtualEthReserve` / `virtualTokenReserve` with the
     public 1% ETH-side fee (constant-product `x*y=k`).

2. **Graduated to a Thor V3 pool** (`graduated() == true`)
   - Buy: `SwapRouter.exactInputSingle(WETH → token)` with `value = amountIn`
     (the router wraps the ETH).
   - Sell: `approve` the router, then `multicall([exactInputSingle(token → WETH,
     recipient = router), unwrapWETH9(minEthOut, wallet)])` so you receive native ETH.
   - Quotes use `QuoterV2.quoteExactInputSingle`.

## Execution path (Bankr Wallet Submit API)

Every write goes through Bankr's raw-transaction submit endpoint:

```
POST https://api.bankr.bot/wallet/submit
X-API-Key: <bankr key>          # key needs Wallet API enabled, non-read-only
{
  "transaction": { "to": <contract>, "chainId": 4663, "value": <wei>, "data": <calldata> },
  "description": "<human summary>",
  "waitForConfirmation": true
}
```

`chainId: 4663` (Robinhood Chain) is an officially documented value for this
endpoint. The wallet address comes from `GET /wallet/me`. No private keys are
handled by the skill — Bankr signs and broadcasts from the user's Bankr wallet.

**Why this works where the chat "buy" flow fails:** `/wallet/submit` *bypasses the
AI agent* and its swap aggregator. The natural-language "buy <token>" flow routes
through the aggregator, which flags a pre-graduation curve token as "zero pool
liquidity / no market" (there is no DEX pool — liquidity lives in the curve
contract). Submitting our pre-built `BondingCurve.buy` calldata sidesteps that
check entirely.

> If the Bankr key has an **allowed-recipients allowlist**, `/wallet/submit`
> rejects *all* raw submissions. In that case add the Thor contracts to the
> allowlist, or route via `POST /agent/prompt` instead.

## Chain support

Bankr **already supports Robinhood Chain** — it is a first-class EVM chain in
Bankr's live chains config (`GET https://api.bankr.bot/chains` returns a
`"robinhood"` entry pointing at `robinhoodchain.blockscout.com`, our chain).

So the **read/quote path works today** (public RPC), and the **execute path**
targets a chain Bankr's wallet already knows. The only thing left to confirm is
a real end-to-end submit: with a Bankr API key, run one small `thor-trade.py buy`
and verify `/agent/submit` accepts the `chainId: 4663` transaction and Bankr
signs + broadcasts it. Token resolution, routing, quoting, slippage, and calldata
are all complete and verified against the live contracts.

## Slippage & the graduation edge

- Default slippage is **200 bps (2%)**; override as the last CLI arg.
- `minOut = quote * (10000 - slippage_bps) / 10000` is passed into the on-chain
  call, which reverts if the market moves past it.
- The one buy large enough to **graduate** the curve is clamped and partially
  refunded on-chain, so it can return fewer tokens than the pre-trade estimate.
  If that trips your slippage, the trade reverts safely (no bad fill) — retry
  with a smaller size or looser slippage.
