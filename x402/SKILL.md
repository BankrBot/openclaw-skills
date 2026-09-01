---
name: x402-payments
description: Integration and implementation of the x402 autonomous payment protocol. Use for monetizing APIs, setting up 402 Payment Required flows, verifying onchain stablecoin payments, and registering services with the x402 Bazaar discovery layer. Includes comprehensive examples for Express.js, FastAPI, Gin, and client implementations.
metadata: {"clawdbot":{"homepage":"https://docs.cdp.coinbase.com/x402/welcome","requires":{"bins":["curl","jq"]}}}
---

# x402 Payments Skill

This skill provides comprehensive instructions and examples for implementing the **x402 protocol** - an open standard for internet-native payments that enables instant, automatic stablecoin payments directly over HTTP. x402 allows AI agents and autonomous clients to pay for services without accounts or API keys.

## What is x402?

x402 is an open standard for internet-native payments that:
- **Supports all networks**: Both crypto (EVM, SVM) and potentially fiat
- **HTTP native**: Seamlessly integrates with existing HTTP flows
- **Network agnostic**: Supports Base, Solana, and more
- **Easy to use**: 1 line integration for servers, 1 function for clients
- **AI-friendly**: Enables autonomous agent payments without API keys

## Quick Start

### Server-Side (Monetize Your API)

**Express.js (TypeScript)**
```typescript
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";

app.use(paymentMiddleware(
  {
    "GET /weather": {
      accepts: [{
        scheme: "exact",
        price: "$0.001",
        network: "eip155:84532", // Base Sepolia
        payTo: "0xYourAddress",
      }],
      description: "Weather data",
    },
  },
  new x402ResourceServer(facilitatorClient)
    .register("eip155:84532", new ExactEvmScheme())
));
```

**FastAPI (Python)**
```python
from x402.http import PaymentOption, RouteConfig
from x402.http.middleware.fastapi import PaymentMiddlewareASGI

routes = {
    "GET /weather": RouteConfig(
        accepts=[PaymentOption(
            scheme="exact",
            pay_to="0xYourAddress",
            price="$0.001",
            network="eip155:84532",
        )],
    ),
}
app.add_middleware(PaymentMiddlewareASGI, routes=routes, server=server)
```

### Client-Side (Pay for APIs)

**TypeScript (Fetch)**
```typescript
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";

const client = new x402Client();
registerExactEvmScheme(client, { signer: evmSigner });
const fetchWithPayment = wrapFetchWithPayment(fetch, client);

const response = await fetchWithPayment("http://api.example.com/weather");
```

**Python (HTTPX)**
```python
from x402 import x402Client
from x402.http.clients import x402HttpxClient

client = x402Client()
register_exact_evm_client(client, EthAccountSigner(account))

async with x402HttpxClient(client) as http:
    response = await http.get("http://api.example.com/weather")
```

## Core Concepts

### Roles
- **Client/Buyer**: Pays for resources (human or AI agent)
- **Resource Server/Seller**: Provides paid resources
- **Facilitator**: Handles payment verification and settlement

### Payment Flow
1. Client requests resource without payment → Server responds with `402 Payment Required`
2. Client creates payment signature
3. Client retries with `PAYMENT-SIGNATURE` header
4. Server verifies payment with facilitator
5. Facilitator validates and settles payment
6. Server returns resource with `PAYMENT-RESPONSE` header

### Networks

**Testnet (Development)**
- Base Sepolia: `eip155:84532`
- Solana Devnet: `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1`
- Facilitator: `https://x402.org/facilitator`

**Mainnet (Production)**
- Base Mainnet: `eip155:8453`
- Solana Mainnet: `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`
- Facilitator: `https://api.cdp.coinbase.com/v1/x402` (requires CDP API keys)

## Service Discovery (Bazaar)

Make your APIs discoverable by AI agents using the Bazaar discovery extension:

```python
from x402.extensions.bazaar import declare_discovery_extension, bazaar_resource_server_extension

server.register_extension(bazaar_resource_server_extension)

routes = {
    "GET /weather": RouteConfig(
        accepts=[...],
        extensions={
            **declare_discovery_extension(
                input_schema={"properties": {"city": {"type": "string"}}},
                output=OutputConfig(example={"weather": "sunny"}),
                tags=["weather", "real-time"],
                category="data",
            )
        },
    ),
}
```

AI agents can discover and use your service automatically without prior configuration!

## Advanced Features

### Dynamic Pricing
Adjust prices based on user authentication, time of day, or query complexity:
- Authenticated users: Discounted rates
- Peak hours: Surge pricing
- Complex queries: Higher rates
- See `examples/advanced/dynamic-pricing.py` for implementation

