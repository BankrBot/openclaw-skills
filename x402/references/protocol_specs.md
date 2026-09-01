# x402 Protocol Reference

Complete technical reference for the x402 payment protocol.

## Core Concepts

x402 enables programmatic payments over HTTP using a simple request-response flow. The protocol is:
- **HTTP native**: Works seamlessly with existing HTTP infrastructure
- **Network agnostic**: Supports multiple blockchain networks
- **Open standard**: Freely accessible and usable by anyone
- **Trust minimizing**: No party can move funds without client authorization

## Roles

* **Client/Buyer**: Entity requesting and paying for resources (human, AI agent, or application)
* **Resource Server/Seller**: Service provider monetizing APIs or content
* **Facilitator**: Third-party service handling payment verification and settlement
  - Validates payment signatures
  - Submits transactions to blockchain
  - Returns settlement confirmations

## Network Identifiers (CAIP-2)

x402 uses CAIP-2 network identifiers for blockchain networks:

### EVM Networks
* **Base Mainnet:** `eip155:8453`
* **Base Sepolia:** `eip155:84532`
* **Ethereum Mainnet:** `eip155:1`
* **Ethereum Sepolia:** `eip155:11155111`
* **Optimism:** `eip155:10`
* **Arbitrum:** `eip155:42161`
* **Polygon:** `eip155:137`

### Solana Networks
* **Solana Mainnet:** `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`
* **Solana Devnet:** `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1`

### Format
`<namespace>:<reference>`
- **namespace**: Blockchain type (eip155 for EVM, solana for Solana)
- **reference**: Chain ID or genesis hash

## HTTP Headers

### 1. PAYMENT-REQUIRED (Server → Client)

Sent with `402 Payment Required` status when resource requires payment.

**Format:**
```
PAYMENT-REQUIRED: <base64-encoded-json>
```

**JSON Structure:**
```json
{
  "accepts": [
    {
      "scheme": "exact",
      "price": "$0.01",
      "network": "eip155:84532",
      "payTo": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      "description": "Weather data API",
      "facilitator": "https://x402.org/facilitator"
    }
  ]
}
```

**Fields:**
- `accepts`: Array of payment options client can choose from
- `scheme`: Payment scheme (currently "exact")
- `price`: Amount in USD (e.g., "$0.01") or token units
- `network`: CAIP-2 network identifier
- `payTo`: Recipient wallet address
- `description`: Human-readable description
- `facilitator`: Facilitator URL (optional, can be discovered)

### 2. PAYMENT-SIGNATURE (Client → Server)

Sent by client when retrying request with payment.

**Format:**
```
PAYMENT-SIGNATURE: <base64-encoded-json>
```

**JSON Structure (Exact EVM):**
```json
{
  "scheme": "exact",
  "network": "eip155:84532",
  "payload": {
    "signature": "0x...",
    "permit": {
      "permitted": {
        "token": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        "amount": "10000"
      },
      "nonce": "123456789",
      "deadline": "1234567890"
    },
    "owner": "0x...",
    "spender": "0x...",
    "value": "10000"
  }
}
```

**Fields:**
- `scheme`: Payment scheme used
- `network`: Network identifier
- `payload`: Scheme-specific payment data
  - For EVM: EIP-2612 permit signature
  - For SVM: Solana transaction signature

### 3. PAYMENT-RESPONSE (Server → Client)

Sent with `200 OK` when payment is settled successfully.

**Format:**
```
PAYMENT-RESPONSE: <base64-encoded-json>
```

**JSON Structure:**
```json
{
  "scheme": "exact",
  "network": "eip155:84532",
  "response": {
    "txHash": "0x...",
    "blockNumber": 12345678,
    "status": "confirmed"
  }
}
```

## HTTP Status Codes

* **402 Payment Required**: Resource requires payment, includes PAYMENT-REQUIRED header
* **200 OK**: Payment verified and settled, resource returned with PAYMENT-RESPONSE
* **400 Bad Request**: Invalid payment signature or parameters
* **401 Unauthorized**: Payment signature verification failed
* **402 Payment Required** (retry): Payment settlement failed, retry with new signature

## Payment Flow

### Standard Flow

1. **Initial Request**
   ```http
   GET /api/weather?city=Tokyo HTTP/1.1
   Host: api.example.com
   ```

2. **Server Challenge**
   ```http
   HTTP/1.1 402 Payment Required
   PAYMENT-REQUIRED: eyJhY2NlcHRzIjpbey...
   
   {
     "error": "Payment required",
     "message": "This endpoint requires $0.01 USDC payment"
   }
   ```

3. **Client Payment Request**
   ```http
   GET /api/weather?city=Tokyo HTTP/1.1
   Host: api.example.com
   PAYMENT-SIGNATURE: eyJzY2hlbWUiOiJleGFjdCI...
   ```

4. **Server Verification** (Internal)
   ```http
   POST /verify
   Host: x402.org/facilitator
   
   {
     "signature": {...},
     "requirement": {...}
   }
   ```

5. **Server Settlement** (Internal)
   ```http
   POST /settle
   Host: x402.org/facilitator
   
   {
     "signature": {...},
     "requirement": {...}
   }
   ```

6. **Success Response**
   ```http
   HTTP/1.1 200 OK
   PAYMENT-RESPONSE: eyJzY2hlbWUiOiJleGFjdCI...
   Content-Type: application/json
   
   {
     "city": "Tokyo",
     "weather": "sunny",
     "temperature": 72
   }
   ```

## Payment Schemes

### Exact Scheme

The `exact` scheme transfers a specific, predetermined amount.

**Use Cases:**
- Fixed-price API calls
- Pay-per-request services
- Content access
- Data downloads

