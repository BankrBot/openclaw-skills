# TwentyPad swap reference

Do not use Bankr default DEX / 0x / aggregator routing.

## Fixed params (every TwentyPad pool)

| Piece | Value |
| --- | --- |
| Chain | Base 8453 |
| Factory | `0x15a3f3ABb733868d193b511dd5b91f82ebF888A3` |
| Hook | `0x8c0986c564025903B0f1C7c87cBA1760cB4FAAcc` |
| PoolManager | `0x498581fF718922c3f8e6A244956aF099B2652b2b` |
| Universal Router | `0x6fF5693b99212Da76ad316178A184AB56D299b43` |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| fee | `0` |
| tickSpacing | `200` |
| ETH | `0x0000000000000000000000000000000000000000` |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

## Resolve token

1. User passed an address  
2. TWENTY / Twenty Launchpad → `0xb2000000000000000000001E9FA9190D91Aa5ca7` (ETH, poolId `0x66a714fbc3b181dcdf3abac867a48733e45ab507340886f35c54fb7f95e6f648`)  
3. “the B20 we just launched” → launch reply / `Launched` event  
4. Name only → factory `profiles` / `tokenCreator` / recent `Launched`  
5. Else ask once for the CA  

Must be this factory: `tokenCreator(token) != 0` or pool uses this hook + fee 0 + spacing 200.

Quote is ETH unless launch / event says USDC.

## PoolKey

```text
currency0 = min(quote, token)   // native ETH is address(0) → always currency0
currency1 = max(quote, token)
fee       = 0
tickSpacing = 200
hooks     = 0x8c0986c564025903B0f1C7c87cBA1760cB4FAAcc

```

- Buy token with quote → `zeroForOne = (quote == currency0)`
- Sell token for quote → `zeroForOne = (token == currency0)`

ETH / TWENTY: buy `zeroForOne = true`, sell `false`.
If user gave `poolId`, optionally check it equals v4 `key.toId()`. Mismatch → stop.

## Rules

1. Exact-input only. Exact-output reverts while anti-snipe fee > 1%.  
2. Uniswap fee is 0. Hook takes ~1% of quote notional.  
3. Fresh pools are single-sided. Warn above ~0.01 ETH.  
4. `hookData = 0x`  
5. ETH pools use native ETH, not WETH. Do not wrap.  
6. Sells need ERC-20 approve / Permit2 to Universal Router.  
7. No multi-hop. No add/remove LP.

Slippage 15% default, 25%+ on a pool a few minutes old.
“$N of TOKEN” → convert USD to quote, then exact-in.
“sell all” → full balance minus dust.

## Submit

```json
{
  "to": "0x6fF5693b99212Da76ad316178A184AB56D299b43",
  "chainId": 8453,
  "value": "<amountIn wei if input is native ETH, else 0>",
  "data": "<Universal Router execute(commands, inputs, deadline) V4_SWAP EXACT_INPUT_SINGLE>"
}

```

Script helper: `scripts/swap.sh <token> buy|sell eth|usdc`

## After success

Tx + Basescan, amount in, amount out, token.