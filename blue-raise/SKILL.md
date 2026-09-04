---
name: blue-raise
description: Pitch narrative for Base founders — market framing, why this wins, traction, ask, target investors. $0.20 x402.
triggers: "blue raise", "help me raise", "write my pitch", "investor narrative", "fundraising brief", "pitch deck narrative", "who should I raise from"
payment: x402
price_usdc: "0.20"
network: base
---

# blue-raise — Investor Pitch Narrative for Base Founders

Crafts a sharp investor pitch narrative: market framing, competitive positioning, why this project wins on Base, traction story, funding ask, and target investor profile. Powered by Blue Agent via x402.

## Trigger Conditions

Activate on:
- "Help me pitch this to investors"
- "Blue raise: <project description>"
- "Write my fundraising narrative"
- "Who should I raise from on Base"
- Any request for investor pitch content or fundraising strategy

## How to Call

```
POST https://blueagent.dev/api/x402/blue-raise
X-Payment: <EIP-3009 USDC, amount: 200000 (0.20 USDC)>
Content-Type: application/json

{
  "prompt": "Description of your project and current stage"
}
```

**Price:** $0.20 USDC  
**Pay to:** `0xb058a1e305d9c720aa5b1bf42b6f2f6294b03b5f`  
**Manifest:** `https://blueagent.dev/.well-known/ai-tool/blue-raise.json`

## Output Structure

1. **Market framing** — size, timing, why the window is open now
2. **Why this wins** — unfair advantage, moat, Base-specific edge
3. **Traction narrative** — how to present early metrics (even pre-revenue)
4. **The ask** — round size, use of funds breakdown, milestones it funds
5. **Target investors** — 5–8 specific funds/angels active in Base ecosystem
6. **One-liner** — single sentence that survives a Telegram forward

## Key Rules

- Market framing must be **specific to Base ecosystem** — not generic crypto/Web3
- "Why this wins" must include a defensible moat — distribution, network effect, or technical
- Traction narrative must work at any stage (pre-launch, MVP, growth) — adapt to what exists
- Target investors must be real, currently active in Base/onchain ecosystem
- One-liner test: would this make a crypto-native investor ask for a call?

## Output Modes

**RAISE_READY**: Full narrative with all 6 sections.

**NOT_READY**: If the project lacks a clear value prop or defensible position — flag the gaps and what needs to be true before raising.

## Integration

This is step 5 (final) of the founder workflow:
- Before: `blue-ship` — deploy checklist ($0.10)
- Full flow: `blue-idea → blue-build → blue-audit → blue-ship → blue-raise`

Pairs with: `pitch-intelligence` (competitive landscape), `fundraise-timing` (is now the right time to raise), `investor-memo` (full DD memo for serious investors)
