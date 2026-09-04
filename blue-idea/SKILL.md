---
name: blue-idea
description: Turn a rough concept into a fundable Base builder brief — problem, why now, why Base, MVP scope, risks, 24h plan. $0.05 x402.
triggers: "blue idea", "validate my idea", "help me build on Base", "turn this into a brief", "founder brief", "is this worth building"
payment: x402
price_usdc: "0.05"
network: base
---

# blue-idea — Fundable Builder Brief for Base

Transforms a rough concept into a structured, fundable brief for Base builders. Covers: problem framing, why now, why Base, MVP scope, key risks, and a concrete 24-hour action plan.

## Trigger Conditions

Activate on:
- "Help me turn this idea into a brief"
- "Is this worth building on Base"
- "Blue idea: <concept>"
- "Validate my builder idea"
- Any rough concept that needs shaping into a Base project brief

## How to Call

```
POST https://blueagent.dev/api/x402/blue-idea
X-Payment: <EIP-3009 USDC, amount: 50000 (0.05 USDC)>
Content-Type: application/json

{
  "prompt": "Brief description of the idea"
}
```

**Price:** $0.05 USDC  
**Pay to:** `0xb058a1e305d9c720aa5b1bf42b6f2f6294b03b5f`  
**Manifest:** `https://blueagent.dev/.well-known/ai-tool/blue-idea.json`

## Output Structure

1. **Problem** — what specific pain is this solving, for whom
2. **Why now** — what changed (tech, market, regulatory, cultural) that makes this timely
3. **Why Base** — specific Base advantages (low fees, Coinbase distribution, onchain economy, ecosystem)
4. **MVP scope** — 3 features maximum, what's explicitly out of scope
5. **Key risks** — top 3 risks with mitigation for each
6. **24h plan** — concrete first steps: what to build, what to validate, who to talk to

## Key Rules

- Always tie the idea to a **specific Base advantage** — not generic blockchain benefits
- MVP must be shippable in 2 weeks or less by 1-2 devs
- Risks must be real and specific — not generic "market risk"
- 24h plan must be actionable with zero ambiguity

## Output Modes

**BRIEF**: Full 6-section brief ready to share with cofounders or investors.

**NOT_VIABLE**: If the concept has fundamental blockers — explain clearly what would need to change.

## Integration

Next steps after blue-idea:
- `blue-build` — architecture + stack for the MVP ($0.50)
- `blue-audit` — security review before launch ($1.00)
- `blue-ship` — deployment checklist ($0.10)
- `blue-raise` — pitch narrative for investors ($0.20)

Full workflow: `blue-idea → blue-build → blue-audit → blue-ship → blue-raise`
