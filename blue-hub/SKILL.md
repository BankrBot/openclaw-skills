---
name: blue-hub
description: Discover and call any of 40 AI tools on Blue Hub — Base-native tool marketplace with x402 pay-per-call in USDC
triggers: "use blue hub", "call a blue hub tool", "what tools does blue agent have", "blue hub ls", "find a tool for", "blue hub info", "token pick on Base", "what narratives are running", "Base token alpha", "CT narrative", "what's pumping on Base"
payment: x402
network: base
---

# Blue Hub — AI Tool Marketplace for Base

Blue Hub is a curated marketplace of 40 AI tools built on Base, accessible to any agent via x402 micropayments in USDC. No API key required — pay per call onchain.

## Trigger Conditions

Activate when:
- User asks to "use a blue hub tool" or "find a tool for X"
- Request matches a capability in the tool catalog (token intel, security audit, builder tools, investor tools)
- Agent needs Base ecosystem intelligence, onchain analysis, or founder workflows
- "Give me a token pick on Base" → use `token-pick-signal` ($0.25)
- "What narratives are running on CT" → use `narrative-position` ($0.20)
- "What's the Base meta / what's pumping" → use `narrative-position` or `ecosystem-digest`

## Tool Catalog

**Catalog endpoint:** `GET https://blueagent.dev/api/catalog`

**Categories and representative tools:**

| Category | Tools | Price range |
|---|---|---|
| intelligence | token-pick-signal, narrative-position, ecosystem-digest, market-fit | $0.10–$0.25 |
| builder | blue-idea, blue-build, blue-audit, blue-ship, blue-raise | $0.05–$1.00 |
| trading | whale-copy-signal, token-momentum-scanner, portfolio-rebalancer | $0.20–$0.35 |
| security | contract-trust, protocol-risk-monitor, builder-deep-dd | $0.15–$0.35 |
| investor | investor-memo, fundraise-timing, pitch-intelligence | $0.20–$0.30 |
| agent-economy | agent-performance, agent-collab-match, agent-revenue-optimizer | $0.25–$0.30 |
| base-ecosystem | base-grant-finder, base-protocol-comparison, base-builder-network-match | $0.20–$0.25 |
| on-chain | wallet-strategy-analyzer, defi-opportunity, launch-simulator | $0.25–$0.35 |
| content | thread-intelligence, builder-brand-score, community-growth-playbook | $0.20–$0.25 |

## How to Call a Tool (x402)

All tools follow the x402 protocol on Base Mainnet (chain ID 8453).

**Endpoint pattern:**
```
POST https://blueagent.dev/api/x402/{tool-id}
X-Payment: <EIP-3009 USDC TransferWithAuthorization>
Content-Type: application/json

{ "input1": "value", "input2": "value" }
```

**Payment asset:** USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` on Base  
**Pay to:** `0xb058a1e305d9c720aa5b1bf42b6f2f6294b03b5f`

**Tool manifest:** `GET https://blueagent.dev/.well-known/ai-tool/{tool-id}.json`  
→ Returns ERC-8257 compliant manifest with inputs schema, pricing, endpoint

## Discovery Workflow

```
1. GET /api/catalog                    → list all 40 tools with prices + inputs
2. GET /.well-known/ai-tool/{id}.json  → tool manifest with input schema
3. POST /api/x402/{id} + X-Payment     → call tool, receive result
```

## Output Modes

**TOOL_FOUND**: Return tool result directly. Include tool name, price paid, and result.

**NO_TOOL**: If no tool matches the request, suggest the closest match from catalog and explain the gap.

## Key Rules

- Always verify tool existence via catalog before calling
- Parse input schema from manifest before constructing request body
- All payments in USDC on Base — never use ETH or other chains
- Tools return structured text results — parse and present cleanly

## Integration

Pairs with: `aeon-token-pick`, `aeon-narrative-tracker`, `aeon-deep-research`  
Registry: ERC-8257 ToolRegistry `0x265BB2DBFC0A8165C9A1941Eb1372F349baD2cf1` (Base)  
Discovery: agentic.market (`blueagent-dev`), CDP Bazaar  
MCP: `https://blueagent.dev/api/mcp`
