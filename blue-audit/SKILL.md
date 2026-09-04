---
name: blue-audit
description: AI security audit for Base smart contracts — critical issues, suggested fixes, go/no-go verdict. $1.00 x402.
triggers: "audit this contract", "security review", "is this safe to use", "check this code", "smart contract audit", "rug check"
payment: x402
price_usdc: "1.00"
network: base
---

# blue-audit — Smart Contract Security Review on Base

Performs AI-powered security and product risk review of Base smart contracts or project code. Returns: critical issues, severity ratings, suggested fixes, and a go/no-go verdict.

## Trigger Conditions

Activate on:
- "Audit this contract" / "security review"
- "Is this safe to interact with"
- "Check this Solidity code / Base contract"
- "Rug check" / "honeypot check"
- Any request to review smart contract security before deploying or interacting

## How to Call

```
POST https://blueagent.dev/api/x402/blue-audit
X-Payment: <EIP-3009 USDC, amount: 1000000 (1.00 USDC)>
Content-Type: application/json

{
  "prompt": "Audit this contract: <contract address or paste Solidity code>"
}
```

**Price:** $1.00 USDC  
**Pay to:** `0xb058a1e305d9c720aa5b1bf42b6f2f6294b03b5f`  
**Manifest:** `https://blueagent.dev/.well-known/ai-tool/blue-audit.json`

## Output Structure

1. **VERDICT** — GO / NO-GO / CONDITIONAL
2. **Critical issues** — severity (CRITICAL / HIGH / MEDIUM / LOW), description, line reference if available
3. **Suggested fixes** — concrete code changes per issue
4. **Risk summary** — rug vectors, ownership risks, upgrade risks, liquidity risks
5. **What to verify onchain** — Basescan checks, ownership renounce, liquidity lock

## Key Rules

- All contract addresses must be Base Mainnet — flag if mainnet vs testnet unclear
- Never confirm a contract is "safe" — return "no critical issues found" with explicit caveats
- For address-only input: fetch from Basescan for analysis (note: bytecode-only = limited analysis)
- Distinguish between AI analysis and formal audit — always caveat that this is not a formal security audit

## Output Modes

**GO**: No critical/high issues found. List mediums and lows with fix suggestions.

**CONDITIONAL**: High issues found with clear fix path. Detail what must change before deploying/interacting.

**NO-GO**: Critical issues. Clearly state what the vulnerability is and potential exploit scenario.

## Integration

Pairs with: `contract-trust` (quick trust score), `protocol-risk-monitor` (ongoing risk tracking), `blue-build` (architecture review before audit)
