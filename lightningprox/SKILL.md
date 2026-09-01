# LightningProx - Lightning Payments for AI

Pay for AI model access (Claude, GPT-4) over Bitcoin Lightning Network. 
No API keys, no accounts. Agents pay per request using prepaid spend tokens.

## What This Does
- Pay for AI inference with Bitcoin Lightning micropayments (3-10 sats/request)
- Manage prepaid budgets via spend tokens
- Discover available models and pricing
- Make AI requests without API keys or accounts

## Usage
- "Top up my LightningProx balance with 500 sats"
- "Ask GPT-4 through LightningProx: what is the Lightning Network?"
- "Check my LightningProx spend token balance"

## Setup
MCP server available at: https://github.com/unixlamadev-spec/lightningprox-mcp

Install the MCP server and add to your config:
```json
{
  "mcpServers": {
    "lightningprox": {
      "command": "lightningprox-mcp-server"
    }
  }
}
```

## API
- POST /v1/topup - Get a Lightning invoice
- POST /v1/tokens - Create spend token after payment
- POST /v1/messages - Make AI request with spend token
- GET /v1/balance - Check token balance
- GET /api/capabilities - Discover models and pricing

Website: https://lightningprox.com
