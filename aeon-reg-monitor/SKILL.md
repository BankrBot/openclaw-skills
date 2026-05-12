---
name: aeon-reg-monitor
description: |
  Track legislation, regulatory actions, and legal developments affecting prediction markets,
  crypto, and AI agents. Per item: stage (Rumor / Proposed / Comment / Final / Enforced), impact
  (kills the category / structural change / disclosure burden / noise), affected protocols by
  name, and a concrete operator action. Use as pre-trade context on legally-wrapped assets.
  Triggers: "what's happening in crypto reg", "track CFTC actions", "prediction market regulation",
  "new SEC rules", "AI agent compliance updates".
---

# aeon-reg-monitor

Regulatory intelligence for the stack pieces that get killed by a single rule change: prediction markets, agent-controlled wallets, stablecoins, MEV, AI compliance.

## Sources

Federal Register, CFTC, SEC, FinCEN, EU Official Journal, ESMA, state AGs, court dockets via CourtListener. Industry counsel commentary as cross-reference only.

## Output format

Items ranked by `Stage × Impact`. Final + Existential/High items lead. Rumor-stage items are included but visually separated.

```
FINAL × HIGH
  CFTC no-action sunset for sports-event contracts — Mar 31
  Affected: Kalshi sports markets, derived Polymarket clones
  Action: unwind positions resolving after Mar 31 OR confirm continued no-action
  Source: cftc.gov/PressReleases/...

COMMENT × HIGH
  Treasury proposed rule on stablecoin reserve composition
  Comment period closes Apr 14
  Affected: USDC issuer reserve mix (commercial paper exposure)
  Action: monitor; no immediate trade

RUMOR
  ESMA reportedly weighing MiCAR Article-12 application to prediction markets
  Single-source. Low confidence.
  Action: no action yet — confirmation watch.
```

## Rules

- Primary sources cited. "Reports indicate" without a filing or company post is rumor — flagged.
- Stage and confidence paired — high-impact + low-confidence rumors are flagged as both.
- Concrete operator action per item, or explicit "no action".
- No editorial commentary. Cited facts only.
