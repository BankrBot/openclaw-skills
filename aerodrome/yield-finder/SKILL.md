# Aerodrome Yield Finder

This skill queries Aerodrome Finance on Base for active liquidity pools, filtering by TVL and sorting by APR (yield). It interacts directly with the Aerodrome Sugar Helper contract to get real-time on-chain data.

## Capabilities

- **Find High Yield Pools**: Sorts pools by APR.
- **Filter by TVL**: Excludes low liquidity pools based on USD threshold.
- **Real-Time Data**: Queries the Aerodrome v3 Sugar contract independently.

## Installation

```bash
cd aerodrome/yield-finder
npm install
```

## Usage

### Natural Language Examples

- "Find the top 5 pools on Aerodrome with at least $50k TVL"
- "What are the highest yielding pools on Base right now?"
- "Get APR for Aerodrome pools"

### Command Line

Run the wrapper script:

```bash
./scripts/query-pools.sh --min-tvl 10000 --limit 10
```

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `--min-tvl` | Minimum Total Value Locked in USD | $10,000 |
| `--limit` | Number of pools to return | 10 |
| `--offset` | Pagination offset | 0 |

## Requirements

- Node.js (v18+)
- NPM
- Internet connection (for Base RPC and CoinGecko API)

## Troubleshooting

### "Failed to fetch price"
The script uses CoinGecko's free API to get the current price of AERO. Rate limits may apply.
**Fix**: Wait a minute and try again.

### "Error: Node.js is required"
Ensure Node.js is installed and in your PATH.

### "Empty output"
If no pools are returned, try lowering the `--min-tvl`.
