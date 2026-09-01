# x402 Examples

This directory contains comprehensive examples for implementing the x402 protocol in various programming languages and frameworks.

## Directory Structure

```
examples/
├── servers/          # Server-side implementations
│   ├── express-server.ts
│   ├── fastapi-server.py
│   └── gin-server.go
├── clients/          # Client-side implementations
│   ├── fetch-client.ts
│   ├── httpx-client.py
│   └── go-http-client.go
└── advanced/         # Advanced use cases
    ├── bazaar-discovery.py
    ├── dynamic-pricing.py
    └── mcp-server.ts
```

## Server Examples

### Express.js (TypeScript)
**File**: `servers/express-server.ts`

A complete Express.js server with x402 payment middleware supporting both EVM (Base Sepolia) and SVM (Solana Devnet) networks.

**Features**:
- Multi-network support (EVM + SVM)
- Multiple pricing tiers
- Health check endpoint
- Clean middleware integration

**Usage**:
```bash
# Install dependencies
npm install @x402/express @x402/core @x402/evm @x402/svm dotenv

# Set environment variables
export EVM_ADDRESS="0x..."
export SVM_ADDRESS="..."
export FACILITATOR_URL="https://x402.org/facilitator"

# Run server
npx tsx servers/express-server.ts
```

### FastAPI (Python)
**File**: `servers/fastapi-server.py`

A FastAPI server demonstrating Python implementation with x402 middleware.

**Features**:
- Type-safe with Pydantic models
- Async request handling
- Multi-network support
- Route wildcard matching

**Usage**:
```bash
# Install dependencies
pip install x402 fastapi uvicorn python-dotenv

# Set environment variables
export EVM_ADDRESS="0x..."
export SVM_ADDRESS="..."

# Run server
python servers/fastapi-server.py
```

### Gin (Go)
**File**: `servers/gin-server.go`

A Go server using the Gin framework with x402 payment middleware.

**Features**:
- High-performance routing
- Concurrent request handling
- Multi-network support
- Clean middleware pattern

**Usage**:
```bash
# Install dependencies
go get github.com/coinbase/x402/go
go get github.com/gin-gonic/gin

# Set environment variables
export EVM_ADDRESS="0x..."
export SVM_ADDRESS="..."

# Run server
go run servers/gin-server.go
```

## Client Examples

### Fetch API (TypeScript)
**File**: `clients/fetch-client.ts`

Client using the native Fetch API wrapped with x402 payment capabilities.

**Features**:
- Automatic payment handling
- Multi-network support
- Payment receipt extraction
- Clean async/await syntax

**Usage**:
```bash
# Install dependencies
npm install @x402/fetch @x402/core @x402/evm @x402/svm viem @solana/kit

# Set environment variables
export EVM_PRIVATE_KEY="0x..."
export SVM_PRIVATE_KEY="..."
export RESOURCE_SERVER_URL="http://localhost:4021"

# Run client
npx tsx clients/fetch-client.ts
```

### HTTPX (Python)
**File**: `clients/httpx-client.py`

Async Python client using HTTPX with x402 integration.

**Features**:
- Async HTTP requests
- Automatic payment handling
- Multi-network support
- Context manager support

**Usage**:
```bash
# Install dependencies
pip install x402 httpx eth-account python-dotenv

# Set environment variables
export EVM_PRIVATE_KEY="0x..."
export SVM_PRIVATE_KEY="..."
export RESOURCE_SERVER_URL="http://localhost:4021"

# Run client
python clients/httpx-client.py
```

### Go HTTP Client
**File**: `clients/go-http-client.go`

Native Go HTTP client with x402 payment support.

**Features**:
- Standard library integration
- Multi-network support
- Payment receipt handling
- Error handling patterns

**Usage**:
```bash
# Set environment variables
export EVM_PRIVATE_KEY="0x..."
export SVM_PRIVATE_KEY="..."
export RESOURCE_SERVER_URL="http://localhost:4021"

# Run client
go run clients/go-http-client.go
```

## Advanced Examples

### Bazaar Discovery
**File**: `advanced/bazaar-discovery.py`

Demonstrates how to register services with the x402 Bazaar discovery layer for AI agent discoverability.

**Features**:
- Service discovery metadata
- Input/output schemas for AI agents
- Category and tag classification
- Multiple discoverable endpoints

