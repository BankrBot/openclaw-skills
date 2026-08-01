# Token Trading Reference

Execute token trades and swaps across multiple blockchains.

## Supported Chains

| Chain | Native Token | Characteristics |
|-------|--------------|-----------------|
| Base | ETH | Low fees, ideal for memecoins |
| Polygon | POL | Fast, cheap transactions |
| Ethereum | ETH | Highest liquidity, expensive gas |
| Unichain | ETH | Newer L2 option |
| World Chain | ETH | Uniswap V3/V4 swaps |
| Arbitrum | ETH | DeFi, low-cost transactions |
| BNB Chain | BNB | BSC ecosystem trading |
| Robinhood Chain | ETH | Tokenized stocks & ETFs (USDG stablecoin), memecoins |
| Solana | SOL | High speed, minimal fees |

> **Tokenized stocks & ETFs:** Bankr can buy and sell tokenized equities (spot) on Robinhood Chain, Solana (xStocks), and Base, and offers leveraged equity perps on Avantis/Hyperliquid. Robinhood-issued stocks require one-time location verification. See [tokenized-stocks.md](tokenized-stocks.md).

## Amount Formats

| Format | Example | Description |
|--------|---------|-------------|
| USD | `$50` | Dollar amount to spend |
| Percentage | `50%` | Percentage of your balance |
| Exact | `0.1 ETH` | Specific token amount |

## Prompt Examples

**Same-chain swaps:**
- "Swap 0.1 ETH for USDC on Base"
- "Buy $50 of BNKR on Base"
- "Sell 50% of my ETH holdings"
- "Purchase 100 USDC worth of PEPE"

**Cross-chain swaps:**
- "Bridge 0.5 ETH from Ethereum to Base"
- "Move 100 USDC from Polygon to Solana"

**ETH/WETH conversion:**
- "Convert 0.1 ETH to WETH"
- "Unwrap 0.5 WETH to ETH"

Both balances update after a wrap or unwrap, so you can check your portfolio immediately afterwards and see the result.

## Chain Selection

- If no chain specified, Bankr selects the most appropriate chain
- Base is preferred for most operations due to low fees
- Cross-chain routes are automatically optimized
- Include chain name in prompt to specify: "Buy ETH on Polygon"
- **Pasting a raw contract address is safe**: Bankr verifies which chain actually hosts that contract before quoting, so a token on a less common chain (e.g. Robinhood Chain) is found even if the chain isn't named or is guessed wrong

## Slippage

- Default slippage tolerance is applied automatically
- For volatile tokens, Bankr adjusts slippage as needed
- If slippage is exceeded, the transaction fails safely
- You can specify: "with 1% slippage"

**Via the Wallet API**, set it explicitly with `slippageBps` (10–2000, default 500 = 5%) on `/wallet/swap-quote` and `/wallet/swap`. It always shapes the quote's `minBuyAmount`, but only Relay-routed pairs — cross-chain, Solana, and the relay-first chains, tokenized-stock legs excepted — carry your full tolerance into the fill. On the same-chain EVM aggregator path the execution re-quote is deliberately clamped to **2% (200 bps)**; the gap between the looser quote tolerance and the tighter execution tolerance is headroom for price drift between quote and submit. A 2000 bps quote does not execute at 2000 bps there.

## Common Issues

| Issue | Resolution |
|-------|------------|
| Insufficient balance | Reduce amount or add funds |
| Token not found | Check token symbol/address, specify chain |
| High slippage | Try smaller amounts or use limit orders |
| Network congestion | Wait and retry, or try L2 |
| Gas too high | Use Base/Polygon, or wait for lower gas |

## Best Practices

1. **Start small** - Test with small amounts first
2. **Specify chains** - For lesser-known tokens, always include chain
3. **Check slippage** - Be careful with low-liquidity tokens
4. **Monitor gas** - Ethereum mainnet can be expensive
5. **Use L2s** - Base and Polygon offer much lower fees