**EVM Implementation:**
- Uses EIP-2612 permit signatures
- Supports USDC and other ERC-20 tokens
- Gas-less payments (permit-based)

**SVM Implementation:**
- Uses Solana transaction signatures
- Supports SPL tokens
- Pre-signed transactions

### Future Schemes (Proposed)

**upto Scheme**
- Pay based on resource consumption
- Use case: LLM token generation, compute time
- Amount capped at specified maximum

**subscription Scheme**
- Recurring payments at intervals
- Use case: Monthly API access
- Automatic renewal logic

**metered Scheme**
- Usage-based billing
- Use case: Data transfer, API calls
- Settled periodically based on usage

## Facilitator Endpoints

### POST /verify

Verifies payment signature without settling.

**Request:**
```json
{
  "requirement": {
    "scheme": "exact",
    "price": "$0.01",
    "network": "eip155:84532",
    "payTo": "0x..."
  },
  "signature": {
    "scheme": "exact",
    "network": "eip155:84532",
    "payload": {...}
  }
}
```

**Response:**
```json
{
  "valid": true,
  "reason": null
}
```

### POST /settle

Settles payment on-chain.

**Request:** (same as /verify)

**Response:**
```json
{
  "txHash": "0x...",
  "blockNumber": 12345678,
  "status": "confirmed",
  "timestamp": 1234567890
}
```

## Bazaar Discovery Extension

The Bazaar extension makes services discoverable by AI agents.

### Route Configuration

```python
{
    "GET /api/weather": {
        "accepts": [...],
        "description": "Get weather data for any city",
        "mimeType": "application/json",
        "extensions": {
            "bazaar": {
                "discoverable": true,
                "category": "data",
                "tags": ["weather", "real-time"],
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "city": {"type": "string"}
                    }
                },
                "outputSchema": {
                    "type": "object",
                    "properties": {
                        "weather": {"type": "string"},
                        "temperature": {"type": "number"}
                    }
                }
            }
        }
    }
}
```

### Discovery Metadata

* **discoverable**: Boolean, enables Bazaar listing
* **category**: Service category (data, finance, compute, etc.)
* **tags**: Array of searchable tags
* **inputSchema**: JSON Schema for request parameters
* **outputSchema**: JSON Schema for response format
* **example**: Example input/output for AI agents

## Security Considerations

### Server-Side

1. **Always verify signatures** - Never trust client-provided payment data
2. **Use HTTPS** - Protect payment data in transit
3. **Validate amounts** - Ensure payment matches requirement
4. **Check nonces** - Prevent replay attacks
5. **Monitor settlement** - Track failed transactions
6. **Rate limit** - Prevent spam even with payments

### Client-Side

1. **Protect private keys** - Never expose or commit keys
2. **Verify facilitator** - Use trusted facilitator services
3. **Check payment receipts** - Verify settlement confirmations
4. **Monitor balances** - Track spending and approvals
5. **Set spending limits** - Implement max payment thresholds

### Network-Specific

**EVM:**
- Verify permit signatures match EIP-2612
- Check token approvals and allowances
- Monitor for front-running attacks
- Validate contract addresses

**Solana:**
- Verify transaction signatures
- Check program authorities
- Monitor for MEV attacks
- Validate token accounts

## Common Assets

### USDC (Recommended)

**Base Mainnet:**
- Address: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- Decimals: 6
- Symbol: USDC

**Base Sepolia:**
- Address: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- Decimals: 6
- Symbol: USDC

**Solana Mainnet:**
- Mint: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- Decimals: 6
- Symbol: USDC

**Solana Devnet:**
- Mint: `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`
- Decimals: 6
- Symbol: USDC

## Error Handling

### Common Errors

**Insufficient Balance:**
```json
{
  "error": "INSUFFICIENT_BALANCE",
  "message": "Wallet has insufficient USDC balance"
}
```

**Invalid Signature:**
```json
{
  "error": "INVALID_SIGNATURE",
  "message": "Payment signature verification failed"
}
```

**Settlement Failed:**
```json
{
  "error": "SETTLEMENT_FAILED",
  "message": "On-chain transaction failed",
  "txHash": "0x..."
}
```

**Network Mismatch:**
```json
{
  "error": "NETWORK_MISMATCH",
  "message": "Payment network does not match requirement"
}
```

## Best Practices

### For Sellers

1. Support multiple networks for wider adoption
2. Use reasonable pricing (start low)
3. Provide clear descriptions
4. Implement rate limiting
5. Monitor payment failures
6. Use Bazaar for discoverability

### For Clients

1. Cache payment receipts
2. Implement retry logic with exponential backoff
3. Monitor spending
4. Use testnet for development
5. Validate facilitator responses

### For Facilitators

1. Implement robust verification
2. Monitor network health
3. Handle gas price fluctuations
4. Provide settlement guarantees
5. Support multiple networks
6. Maintain high uptime

## Testing

### Testnet Resources

**Faucets:**
- [CDP Faucet](https://portal.cdp.coinbase.com/products/faucet) - Base Sepolia, Solana Devnet
- [Base Faucet](https://www.base.org/faucet) - Base Sepolia ETH

**Facilitators:**
- Testnet: `https://x402.org/facilitator`
- Local: Run your own facilitator for testing

**Explorers:**
- Base Sepolia: `https://sepolia.basescan.org`
- Solana Devnet: `https://explorer.solana.com?cluster=devnet`

## References

- [CAIP-2 Specification](https://github.com/ChainAgnostic/CAIPs/blob/master/CAIPs/caip-2.md)
- [EIP-2612 Permit](https://eips.ethereum.org/EIPS/eip-2612)
- [x402 GitHub](https://github.com/coinbase/x402)
- [Base Documentation](https://docs.base.org)
- [Solana Documentation](https://docs.solana.com)
