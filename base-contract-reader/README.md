# Base Contract Reader

Query Base blockchain smart contracts using natural language—no coding required.

## Quick Start

```bash
# Install dependencies
npm install

# Query a contract
./scripts/read.js 0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb "name"
# → Dai Stablecoin

./scripts/read.js 0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb "total supply"
# → 2470691943012780056701145

./scripts/read.js 0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb "balance of 0xYOUR_ADDRESS"
# → 0
```

## Features

✅ **Natural Language Queries** - Ask questions in plain English  
✅ **Auto-Detection** - Automatically detects ERC20/ERC721 contracts  
✅ **Fallback ABIs** - Works without Basescan API key for standard contracts  
✅ **Human-Readable** - Formats results for easy reading  
✅ **Zero Configuration** - Works out of the box for common queries  

## Supported Queries

**Token Info:**
- `name` - Get token name
- `symbol` - Get token symbol  
- `decimals` - Get token decimals
- `total supply` - Get total supply

**Balances:**
- `balance of 0x...` - Check ERC20 balance
- `owner of token 42` - Check NFT owner

**Ownership:**
- `owner` - Get contract owner

## Environment Variables

```bash
# Optional: Use your own RPC endpoint
export BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY

# Optional: Basescan API v2 key for verified contracts
# Get free key at: https://basescan.org/apis
export BASESCAN_API_KEY=your_api_key

# Then run queries
./scripts/read.js 0xCONTRACT "query"
```

## How It Works

1. **ABI Fetching**: Tries to fetch verified ABI from Basescan API v2
2. **Fallback Detection**: If that fails, auto-detects contract type (ERC20/ERC721/Ownable)
3. **Query Parsing**: Matches natural language to contract functions
4. **Contract Call**: Executes read-only call on Base
5. **Formatting**: Returns human-readable result

## Examples

See `examples/` folder for more use cases.

## For AI Agents

This skill is designed for AI agents to quickly inspect contract state without writing custom code each time.

Use in agent workflows:
```javascript
const result = await exec(`./scripts/read.js ${contractAddress} "${query}"`);
console.log(result); // Formatted output
```

## Limitations

- Read-only operations (no state changes)
- Standard contracts (ERC20/ERC721) work best
- Custom contracts need Basescan API key
- Base mainnet only

## License

MIT