### MCP Integration
Create Model Context Protocol servers for AI assistants like Claude:
- AI agents discover tools dynamically
- Automatic payment handling
- Compatible with Claude Desktop
- See `examples/advanced/mcp-server.ts` for implementation

### Hooks and Callbacks
Implement custom logic at different stages:
- Pre-verification hooks
- Post-settlement hooks
- Custom payment validation
- Dynamic price calculation

## Comprehensive Examples

This skill includes complete, production-ready examples:

### Server Examples
- **Express.js** (`examples/servers/express-server.ts`) - TypeScript server with multi-network support
- **FastAPI** (`examples/servers/fastapi-server.py`) - Python async server with type safety
- **Gin** (`examples/servers/gin-server.go`) - High-performance Go server

### Client Examples
- **Fetch API** (`examples/clients/fetch-client.ts`) - TypeScript client with native fetch
- **HTTPX** (`examples/clients/httpx-client.py`) - Python async client
- **Go HTTP** (`examples/clients/go-http-client.go`) - Go standard library client

### Advanced Examples
- **Bazaar Discovery** (`examples/advanced/bazaar-discovery.py`) - Service discovery for AI agents
- **Dynamic Pricing** (`examples/advanced/dynamic-pricing.py`) - Usage-based pricing
- **MCP Server** (`examples/advanced/mcp-server.ts`) - Claude Desktop integration

See `examples/README.md` for detailed usage instructions.

## Payment Schemes

### Exact Scheme
The `exact` scheme transfers a specific amount:
- Used for fixed-price resources
- Supports EVM and SVM networks
- Amount specified in USD (e.g., "$0.01") or token units
- Common for API calls, data access, content

### Future Schemes
- **upto**: Pay based on resource consumption (e.g., LLM token generation)
- **subscription**: Recurring payments
- **metered**: Usage-based billing

## Security Best Practices

1. **Never commit private keys** - Use environment variables
2. **Use testnet for development** - Test before mainnet deployment
3. **Validate all payments** - Always verify signatures server-side
4. **Use HTTPS in production** - Encrypt payment data in transit
5. **Implement rate limiting** - Prevent abuse even with payments
6. **Monitor failed payments** - Track and investigate failures
7. **Audit facilitator responses** - Don't trust, verify

## Testing Your Implementation

### Get Testnet Funds
1. Visit [CDP Faucet](https://portal.cdp.coinbase.com/products/faucet)
2. Enter your testnet address
3. Receive USDC on Base Sepolia or Solana Devnet

### Local Testing
```bash
# Terminal 1: Start server
python examples/servers/fastapi-server.py

# Terminal 2: Run client
python examples/clients/httpx-client.py
```

### Testing HTTP 402 Flow
Use the provided test script to verify your server returns correct 402 responses:
```bash
# Test default endpoint
./scripts/x402.sh

# Test custom endpoint
./scripts/x402.sh --url http://localhost:4021 --endpoint /premium/data

# Test with query parameters
./scripts/x402.sh --endpoint /weather --query "city=Tokyo"

# Decode PAYMENT-REQUIRED headers
./scripts/x402.sh --decode-only

# Test facilitator connectivity
./scripts/x402.sh --test-facilitator
```

## Resources

### Bundled Documentation
- `references/protocol_specs.md` - Technical specifications, headers, network IDs
- `examples/README.md` - Comprehensive example documentation
- `scripts/x402.sh` - Test script for HTTP 402 Payment Required flow (paywall testing)
- `scripts/fastapi_seller_example.py` - Legacy example (deprecated in favor of examples/)

### External Resources
- [x402 GitHub Repository](https://github.com/coinbase/x402) - Official protocol repository
- [x402 Protocol Docs](https://x402.org) - Protocol documentation
- [Base Documentation](https://docs.base.org) - Base blockchain documentation
- [CDP Documentation](https://docs.cdp.coinbase.com) - Coinbase Developer Platform

## Ecosystem

The x402 ecosystem includes:
- **Client integrations**: Browser extensions, mobile SDKs
- **Server frameworks**: Express, FastAPI, Gin, Hono, Next.js
- **Facilitators**: Hosted and self-hosted payment facilitators
- **Discovery**: Bazaar for AI agent service discovery
- **Tools**: MCP servers, payment analytics, monitoring

Visit [x402.org/ecosystem](https://x402.org/ecosystem) for the full ecosystem.

## Support

- GitHub Issues: [coinbase/x402](https://github.com/coinbase/x402/issues)
- Discord: [Base Discord](https://discord.gg/base)
- Documentation: [x402.org](https://x402.org)
