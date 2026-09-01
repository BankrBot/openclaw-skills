# x402 Troubleshooting Guide

Common issues and solutions when working with x402.

## Table of Contents
- [Environment Setup Issues](#environment-setup-issues)
- [Server Issues](#server-issues)
- [Client Issues](#client-issues)
- [Payment Issues](#payment-issues)
- [Network Issues](#network-issues)
- [Facilitator Issues](#facilitator-issues)

## Environment Setup Issues

### Error: "Missing required environment variables"

**Symptoms:**
```
❌ Missing required environment variables: EVM_ADDRESS, SVM_ADDRESS
```

**Solutions:**
1. Ensure `.env` file exists in the correct directory
2. Check variable names match exactly (case-sensitive)
3. Verify no extra spaces around `=` signs
4. Load environment variables correctly:
   ```bash
   # TypeScript
   import { config } from "dotenv";
   config();
   
   # Python
   from dotenv import load_dotenv
   load_dotenv()
   ```

### Error: "Cannot find module 'dotenv'"

**Solutions:**
```bash
# Node.js
npm install dotenv

# Python
pip install python-dotenv
```

### Error: "Invalid private key format"

**Symptoms:**
- "Private key must be 32 bytes"
- "Invalid base58 string"

**Solutions:**
1. **EVM keys**: Should start with `0x` followed by 64 hex characters
   ```
   EVM_PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
   ```

2. **SVM keys**: Should be base58 encoded (87-88 characters)
   ```
   SVM_PRIVATE_KEY=5J6XKvKXZqCZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZ
   ```

3. Generate new test keys:
   ```bash
   # EVM (using foundry)
   cast wallet new
   
   # SVM (using Solana CLI)
   solana-keygen new
   ```

## Server Issues

### Error: "Address already in use"

**Symptoms:**
```
Error: listen EADDRINUSE: address already in use :::4021
```

**Solutions:**
1. Kill existing process on port 4021:
   ```bash
   # Linux/Mac
   lsof -ti:4021 | xargs kill -9
   
   # Windows
   netstat -ano | findstr :4021
   taskkill /PID <PID> /F
   ```

2. Or change the port:
   ```bash
   PORT=4022 python server.py
   ```

### Error: "Module not found"

**Symptoms:**
```
ModuleNotFoundError: No module named 'x402'
Error: Cannot find module '@x402/express'
```

**Solutions:**
```bash
# Python
pip install x402

# Node.js
npm install @x402/express @x402/core @x402/evm @x402/svm

# Go
go get github.com/coinbase/x402/go
```

### Error: "Facilitator connection failed"

**Symptoms:**
```
Error connecting to facilitator: ECONNREFUSED
```

**Solutions:**
1. Check internet connection
2. Verify facilitator URL is correct:
   ```bash
   # Testnet
   FACILITATOR_URL=https://x402.org/facilitator
   ```
3. Test facilitator connectivity:
   ```bash
   curl https://x402.org/facilitator/health
   ```

## Client Issues

### Error: "Insufficient balance"

**Symptoms:**
```
Error: Wallet has insufficient USDC balance
Payment failed: insufficient funds
```

**Solutions:**
1. Get testnet funds:
   - Visit [CDP Faucet](https://portal.cdp.coinbase.com/products/faucet)
   - Enter your wallet address
   - Select appropriate network (Base Sepolia or Solana Devnet)

2. Check balance:
   ```bash
   # EVM
   cast balance 0xYourAddress --rpc-url https://sepolia.base.org
   
   # SVM
   solana balance YourAddress --url devnet
   ```

3. Verify you're using testnet:
   ```bash
   # Should show testnet facilitator
   echo $FACILITATOR_URL
   ```

### Error: "Payment signature verification failed"

**Symptoms:**
```
Error: INVALID_SIGNATURE
Payment signature verification failed
```

**Solutions:**
1. Ensure private key matches public address
2. Check network matches requirement:
   ```javascript
   // Client and server must use same network
   network: "eip155:84532"  // Base Sepolia
   ```
3. Verify timestamp/nonce is current
4. Check wallet has approved USDC spending

### Error: "Network mismatch"

**Symptoms:**
```
Error: NETWORK_MISMATCH
Payment network does not match requirement
```

**Solutions:**
1. Ensure client supports the required network:
   ```typescript
   // Register both networks
   registerExactEvmScheme(client, { signer: evmSigner });
   registerExactSvmScheme(client, { signer: svmSigner });
   ```

2. Check server accepts your network:
   ```python
   # Server must register the network
   server.register(EVM_NETWORK, ExactEvmServerScheme())
   ```

## Payment Issues

### Error: "Payment settlement failed"

**Symptoms:**
```
Error: SETTLEMENT_FAILED
On-chain transaction failed
```

**Solutions:**
1. Check gas/SOL balance for transaction fees:
   ```bash
   # EVM - needs ETH for gas
   cast balance 0xYourAddress --rpc-url https://sepolia.base.org
   
   # SVM - needs SOL for fees
   solana balance YourAddress --url devnet
   ```

2. Verify transaction on explorer:
   - Base Sepolia: https://sepolia.basescan.org
   - Solana Devnet: https://explorer.solana.com?cluster=devnet

3. Check network congestion (wait and retry)

4. Increase gas limit/price if necessary

### Error: "Nonce too low"

**Symptoms:**
```
Error: Nonce too low
Transaction already processed
```

**Solutions:**
1. This is likely a replay attack protection
2. Request a new payment signature
3. Ensure you're not reusing old signatures

### Error: "Token approval required"

**Symptoms:**
```
Error: Insufficient allowance
Token transfer not approved
```

**Solutions:**
1. EVM tokens require permit signature (handled by client SDK)
2. Ensure using latest SDK version
3. Check token contract supports EIP-2612 permits

## Network Issues

### Error: "RPC connection failed"

**Symptoms:**
```
Error: Failed to connect to RPC endpoint
Network request failed
```

**Solutions:**
1. Check internet connection
2. Verify RPC endpoint is accessible:
   ```bash
   # Base Sepolia
   curl -X POST https://sepolia.base.org \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
   ```

3. Use public RPC endpoints:
   - Base Sepolia: `https://sepolia.base.org`
   - Solana Devnet: `https://api.devnet.solana.com`

### Error: "Request timeout"

**Symptoms:**
```
Error: Request timeout after 30s
Payment verification timed out
```

**Solutions:**
1. Network congestion - wait and retry
2. Increase timeout in configuration:
   ```typescript
   { timeout: 60000 } // 60 seconds
   ```
3. Check facilitator status
4. Use a different RPC endpoint

## Facilitator Issues

### Error: "Facilitator returned 500"

**Symptoms:**
```
Error: Internal server error from facilitator
Facilitator returned status 500
```

**Solutions:**
1. Check facilitator status page
2. Try alternative facilitator if available
3. Wait a few minutes and retry
4. Report to facilitator service provider

### Error: "Rate limit exceeded"

**Symptoms:**
```
Error: 429 Too Many Requests
Rate limit exceeded
```

**Solutions:**
1. Implement exponential backoff:
   ```typescript
   async function retryWithBackoff(fn, maxRetries = 3) {
     for (let i = 0; i < maxRetries; i++) {
       try {
         return await fn();
       } catch (error) {
         if (i === maxRetries - 1) throw error;
         await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
       }
     }
   }
   ```

2. Reduce request frequency
3. Consider using your own facilitator

### Error: "Invalid facilitator response"

**Symptoms:**
```
Error: Unexpected response from facilitator
Failed to parse facilitator response
```

**Solutions:**
1. Verify facilitator URL is correct
2. Check facilitator API version compatibility
3. Update SDK to latest version:
   ```bash
   npm update @x402/core
   pip install --upgrade x402
   ```

## Debugging Tips

### Enable Debug Logging

**TypeScript:**
```typescript
process.env.DEBUG = 'x402:*';
```

**Python:**
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

### Check Transaction Status

**EVM:**
```bash
# View transaction details
cast tx <txHash> --rpc-url https://sepolia.base.org

# Check if confirmed
cast receipt <txHash> --rpc-url https://sepolia.base.org
```

**SVM:**
```bash
# View transaction details
solana confirm <signature> --url devnet
```

### Verify Payment Receipt

```typescript
// Extract and log payment response
if (response.ok) {
  const paymentResponse = httpClient.getPaymentSettleResponse(
    name => response.headers.get(name)
  );
  console.log('Payment settled:', paymentResponse);
}
```

### Test with curl

```bash
# 1. Request without payment (should get 402)
curl -i http://localhost:4021/weather

# 2. Check the PAYMENT-REQUIRED header
# 3. Create payment signature using client
# 4. Retry with PAYMENT-SIGNATURE header
```

## Getting Help

If you're still stuck:

1. **Check logs**: Enable debug logging for detailed error information
2. **Review examples**: Compare your code with working examples
3. **Test components individually**: Isolate the problem
4. **Check GitHub issues**: [x402 Issues](https://github.com/coinbase/x402/issues)
5. **Ask the community**: [Base Discord](https://discord.gg/base)

## Additional Resources

- [Quick Start Guide](quick-start.md)
- [Protocol Specs](protocol_specs.md)
- [Environment Setup](environment-setup.md)
- [Examples](../examples/README.md)
