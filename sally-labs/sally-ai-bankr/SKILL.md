---
name: sally-ai-bankr
description: Native Bankr-integrated Sally AI. Exposes chat-with-sally tool using agent's Bankr wallet for x402 payments—no separate Sally wallet configuration needed. Metabolic health expertise with seamless settlement.
metadata:
  openclaw:
    id: sally-ai-bankr
    version: "1.0.0"
    requires:
      env:
        - BANKR_PRIVATE_KEY
      bins: ["node", "npm"]
    capabilities:
      - tools
    tools:
      - name: chat-with-sally
        description: Chat with Sally about metabolic health, blood sugar, A1C, nutrition, fasting, supplements, lab results and chronic disease management. 
        cost: "~$0.05 USDC per invocation"
    payment:
      model: x402-native-bankr
      currency: USDC
      network: base
      settlement: direct-from-agent-wallet
      estimated_cost: "$0.05 per message"
---

# Sally AI (Bankr Native)

Native Bankr integration of Sally AI metabolic health assistant. Uses your agent's existing Bankr wallet for x402 micropayments.

## Tool: chat-with-sally

**Name:** `chat-with-sally`  
**Input:** `{"message": "string"}`  
**Cost:** **$0.05 USD** (from Bankr wallet)

Chat with Sally about metabolic health topics including nutrition, insulin resistance, intermittent fasting, sleep optimization, and personalized meal planning.

### Examples

"Use chat-with-sally to explain metabolic flexibility"
"chat-with-sally: Create a 7-day low-carb meal plan for insulin resistance"
"Ask Sally what foods stabilize blood sugar using chat-with-sally"

## Requirements

- `BANKR_PRIVATE_KEY` environment variable set (your agent's wallet)
- USDC balance on Base network (recommend $2-5)
- Node.js 18+

## Cost Structure

- **Per message:** $0.05 USD (50000 units USDC)
- **Settlement:** Real-time via x402 protocol on Base
- **Failed requests:** No charge (402 error)


## Difference from Smithery Version

| Feature | Smithery (`sally-ai`) | Bankr Native (`sally-ai-bankr`) |
|---------|----------------------|----------------------------------|
| Tool Name | `chat-with-sally` | `chat-with-sally` (same) |
| Wallet | Separate `PRIVATE_KEY` | Reuses `BANKR_PRIVATE_KEY` |
| Hosting | Smithery Cloud | Local/Bankr Agent |
| Settlement | External MCP | Native OpenClaw |

## Security Note

Uses your existing Bankr agent wallet. No additional private key exposure required—x402 payments are signed using the agent's existing credentials.