**Use Cases**:
- Making your APIs discoverable by AI agents
- Enabling autonomous agent interactions
- Service marketplace integration

### Dynamic Pricing
**File**: `advanced/dynamic-pricing.py`

Shows how to implement dynamic pricing based on various factors.

**Features**:
- User authentication-based discounts
- Peak hour pricing
- Query complexity pricing
- Multiple pricing tiers

**Use Cases**:
- Usage-based pricing
- Time-based pricing
- Tiered service offerings
- Premium vs standard access

### MCP Server
**File**: `advanced/mcp-server.ts`

Model Context Protocol server that makes paid API requests via x402.

**Features**:
- MCP tool registration
- Automatic payment handling
- Claude Desktop compatible
- Dynamic tool discovery

**Use Cases**:
- AI assistant integration
- Claude Desktop plugins
- Autonomous agent tooling
- Pay-per-use AI tools

**Usage**:
```bash
# Install dependencies
npm install @modelcontextprotocol/sdk @x402/fetch @x402/core @x402/evm

# Add to Claude Desktop config.json
{
  "mcpServers": {
    "x402-payments": {
      "command": "npx",
      "args": ["tsx", "advanced/mcp-server.ts"],
      "env": {
        "EVM_PRIVATE_KEY": "0x..."
      }
    }
  }
}
```

## Environment Variables

All examples use the following environment variables:

### Server Variables
- `EVM_ADDRESS`: Ethereum wallet address for receiving payments
- `SVM_ADDRESS`: Solana wallet address for receiving payments
- `FACILITATOR_URL`: x402 facilitator URL (default: https://x402.org/facilitator)
- `PORT`: Server port (default: 4021)

### Client Variables
- `EVM_PRIVATE_KEY`: Ethereum private key for signing payments
- `SVM_PRIVATE_KEY`: Solana private key for signing payments
- `RESOURCE_SERVER_URL`: Target server URL (default: http://localhost:4021)
- `ENDPOINT_PATH`: API endpoint path (default: /weather)

## Networks

### Testnet (Default)
- **Base Sepolia**: `eip155:84532`
- **Solana Devnet**: `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1`
- **Facilitator**: `https://x402.org/facilitator`

### Mainnet
- **Base Mainnet**: `eip155:8453`
- **Solana Mainnet**: `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`
- **Facilitator**: `https://api.cdp.coinbase.com/v1/x402` (requires CDP API keys)

## Common Workflows

### 1. Setting Up a Payment-Protected Server
1. Choose your framework (Express, FastAPI, Gin)
2. Set up environment variables
3. Configure payment middleware with routes
4. Define protected endpoints
5. Start the server

### 2. Making Paid Requests
1. Choose your client library
2. Set up private keys
3. Initialize x402 client with signers
4. Make requests to protected endpoints
5. Handle payment receipts

### 3. Adding Bazaar Discovery
1. Import bazaar extension
2. Add discovery metadata to route config
3. Define input/output schemas
4. Register extension with server
5. Deploy to make discoverable

## Testing

### Test with Testnet Funds
1. Get testnet tokens from [CDP Faucet](https://portal.cdp.coinbase.com/products/faucet)
2. Use testnet addresses in your configuration
3. Test all payment flows
4. Verify payment receipts

### Test Locally
```bash
# Terminal 1: Start server
python servers/fastapi-server.py

# Terminal 2: Run client
python clients/httpx-client.py
```

## Security Best Practices

1. **Never commit private keys** - Use environment variables or secret management
2. **Use testnet for development** - Only use mainnet when ready for production
3. **Validate payments** - Always verify payment signatures on the server
4. **Use HTTPS in production** - Protect payment data in transit
5. **Rate limit endpoints** - Prevent abuse even with payments
6. **Monitor failed payments** - Track and investigate payment failures

## Additional Resources

- [x402 Protocol Specification](../references/protocol_specs.md)
- [x402 Official Repository](https://github.com/coinbase/x402)
- [Base Documentation](https://docs.base.org)
- [Coinbase Developer Platform](https://docs.cdp.coinbase.com)

## Support

For questions and issues:
- Check the [x402 GitHub repository](https://github.com/coinbase/x402)
- Review the [protocol documentation](https://x402.org)
- Join the [Base Discord](https://discord.gg/base)
