# Getting Started with ChainSage

## Quick Start

1. **Install Dependencies**
   ```bash
   # Ensure curl and jq are available
   curl --version
   jq --version
   ```

2. **Set Up API Keys (Optional)**
   ```bash
   export ALCHEMY_API_KEY="your_key_here"
   export MORALIS_API_KEY="your_key_here"
   ```

3. **Basic Usage Examples**

### Analyze a Wallet
```bash
# Basic wallet analysis
chainsage analyze wallet 0x742d35Cc6634C0532925a3b8D4C9db96C4b4Db45

# With specific chain and timeframe
chainsage analyze wallet 0x742d35Cc6634C0532925a3b8D4C9db96C4b4Db45 --chain base --days 7
```

### Track Whale Movements
```bash
# Monitor recent whale activity
chainsage track whales --chain ethereum --min-amount 100 --timeframe 24h

# Set up real-time whale alerts
chainsage alert whale --threshold 50eth --notification slack
```

### Find Arbitrage Opportunities
```bash
# Search for arbitrage across DEXs
chainsage arbitrage find --pair ETH/USDC --min-profit 100

# Monitor specific opportunities
chainsage arbitrage monitor --pair WBTC/ETH --exchanges uniswap,sushiswap
```

## Configuration

Create a configuration file at `~/.chainsage/config.json`:

```json
{
  "api_keys": {
    "alchemy": "your_alchemy_key",
    "moralis": "your_moralis_key"
  },
  "default_chain": "ethereum",
  "alert_webhook": "https://your-webhook-url.com",
  "cache_duration": 300
}
```

## Common Use Cases

### DeFi Research
- Analyze liquidity pool performance
- Track yield farming returns
- Monitor protocol usage trends

### Trading Intelligence
- Identify market manipulation patterns
- Track smart money movements
- Detect emerging trends

### Security Analysis
- Identify suspicious transaction patterns
- Monitor for potential hacks
- Analyze contract interactions

## Troubleshooting

### Common Issues

1. **API Rate Limits**
   - Upgrade your API plan
   - Implement request caching
   - Use batch requests

2. **Missing Data**
   - Check chain support
   - Verify address format
   - Ensure API keys are valid

3. **Slow Performance**
   - Reduce analysis timeframe
   - Use specific filters
   - Enable caching

### Getting Help

- Check the [API Documentation](api-docs.md)
- Review [Advanced Usage](advanced-usage.md)
- Open an issue on GitHub
- Join our Discord community
