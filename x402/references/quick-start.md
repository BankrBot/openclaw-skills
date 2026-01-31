# x402 Quick Start Guide

Get up and running with x402 in under 5 minutes.

## Prerequisites

- Node.js 18+ (for TypeScript examples) OR Python 3.9+ OR Go 1.20+
- A wallet with testnet funds
- Basic understanding of REST APIs

## Step 1: Get Testnet Funds

1. Visit the [CDP Faucet](https://portal.cdp.coinbase.com/products/faucet)
2. Enter your wallet address
3. Select "Base Sepolia" or "Solana Devnet"
4. Receive free testnet USDC

## Step 2: Set Up Environment

Create a `.env` file:

```bash
# For servers (receive payments)
EVM_ADDRESS=0xYourWalletAddress
SVM_ADDRESS=YourSolanaAddress
FACILITATOR_URL=https://x402.org/facilitator

# For clients (make payments)
EVM_PRIVATE_KEY=0xYourPrivateKey
SVM_PRIVATE_KEY=YourSolanaPrivateKey
RESOURCE_SERVER_URL=http://localhost:4021
```

⚠️ **Never commit your `.env` file or private keys!**

## Step 3: Choose Your Path

### Path A: Start a Server (Monetize Your API)

**TypeScript (Express)**
```bash
# Install dependencies
npm install @x402/express @x402/core @x402/evm dotenv express

# Copy example
cp examples/servers/express-server.ts server.ts

# Run server
npx tsx server.ts
```

**Python (FastAPI)**
```bash
# Install dependencies
pip install x402 fastapi uvicorn python-dotenv

# Copy example
cp examples/servers/fastapi-server.py server.py

# Run server
python server.py
```

Your API is now monetized! Try accessing:
- http://localhost:4021/weather (requires payment)
- http://localhost:4021/health (free)

### Path B: Use a Paid API (Client)

**TypeScript**
```bash
# Install dependencies
npm install @x402/fetch @x402/core @x402/evm viem dotenv

# Copy example
cp examples/clients/fetch-client.ts client.ts

# Run client
npx tsx client.ts
```

**Python**
```bash
# Install dependencies
pip install x402 httpx eth-account python-dotenv

# Copy example
cp examples/clients/httpx-client.py client.py

# Run client
python client.py
```

## Step 4: Test the Flow

**Terminal 1: Start Server**
```bash
cd examples/servers
python fastapi-server.py
```

**Terminal 2: Make Paid Request**
```bash
cd examples/clients
python httpx-client.py
```

You should see:
1. Client makes request
2. Payment automatically handled
3. Response received
4. Payment receipt displayed

## Understanding the Output

**Server Output:**
```
✅ x402 FastAPI server starting...
   Facilitator: https://x402.org/facilitator
   EVM Address: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
   Payment received: $0.001 from 0x123...
```

**Client Output:**
```
✅ Initialized EVM account: 0x123...
📡 Making request to: http://localhost:4021/weather
Status: 200
Response: {"city":"Tokyo","weather":"sunny","temperature":72}
Payment settled: {"txHash":"0x...","blockNumber":12345}
```

## Common Issues & Solutions

### Issue: "Missing required environment variables"
**Solution:** Ensure your `.env` file has all required variables

### Issue: "Insufficient balance"
**Solution:** Get more testnet funds from the faucet

### Issue: "Network mismatch"
**Solution:** Ensure client and server use the same network (Base Sepolia or Solana Devnet)

### Issue: "Payment verification failed"
**Solution:** Check that facilitator URL is correct and accessible

## Next Steps

### 1. Add Bazaar Discovery
Make your API discoverable by AI agents:
```bash
cp examples/advanced/bazaar-discovery.py server.py
python server.py
```

### 2. Implement Dynamic Pricing
Charge different prices based on usage:
```bash
cp examples/advanced/dynamic-pricing.py server.py
python server.py
```

### 3. Create MCP Server
Build a Claude Desktop plugin:
```bash
cp examples/advanced/mcp-server.ts mcp.ts
npx tsx mcp.ts
```

### 4. Deploy to Production
- Switch to mainnet networks
- Use production facilitator
- Implement monitoring
- Add rate limiting
- Set up error tracking

## Production Checklist

Before going live:

- [ ] Switch to mainnet network IDs
- [ ] Update facilitator to production URL
- [ ] Use environment-specific keys (never commit!)
- [ ] Implement HTTPS
- [ ] Add rate limiting
- [ ] Set up monitoring and alerts
- [ ] Test payment failure scenarios
- [ ] Document API pricing
- [ ] Add terms of service
- [ ] Implement refund policy (if applicable)

## Additional Resources

- [Full Examples](../examples/README.md) - Comprehensive example documentation
- [Protocol Specs](protocol_specs.md) - Technical reference
- [x402 GitHub](https://github.com/coinbase/x402) - Official repository
- [x402.org](https://x402.org) - Protocol website

## Support

Need help?
- Check the [examples](../examples/) directory
- Review [protocol_specs.md](protocol_specs.md)
- Visit [x402 GitHub](https://github.com/coinbase/x402)
- Join [Base Discord](https://discord.gg/base)

---

**Pro Tip:** Start with small amounts ($0.001) on testnet, then gradually increase as you validate your implementation.
