# Environment Setup Template

Copy this file to `.env` and fill in your values.

## Server Configuration (Receive Payments)

```bash
# Your wallet addresses for receiving payments
EVM_ADDRESS=0xYourEthereumWalletAddress
SVM_ADDRESS=YourSolanaWalletAddress

# Facilitator URL (leave as is for testnet)
FACILITATOR_URL=https://x402.org/facilitator

# Optional: Server port
PORT=4021
```

## Client Configuration (Make Payments)

```bash
# Your private keys for signing payments
# ⚠️ NEVER COMMIT THESE TO VERSION CONTROL ⚠️
EVM_PRIVATE_KEY=0xYourEthereumPrivateKey
SVM_PRIVATE_KEY=YourSolanaPrivateKeyInBase58

# Target server URL
RESOURCE_SERVER_URL=http://localhost:4021

# Optional: Specific endpoint to test
ENDPOINT_PATH=/weather
```

## Network Selection

### Testnet (Default - Recommended for Development)

```bash
# x402 automatically uses testnet facilitator
FACILITATOR_URL=https://x402.org/facilitator

# Networks used:
# - Base Sepolia (eip155:84532)
# - Solana Devnet (solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1)
```

### Mainnet (Production Only)

```bash
# Requires Coinbase Developer Platform API keys
FACILITATOR_URL=https://api.cdp.coinbase.com/v1/x402
CDP_API_KEY=your_cdp_api_key
CDP_API_SECRET=your_cdp_api_secret

# Networks used:
# - Base Mainnet (eip155:8453)
# - Solana Mainnet (solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp)
```

## How to Get Values

### EVM_ADDRESS / SVM_ADDRESS
Your public wallet address where you'll receive payments.

**Get from:**
- MetaMask: Click your account → Copy address
- Phantom: Click address at top → Copy
- Any web3 wallet

### EVM_PRIVATE_KEY / SVM_PRIVATE_KEY
⚠️ **SECURITY WARNING** ⚠️
- Never share or commit private keys
- Use testnet wallets only for development
- Store production keys in secure secret management

**Get from:**
- Generate new keypair for development:
  ```bash
  # Using foundry for EVM
  cast wallet new
  
  # Using Solana CLI for SVM
  solana-keygen new
  ```

### Get Testnet Funds
Visit [CDP Faucet](https://portal.cdp.coinbase.com/products/faucet)
1. Enter your wallet address
2. Select network (Base Sepolia or Solana Devnet)
3. Receive free testnet USDC

## Example .env Files

### Example 1: Server Only
```bash
EVM_ADDRESS=0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
SVM_ADDRESS=8xKvKXZqCZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZ
FACILITATOR_URL=https://x402.org/facilitator
PORT=4021
```

### Example 2: Client Only
```bash
EVM_PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
SVM_PRIVATE_KEY=5J6XKvKXZqCZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZ
RESOURCE_SERVER_URL=http://localhost:4021
```

### Example 3: Full Development Setup
```bash
# Server config
EVM_ADDRESS=0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
SVM_ADDRESS=8xKvKXZqCZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZ

# Client config (different wallet for testing)
EVM_PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
SVM_PRIVATE_KEY=5J6XKvKXZqCZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZ

# Shared config
FACILITATOR_URL=https://x402.org/facilitator
RESOURCE_SERVER_URL=http://localhost:4021
PORT=4021
```

## Security Best Practices

### DO ✅
- Use environment variables for secrets
- Use different wallets for dev/staging/prod
- Use testnet for development
- Add `.env` to `.gitignore`
- Use secret management for production (AWS Secrets Manager, HashiCorp Vault, etc.)
- Rotate keys periodically
- Monitor wallet balances

### DON'T ❌
- Commit `.env` files
- Share private keys
- Use production keys in development
- Store keys in code
- Use the same wallet for testing and production
- Expose private keys in logs
- Use keys with mainnet funds for testing

## .gitignore Entry

Add this to your `.gitignore`:
```
.env
.env.local
.env.*.local
*.key
*.pem
```

## Verifying Your Setup

### Check Server Config
```bash
# Should print your addresses
node -e "require('dotenv').config(); console.log('EVM:', process.env.EVM_ADDRESS); console.log('SVM:', process.env.SVM_ADDRESS);"
```

### Check Client Config
```bash
# Should print "Keys loaded" (never print the actual keys!)
node -e "require('dotenv').config(); console.log(process.env.EVM_PRIVATE_KEY ? 'EVM key loaded' : 'Missing EVM key');"
```

### Test Network Connectivity
```bash
# Test facilitator connection
curl https://x402.org/facilitator/health

# Should return: {"status":"ok"}
```

## Troubleshooting

### "Cannot find module 'dotenv'"
```bash
npm install dotenv
# or
pip install python-dotenv
```

### "Missing required environment variables"
- Ensure `.env` file is in the correct directory
- Check variable names match exactly (case-sensitive)
- Ensure no extra spaces around `=`

### "Invalid private key format"
- EVM keys should start with `0x` (64 hex characters after)
- SVM keys should be base58 encoded (usually 87-88 characters)

### "Insufficient balance"
- Get testnet funds from the faucet
- Verify you're using the correct network
- Check wallet address matches private key

## Additional Resources

- [Quick Start Guide](quick-start.md)
- [Protocol Specs](protocol_specs.md)
- [Examples](../examples/README.md)
