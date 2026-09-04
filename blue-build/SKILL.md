---
name: blue-build
description: Architecture, stack, folder structure, integrations, and test plan for a Base project. $0.50 x402.
triggers: "blue build", "architect this", "what stack should I use", "help me build", "technical plan", "folder structure", "how to build this on Base"
payment: x402
price_usdc: "0.50"
network: base
---

# blue-build — Architecture & Stack for Base Builders

Produces a complete technical blueprint for a Base project: recommended stack, folder structure, key integrations, file-by-file breakdown, and test plan. Powered by Blue Agent via x402.

## Trigger Conditions

Activate on:
- "Help me architect this on Base"
- "What stack should I use for X"
- "Blue build: <project description>"
- "Give me the technical plan / folder structure"
- Any request for technical architecture of a Base project

## How to Call

```
POST https://blueagent.dev/api/x402/blue-build
X-Payment: <EIP-3009 USDC, amount: 500000 (0.50 USDC)>
Content-Type: application/json

{
  "prompt": "Description of what you want to build"
}
```

**Price:** $0.50 USDC  
**Pay to:** `0xb058a1e305d9c720aa5b1bf42b6f2f6294b03b5f`  
**Manifest:** `https://blueagent.dev/.well-known/ai-tool/blue-build.json`

## Output Structure

1. **Stack** — frontend, backend, smart contracts, infra (specific libs + versions)
2. **Folder structure** — full directory tree with file-level annotations
3. **Key integrations** — Base RPC, Coinbase Wallet SDK, x402, Uniswap v4, etc.
4. **Core files** — what each critical file does and rough implementation notes
5. **Test plan** — unit, integration, and onchain test strategy
6. **Deployment** — Vercel / Railway / Cloudflare + contract deploy flow

## Key Rules

- Stack must be **Base-native**: Wagmi/Viem over Ethers, Base RPC endpoints, Base-deployed contracts
- No Ethereum mainnet assumptions — flag if a dependency isn't available on Base
- Folder structure must be production-ready, not tutorial-level
- Include `.env.example` variables list
- Test plan must cover at minimum: happy path, edge cases, onchain fork tests

## Integration

This is step 2 of the founder workflow:
- Before: `blue-idea` — validate the concept ($0.05)
- After: `blue-audit` — security review ($1.00) → `blue-ship` — deploy checklist ($0.10)
