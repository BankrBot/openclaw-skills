# x402 Gateway Reference

## Overview

The Spraay x402 gateway at `gateway.spraay.app` provides 76+ paid API endpoints across 16 categories. All payments are per-request via the HTTP 402 Payment Required protocol using USDC micropayments on Base.

Payment address: `0xAd62f03C7514bb8c51f1eA70C2b75C37404695c8`

## How x402 Works

1. Client sends request to a gateway endpoint
2. Gateway returns `402 Payment Required` with payment details
3. Client sends USDC micropayment on Base
4. Gateway verifies payment and fulfills the request
5. Response returned with data

Compatible with any x402 client, Coinbase CDP facilitator, or the Spraay MCP server.

## Full Endpoint Catalog

### Category 1: Batch Payments
| Endpoint | Method | Price | Description |
|----------|--------|-------|-------------|
| `/api/payments/batch` | POST | 0.3% fee | Batch send tokens (EVM + Solana) |
| `/api/payments/batch-csv` | POST | 0.3% fee | Batch send via CSV upload |
| `/api/payments/status/:txHash` | GET | $0.001 | Check payment status |

### Category 2: AI Inference
| Endpoint | Method | Price | Description |
|----------|--------|-------|-------------|
| `/api/ai/chat` | POST | $0.01–$0.05 | Chat completion (multiple models) |
| `/api/ai/embed` | POST | $0.005 | Text embeddings |
| `/api/ai/summarize` | POST | $0.01 | Text summarization |
| `/api/ai/classify` | POST | $0.01 | Text classification |
| `/api/ai/sentiment` | POST | $0.005 | Sentiment analysis |

### Category 3: Web Search
| Endpoint | Method | Price | Description |
|----------|--------|-------|-------------|
| `/api/search/web` | POST | $0.005 | Web search |
| `/api/search/news` | POST | $0.005 | News search |
| `/api/search/images` | POST | $0.005 | Image search |

### Category 4: Communication
| Endpoint | Method | Price | Description |
|----------|--------|-------|-------------|
| `/api/email/send` | POST | $0.005 | Send email |
| `/api/sms/send` | POST | $0.01 | Send SMS |
| `/api/notify/webhook` | POST | $0.001 | Webhook notification |

### Category 5: Oracle / Price Feeds
| Endpoint | Method | Price | Description |
|----------|--------|-------|-------------|
| `/api/oracle/price/:pair` | GET | $0.001 | Price feed (e.g., ETH/USDC) |
| `/api/oracle/prices` | POST | $0.005 | Batch price feeds |
| `/api/oracle/gas/:chain` | GET | $0.001 | Gas price oracle |
| `/api/oracle/historical/:pair` | GET | $0.005 | Historical prices |

### Category 6: RPC
| Endpoint | Method | Price | Description |
|----------|--------|-------|-------------|
| `/api/rpc/:chain` | POST | $0.001 | JSON-RPC call to any supported chain |
| `/api/rpc/batch` | POST | $0.005 | Batch RPC calls |

### Category 7: Storage
| Endpoint | Method | Price | Description |
|----------|--------|-------|-------------|
| `/api/ipfs/pin` | POST | $0.01 | Pin file to IPFS |
| `/api/ipfs/get/:cid` | GET | $0.001 | Retrieve IPFS content |
| `/api/storage/upload` | POST | $0.01 | Upload to decentralized storage |

### Category 8: Identity / ENS
| Endpoint | Method | Price | Description |
|----------|--------|-------|-------------|
| `/api/identity/resolve/:name` | GET | $0.001 | Resolve ENS/domain to address |
| `/api/identity/reverse/:address` | GET | $0.001 | Reverse lookup address → name |
| `/api/identity/avatar/:name` | GET | $0.001 | Get avatar for ENS name |

