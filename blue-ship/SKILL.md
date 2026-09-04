---
name: blue-ship
description: Deployment checklist, verification steps, release notes, and monitoring plan for shipping on Base. $0.10 x402.
triggers: "blue ship", "ready to deploy", "deployment checklist", "how to launch", "ship this", "go live on Base", "release checklist"
payment: x402
price_usdc: "0.10"
network: base
---

# blue-ship — Deployment Checklist for Base

Generates a complete pre-launch checklist: deployment steps, verification procedures, release notes template, and monitoring plan. Ensures nothing is missed before going live on Base.

## Trigger Conditions

Activate on:
- "I'm ready to ship — what do I need to check"
- "Blue ship: <project description>"
- "Deployment checklist for X"
- "How do I launch this on Base"
- Any request for a ship/deploy/launch plan

## How to Call

```
POST https://blueagent.dev/api/x402/blue-ship
X-Payment: <EIP-3009 USDC, amount: 100000 (0.10 USDC)>
Content-Type: application/json

{
  "prompt": "Description of what you're shipping"
}
```

**Price:** $0.10 USDC  
**Pay to:** `0xb058a1e305d9c720aa5b1bf42b6f2f6294b03b5f`  
**Manifest:** `https://blueagent.dev/.well-known/ai-tool/blue-ship.json`

## Output Structure

1. **Pre-deploy checklist** — env vars, contract verification, access control, pause mechanisms
2. **Deploy sequence** — ordered steps with commands (contracts first, then frontend)
3. **Verification steps** — Basescan verification, frontend smoke test, x402 endpoint test
4. **Release notes** — template with what changed, known issues, upgrade instructions
5. **Monitoring plan** — what to watch post-launch (errors, gas, liquidity, user activity)
6. **Rollback plan** — how to revert if something goes wrong

## Key Rules

- Checklist must be environment-specific: staging → mainnet, not generic
- Contract deployment must include Basescan verification command
- Monitoring must cover both onchain (events, balances) and offchain (error rates, latency)
- Rollback plan is mandatory — never ship without an escape hatch
- All Base Mainnet specifics: chain ID 8453, correct RPC endpoints

## Integration

This is step 4 of the founder workflow:
- Before: `blue-audit` — security review ($1.00)
- After: `blue-raise` — pitch narrative for investors ($0.20)
- Full flow: `blue-idea → blue-build → blue-audit → blue-ship → blue-raise`
