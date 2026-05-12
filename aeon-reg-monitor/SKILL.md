---
name: aeon-reg-monitor
description: |
  Track legislation, regulatory actions, and legal developments affecting prediction markets,
  crypto, and AI agents — triaged by stage × impact for decision-ready output. Tells the difference
  between a comment-period rumble and a final rule shipping next week. Use for pre-trade context on
  legally-wrapped assets, daily reads for compliance-existential agent operators, or building a
  catalyst calendar.
  Triggers: "what's happening in crypto reg", "track CFTC actions", "prediction market regulation",
  "any new rules from SEC", "AI agent compliance updates".
---

# aeon-reg-monitor

Regulatory intelligence for the parts of the stack that get killed by a single rule change: prediction markets, agent-controlled wallets, stablecoins, MEV, and AI-related compliance. Each item is triaged on a 2D grid — **stage** × **impact** — so the operator can tell a comment-period rumble apart from a final rule shipping next week.

## Topics tracked

| Topic | Bodies |
|---|---|
| Prediction markets | CFTC, state AGs, EU MiCAR |
| Stablecoins | Treasury, NYDFS, MiCAR |
| Crypto markets broadly | SEC, CFTC, court rulings |
| AI agents | Agency rulemaking, NIST, EU AI Act enforcement |
| Privacy / KYC | FinCEN Travel Rule, Tornado Cash precedent |

Topic list is configurable.

## Stage classification

| Stage | What it means | Time to impact |
|---|---|---|
| **Rumor** | Reported intent, no public action. | Slow / never |
| **Proposed** | Draft rule, ANPRM, or bill introduced. | Months |
| **Comment** | Open for public comment. | Weeks–months |
| **Final** | Final rule or enacted law. | Days–immediate |
| **Enforced** | Active enforcement action. | Immediate |

Stage is reported with confidence — "Rumor (single-source)" is not the same as "Final (Federal Register publication)".

## Impact classification

| Impact | What it means |
|---|---|
| **Existential** | Eliminates the protocol/market category. |
| **High** | Forces structural change (geo-blocks, KYC walls, mandated changes). |
| **Medium** | Disclosure or reporting burden; survivable. |
| **Low** | Process noise; no operator action needed. |

## Output

Triage table — items ranked by `Stage × Impact`. Final-stage × High-impact items lead. Each row includes:

- One-line summary.
- Stage + confidence.
- Impact + reasoning.
- Affected protocols / tokens / markets, named.
- Concrete operator action: "hedge / unwind / no action".
- Primary source link (filing, press release, docket entry).

Rumor-stage items are included but visually separated from confirmed items.

## Sample output

```
*Reg Monitor — 2026-05-12*

FINAL × HIGH
• CFTC no-action letter sunset for sports-event contracts — Mar 31 ← shipped
  Affected: Kalshi sports markets, derived Polymarket clones
  Action: unwind positions resolving after Mar 31 OR confirm continued no-action
  Source: cftc.gov/PressReleases/...

COMMENT × HIGH
• Treasury proposed rule on stablecoin reserve composition
  Comment period closes Apr 14
  Affected: USDC issuer reserve mix (commercial paper exposure)
  Action: monitor; no immediate trade

PROPOSED × MEDIUM
• Bipartisan agent-disclosure bill introduced (HR-XXXX)
  Stage: Proposed (introduced, no committee mark-up scheduled)
  Action: track committee schedule; no immediate impact

RUMOR
• ESMA reportedly weighing MiCAR Article-12 application to prediction markets
  Single-source (FT reporter). Low confidence.
  Affected: EU-resident Polymarket access if confirmed.
  Action: no action yet — confirmation watch.
```

## Sources

- Federal Register, CFTC, SEC, FinCEN dockets.
- EU Official Journal, ESMA, EBA publications.
- State AG press releases.
- Court dockets via PACER / CourtListener.
- Industry counsel commentary as cross-reference (Expert-tier, not Primary).

## Guidelines

- Primary sources cited, not "reports indicate". Link the filing.
- Stage + confidence are paired — high-impact + low-confidence rumors are flagged with both, not laundered.
- Concrete operator action per item, or explicit "no action".
- No commentary. The user forms their own opinion from cited facts.

## Pairs with

- `aeon-token-pick` (regulatory catalysts as named catalysts).
- `aeon-monitor-polymarket` (markets whose legal wrapper *is* the asset).
- `aeon-deep-research` for deeper dives on a specific action.

## Required keys

None — public sources only.