### Category 9: NFT
| Endpoint | Method | Price | Description |
|----------|--------|-------|-------------|
| `/api/nft/metadata/:chain/:contract/:tokenId` | GET | $0.001 | NFT metadata |
| `/api/nft/owned/:address` | GET | $0.005 | NFTs owned by address |
| `/api/nft/collection/:contract` | GET | $0.005 | Collection info |

### Category 10: Escrow
| Endpoint | Method | Price | Description |
|----------|--------|-------|-------------|
| `/api/escrow/create` | POST | $0.05 | Create escrow |
| `/api/escrow/release/:id` | POST | $0.01 | Release escrow |
| `/api/escrow/dispute/:id` | POST | $0.01 | Dispute escrow |
| `/api/escrow/status/:id` | GET | $0.001 | Check escrow status |

### Category 11: Payroll
| Endpoint | Method | Price | Description |
|----------|--------|-------|-------------|
| `/api/payroll/create` | POST | $0.10 | Create payroll schedule |
| `/api/payroll/run/:id` | POST | 0.3% fee | Execute payroll run |
| `/api/payroll/status/:id` | GET | $0.001 | Check payroll status |
| `/api/payroll/history/:id` | GET | $0.005 | Payroll run history |

### Category 12: Bridge
| Endpoint | Method | Price | Description |
|----------|--------|-------|-------------|
| `/api/bridge/quote` | POST | $0.05 | Get bridge quote |
| `/api/bridge/execute` | POST | $0.25 | Execute bridge transfer |
| `/api/bridge/status/:id` | GET | $0.001 | Check bridge status |

### Category 13: Analytics
| Endpoint | Method | Price | Description |
|----------|--------|-------|-------------|
| `/api/analytics/wallet/:address` | GET | $0.005 | Wallet analytics |
| `/api/analytics/token/:address` | GET | $0.005 | Token analytics |
| `/api/analytics/gas-trends/:chain` | GET | $0.005 | Gas price trends |

### Category 14: Compliance / KYC
| Endpoint | Method | Price | Description |
|----------|--------|-------|-------------|
| `/api/compliance/screen/:address` | GET | $0.01 | Address sanctions screening |
| `/api/compliance/risk/:address` | GET | $0.01 | Risk score for address |

### Category 15: Robot Task Protocol (RTP)
| Endpoint | Method | Price | Description |
|----------|--------|-------|-------------|
| `/api/rtp/discover` | GET | $0.005 | Discover available robots |
| `/api/rtp/commission` | POST | $0.10 | Commission a robot task |
| `/api/rtp/status/:taskId` | GET | $0.001 | Check task status |
| `/api/rtp/cancel/:taskId` | POST | $0.01 | Cancel a task |
| `/api/rtp/capabilities` | GET | $0.001 | List robot capabilities |
| `/api/rtp/verify/:taskId` | GET | $0.005 | Verify task completion |
| `/api/rtp/receipt/:taskId` | GET | $0.001 | Get payment receipt |
| `/api/rtp/mesh/register` | POST | $0.01 | Register on XMTP mesh |

### Category 16: Utility
| Endpoint | Method | Price | Description |
|----------|--------|-------|-------------|
| `/api/util/encode-calldata` | POST | $0.001 | Encode contract calldata |
| `/api/util/decode-tx/:hash` | GET | $0.001 | Decode transaction |
| `/api/util/checksum/:address` | GET | Free | Checksum an address |
| `/api/bazaar/catalog` | GET | Free | List all endpoints |

## Bazaar Discovery

All routes are registered in Bazaar — a service discovery layer that lets agents programmatically find the endpoints they need.

```bash
# Get full catalog
curl https://gateway.spraay.app/api/bazaar/catalog

# Returns JSON array of all endpoints with pricing, descriptions, and categories
```

## Authentication

No API keys needed. Payment is the authentication. Send a valid x402 USDC micropayment and the request is fulfilled.

For the MCP server integration: `@plagtech/spraay-x402-mcp` on Smithery (60+ tools).
