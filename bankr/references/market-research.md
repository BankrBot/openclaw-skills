# Market Research Reference

Research tokens and analyze market data using Bankr's AI-powered analysis.

## Capabilities

- Token search across chains
- Price and market data
- Technical analysis
- Social sentiment analysis
- Price charts
- Trending tokens
- Token comparisons
- Holder snapshots and supply concentration

## Token Holders

Ask for a token's holders and Bankr returns them largest-first with **USD value** and **percentage of supply**, plus a concentration summary. It needs a contract address and a chain.

```
"who are the top holders of 0x... on base?"
"show holder concentration for BNKR"
"list holders of 0x... on solana with at least $50"
```

- Set a **minimum USD value** to bound the snapshot by value rather than by count — this is the shape you want for airdrop targeting ("holders with $50+").
- The list is the **raw on-chain holder set**. It includes liquidity pools, the token contract itself, and treasuries — often the largest entries. Exclude those before paying anyone out.
- Snapshots are capped per read, and the response tells you when it was truncated with more holders still qualifying.

## Prompt Examples

**Price queries:**
- "What's the price of ETH?"
- "How much is Bitcoin worth?"
- "Current price of BNKR"
- "Price of SOL in USD"

**Market data:**
- "Show me ETH market data"
- "What's the market cap of BNKR?"
- "Trading volume for Bitcoin"
- "SOL fully diluted valuation"

**Technical analysis:**
- "Do technical analysis on ETH"
- "Show RSI for Bitcoin"
- "Is ETH overbought?"
- "Support and resistance levels for BTC"
- "Moving averages for SOL"

**Sentiment analysis:**
- "What's the sentiment on ETH?"
- "Is the community bullish on SOL?"
- "Twitter sentiment for PEPE"
- "Social metrics for DOGE"

**Charts:**
- "Show me ETH price chart"
- "Generate BTC chart for last week"
- "30-day price chart for BNKR"

**Discovery:**
- "What tokens are trending?"
- "Show top gainers today"
- "Top losers in the last 24 hours"
- "New tokens on Base"

**Comparisons:**
- "Compare ETH vs SOL"
- "Which is better: MATIC or ARB?"
- "Show differences between UNI and AAVE"

## Data Available

### Price Data
- Current USD price
- 24h / 7d / 30d change
- All-time high/low
- Historical prices

### Market Metrics
- Market cap
- Fully diluted valuation (FDV)
- 24h trading volume
- Circulating supply
- Total supply
- Max supply
- Number of holders

### Technical Indicators
- RSI (Relative Strength Index)
- MACD (Moving Average Convergence Divergence)
- Moving averages (50-day, 200-day)
- Support/resistance levels
- Bollinger Bands
- Volume analysis

### Social Metrics
- Twitter mentions
- Community sentiment
- Social volume
- Influencer activity

## Supported Chains

Token research works across:
- Base
- Polygon
- Ethereum
- Solana
- Unichain

## Token Search

Find tokens by name, symbol, or address:
- "Search for BNKR token"
- "Find tokens called Bankr"
- "What is the contract for PEPE on Base?"
- "Token address for USDC on Polygon"

## Use Cases

**Before trading:**
- Check current price and trends
- Analyze technical indicators
- Review sentiment

**Investment research:**
- Compare similar tokens
- Check market cap and volume
- Review holder distribution

**Market monitoring:**
- Track trending tokens
- Find top gainers/losers
- Monitor sentiment shifts

## Limitations

- Historical data limited to available timeframes
- Sentiment based on public social data
- New tokens may have limited data
- Analysis is informational, not investment advice
- Some metrics may not be available for all tokens

## Best Practices

1. **Cross-reference** - Check multiple metrics
2. **Context matters** - Consider overall market conditions
3. **Volume** - Low volume tokens have less reliable data
4. **New tokens** - Be cautious with recently launched tokens
5. **DYOR** - Use as one of many research tools
