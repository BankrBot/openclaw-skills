# Architecture: sally-ai-bankr vs Smithery MCP

## Pricing
Both versions charge **$0.05 USD per message** via x402 protocol.
- Amount: 50000 units (USDC 6 decimals)
- Network: Base
- Settlement: Real-time

## Smithery MCP (sally-ai)
- **Package**: `@sally-labs/sally-ai-mcp`
- **Cost**: $0.05 USD per `chat-with-sally` invocation
- **Private Key**: Requires separate `PRIVATE_KEY` env var
- **Wallet**: Dedicated Sally wallet funded with USDC

## Bankr Native (sally-ai-bankr)
- **Package**: `@sally-labs/sally-ai-bankr`
- **Cost**: $0.05 USD per `chat-with-sally` invocation (same price)
- **Private Key**: Uses existing `BANKR_PRIVATE_KEY`
- **Wallet**: Agent's existing Bankr wallet (no separate funding needed)

## Key Difference
While both charge the same $0.05 per message, Bankr Native eliminates the need to manage a second wallet and fund it separately. The cost is deducted from your agent's existing USDC balance.