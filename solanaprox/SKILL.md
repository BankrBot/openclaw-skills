# SolanaProx - AI APIs via Solana

Pay for AI inference (Claude, GPT-4) using SOL or USDC directly 
from your Phantom wallet. No API keys. No accounts. Your wallet 
is your identity.

## What This Does
- Call Claude Sonnet 4 or GPT-4 Turbo paying per request in USDC
- Check wallet balance before running expensive tasks
- Estimate costs before making requests
- List available models and pricing
- Autonomous agent payments — no human in the loop

## Usage
- "Check my SolanaProx balance"
- "Use SolanaProx to summarize this document"
- "How much will it cost to analyze this code with SolanaProx?"
- "List available AI models on SolanaProx"
- "Ask Claude via SolanaProx: what is Solana?"

## Setup
Install the MCP server:
```bash
npx solanaprox-mcp
```

Add to your agent config:
```json
{
  "mcpServers": {
    "solanaprox": {
      "command": "npx",
      "args": ["solanaprox-mcp"],
      "env": {
        "SOLANA_WALLET": "your_phantom_wallet_address"
      }
    }
  }
}
```

## Pricing
- Claude Sonnet 4: $3.60/1M input tokens, $18.00/1M output tokens
- GPT-4 Turbo: $12.00/1M input tokens, $36.00/1M output tokens
- Cached responses: 50% discount
- Typical request: $0.001–0.003 USDC

## Deposit
Visit solanaprox.com, connect Phantom, deposit SOL or USDC.
Balance updates in real time. Start making requests immediately.

## Links
- Website: https://solanaprox.com
- Docs: https://solanaprox.com/docs
- npm: https://npmjs.com/package/solanaprox-mcp
- GitHub: https://github.com/solanaprox/mcp-server
- API: https://solanaprox.com/api/capabilities
