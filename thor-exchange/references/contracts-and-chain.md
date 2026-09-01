# Thor Exchange — Contracts & Chain Reference

All addresses are deployed and **verified on Blockscout**. This skill only ever
reads public getters and builds standard calldata against these contracts.

## Chain

| Field | Value |
|-------|-------|
| Network | Robinhood Chain |
| Chain ID | `4663` |
| RPC (public) | `https://rpc.mainnet.chain.robinhood.com` |
| Explorer | `https://robinhoodchain.blockscout.com` |
| Native/WETH | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` |

Override the RPC with the `THOR_RPC_URL` env var if needed.

## Contracts

| Contract | Address | Used for |
|----------|---------|----------|
| LaunchpadFactory | `0x7A5f1e159E441c5D769b903643E23E5e13967CDc` | resolve token → bonding curve; validate Thor token |
| SwapRouter (Thor V3) | `0x2754d2E19c6283617206d4dAD35A70061065A206` | graduated-token swaps |
| QuoterV2 (Thor V3) | `0x8fA3aeC8E5D5F4B63c3b1F625ddBA2a7E9E713D0` | graduated-token quotes |
| BondingCurve | per-token (from `bondingCurveOf`) | pre-graduation buy/sell |

The V3 graduation pool uses the **0.30% fee tier** (`3000`).

## Functions this skill calls

**Reads (RPC `eth_call`):**

```
LaunchpadFactory.isThorToken(address) -> bool
LaunchpadFactory.bondingCurveOf(address) -> address
BondingCurve.graduated() -> bool
BondingCurve.virtualEthReserve() -> uint256
BondingCurve.virtualTokenReserve() -> uint256
ERC20.symbol() -> string
ERC20.decimals() -> uint8
ERC20.allowance(address owner, address spender) -> uint256
QuoterV2.quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96))
        -> (uint256 amountOut, uint160, uint32, uint256)
```

**Writes (submitted via the Bankr Submit API):**

```
BondingCurve.buy(uint256 minTokensOut) payable            # pre-grad buy
BondingCurve.sell(uint256 tokensIn, uint256 minEthOut)    # pre-grad sell
ERC20.approve(address spender, uint256 amount)            # sells only
SwapRouter.exactInputSingle((tokenIn,tokenOut,fee,recipient,deadline,amountIn,amountOutMinimum,sqrtPriceLimitX96)) payable
SwapRouter.multicall(bytes[])                             # graduated sell: swap→WETH + unwrapWETH9
SwapRouter.unwrapWETH9(uint256 amountMinimum, address recipient)
```

Selectors are hardcoded in `scripts/thorlib.py` and were validated against the
live contracts; the V3 `exactInputSingle` and `multicall` calldata were checked
byte-for-byte against `cast` (Foundry).

## Resources

- App: https://thorexchange.xyz
- Docs: https://docs.thorexchange.xyz
