---
name: chainsage
description: Advanced blockchain analytics and intelligence skill for onchain data analysis, wallet tracking, market insights, and transaction pattern recognition across multiple chains including Ethereum, Base, Polygon, Solana, and Arbitrum. Use when users need to analyze wallet behavior, track fund flows, identify market trends, monitor whale movements, detect arbitrage opportunities, or perform deep onchain research.
metadata:
  {
    "clawdbot":
      {
        "emoji": "🔍",
        "homepage": "https://github.com/chainsage-analytics",
        "requires": { "bins": ["curl", "jq", "node"] },
      },
  }
---

# ChainSage

Advanced blockchain analytics and intelligence platform for comprehensive onchain data analysis and market insights.

## Capabilities

- **Multi-Chain Analytics** - Analyze data across Ethereum, Base, Polygon, Solana, and Arbitrum
- **Wallet Intelligence** - Track wallet behavior, identify patterns, and monitor whale movements
- **Transaction Flow Analysis** - Trace fund movements and detect money laundering patterns
- **Market Insights** - Identify arbitrage opportunities and market trends
- **DeFi Protocol Analysis** - Monitor liquidity pools, yields, and protocol usage
- **NFT Market Intelligence** - Track NFT collections, floor prices, and trading patterns
- **Real-time Alerts** - Set up custom alerts for specific onchain events
- **Historical Data Analysis** - Access and analyze historical blockchain data

## Usage Examples

"analyze wallet 0x742d35Cc6634C0532925a3b8D4C9db96C4b4Db45 for the last 30 days"
"track whale movements on Base chain in the last 24 hours"
"find arbitrage opportunities between ETH and USDC across DEXs"
"analyze transaction flow from wallet 0x123... to identify destinations"
"monitor NFT collection Bored Ape Yacht Club floor price changes"
"set up alert for any transaction over 100 ETH from known whale addresses"
"compare DeFi yields on Aave vs Compound across different chains"
"identify suspicious transaction patterns in the last hour"

## Requirements

- API access to blockchain data providers (optional for enhanced features):
  - Alchemy API key (recommended)
  - Moralis API key (alternative)
  - The Graph Protocol access
- Basic understanding of blockchain concepts
- Network access for API calls

## Installation

1. Ensure you have the required dependencies:
```bash
# For Ubuntu/Debian
sudo apt-get update && sudo apt-get install -y curl jq

# For macOS
brew install curl jq

# For other systems, ensure curl and jq are available in PATH
```

2. Configure your API keys (optional but recommended):
```bash
export ALCHEMY_API_KEY="your_alchemy_key_here"
export MORALIS_API_KEY="your_moralis_key_here"
```

## Data Sources

ChainSage aggregates data from multiple sources to provide comprehensive analytics:

- **Blockchain Nodes** - Direct node access for real-time data
- **Indexing Services** - The Graph, Dune Analytics, and Flipside Crypto
- **Market Data** - CoinGecko, CoinMarketCap for price information
- **DeFi Protocols** - Direct protocol integration for yield and liquidity data

## Privacy and Security

- All wallet analysis is performed using public blockchain data
- No private keys or sensitive information is required
- API keys are stored locally and never transmitted to third parties
- Follows best practices for data privacy and security

## Supported Networks

- **Ethereum Mainnet** - Full support with historical data
- **Base** - Real-time and historical analytics
- **Polygon** - Comprehensive DeFi protocol tracking
- **Solana** - NFT and DeFi analytics
- **Arbitrum** - Layer 2 transaction analysis
- **Optimism** - Coming soon

## Advanced Features

### Pattern Recognition
- Detect wash trading patterns
- Identify sandwich attacks
- Monitor MEV extraction activities
- Track flash loan arbitrage

### Custom Queries
- SQL-like query language for complex analysis
- Custom alert conditions
- Automated reporting
- Data export capabilities

### Integration Support
- Webhook notifications
- Slack/Discord bot integration
- Node.js helper utilities for programmatic usage (helpers.js)
- CSV/JSON data export
