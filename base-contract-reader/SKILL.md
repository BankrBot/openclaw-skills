---
name: base-contract-reader
description: Query Base blockchain smart contracts using natural language. Read contract state, balances, ownership, and any public view function without writing code. Supports automatic ABI fetching from Basescan.
metadata: {"openclaw":{"emoji":"🔵","homepage":"https://base.org"}}
---

# Base Contract Reader

Query Base blockchain smart contracts using natural language. No need to know ABIs or function signatures—just ask questions in plain English.

## Quick Start

```bash
# Read total supply
./scripts/read.js 0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb "total supply"

# Check balance
./scripts/read.js 0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb "balance of 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"

# Get token name
./scripts/read.js 0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb "name"

# Check ownership
./scripts/read.js 0xNFT_ADDRESS "owner of token 42"
```

## Supported Query Types

**Token Information:**
- "total supply"
- "name"
- "symbol"
- "decimals"

**Balances:**
- "balance of 0x..." (ERC20)
- "balance of 0x... for token 5" (ERC721)

**Ownership:**
- "owner" (Ownable contracts)
- "owner of token ID" (ERC721)

**Generic Queries:**
- Any public view function by name
- "get X" maps to getX() or X()
- "is X" maps to isX()

## How It Works

1. **Fetch ABI**: Automatically retrieves verified contract ABI from Basescan
2. **Match Query**: Maps natural language to contract function using fuzzy matching
3. **Parse Arguments**: Extracts addresses, token IDs, amounts from query
4. **Call Contract**: Executes read-only call via Base RPC
5. **Format Result**: Human-readable output with proper decimals, units, formatting

## Environment Variables

```bash
# Optional: Custom Base RPC (defaults to public RPC)
BASE_RPC_URL=https://mainnet.base.org

# Required: Basescan API key for ABI fetching
BASESCAN_API_KEY=your_api_key_here
```

Get a free Basescan API key at: https://basescan.org/apis

## Examples

### ERC20 Token (DEGEN)

```bash
# Get token info
./scripts/read.js 0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb "name"
# → Name: Degen

./scripts/read.js 0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb "total supply"
# → Total Supply: 36,969,696,969.00 DEGEN

# Check balance
./scripts/read.js 0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb "balance of 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
# → Balance: 1,250.5 DEGEN
```

### NFT Contract (ERC721)

```bash
# Check ownership
./scripts/read.js 0xNFT_CONTRACT "owner of token 42"
# → Owner: 0x1234...5678

# Get token URI
./scripts/read.js 0xNFT_CONTRACT "token URI 42"
# → Token URI: ipfs://QmXyz...
```

### Custom Contracts

```bash
# Query any view function
./scripts/read.js 0xCUSTOM "is paused"
# → Paused: false

./scripts/read.js 0xCUSTOM "get price"
# → Price: 0.05 ETH
```

## When to Use

- Quickly inspect contract state during development
- Check token balances without block explorer
- Verify ownership or permissions
- Read configuration values
- Audit contract state for agents

## Implementation Details

**Dependencies:**
- `ethers` v6 (contract interaction)
- `axios` (Basescan API calls)

**Limitations:**
- Read-only (no state changes)
- Requires verified contract on Basescan
- Base mainnet only (no testnets yet)

## Troubleshooting

**"Contract not verified"**
→ Contract ABI must be verified on Basescan

**"Function not found"**
→ Try exact function name from contract ABI

**"Invalid address"**
→ Ensure address is checksummed (0x prefix, valid hex)

**"RPC error"**
→ Check BASE_RPC_URL or use custom RPC endpoint

## Advanced Usage

**Direct function call:**
```bash
# Bypass fuzzy matching
./scripts/read.js 0xADDRESS --function "balanceOf" --args "0x123..."
```

**Custom RPC:**
```bash
BASE_RPC_URL=https://base-rpc.publicnode.com ./scripts/read.js 0xADDRESS "query"
```

**JSON output:**
```bash
./scripts/read.js 0xADDRESS "query" --json
# → {"result": "1234", "formatted": "1,234.00"}
```

---

Built with ❤️ for agents on Base 🔵
