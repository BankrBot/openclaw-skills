---
name: jb-reserved-rate-offchain-revenue
description: |
  Reserved percent configuration for off-chain vs on-chain revenue sharing. Use when:
  (1) a user wants to share off-chain revenue (merchandise, services, sales) and the
  configuration sets reservedPercent from a "what percentage will you share" answer,
  (2) reservedPercent is set to mirror a revenue-sharing commitment (wrong), (3) building
  ownership/revenue-sharing projects. Key rule: for off-chain revenue, reserved percent
  should be 0 — the owner controls what enters the project. Reserved percent only matters
  for revenue that flows to the project automatically.
version: 6.0.0
---

# Reserved Percent for Off-Chain vs On-Chain Revenue

## Problem

Two unrelated concepts get conflated when configuring revenue-sharing projects:

- **Revenue-sharing commitment** — a social/business promise to share X% of earnings
- **Reserved percent** (`JBRulesetMetadata.reservedPercent`, out of `JBConstants.MAX_RESERVED_PERCENT = 10_000`) — the share of tokens minted on each payment that routes to the reserved-token splits instead of the payer

Setting `reservedPercent` from the answer to "what percentage of revenue will you share?" is wrong.

## Rule

**Off-chain revenue** (merchandise, services, consulting, sales):
- The owner controls what money enters the project; they add the shared portion via `JBMultiTerminal.addToBalanceOf` (or `pay` if they want tokens minted) and keep the rest off-chain.
- `reservedPercent: 0` is correct — the owner doesn't need reserved tokens to get their share; they simply never deposit it.
- The "20% revenue share" is fulfilled by what the owner deposits, not by token distribution. The contract does not enforce it.

**On-chain revenue** (royalties, protocol fees, automatic payment flows):
- Revenue reaches the treasury automatically — the owner cannot intercept it.
- Reserved tokens give the owner their share: they cash out like everyone else.
- `reservedPercent` = the owner's share of the automatic flow. Owner should get 70% → `reservedPercent: 7000`, with the owner as a reserved-token split recipient (`JBSplitGroupIds.RESERVED_TOKENS` group).

For revnets, the equivalent lever is the stage's `splitPercent` (out of 10,000) with the operator as split recipient — same logic applies.

## Verification

For an off-chain revenue-sharing project:
- `reservedPercent: 0` (or very low)
- The explanation says the owner deposits revenue when earned
- Nothing implies the contract enforces the sharing percentage

## Example

```
User: "I'll share 20% of my e-bike sales with supporters"

Wrong:   reservedPercent: 2000   // conflates commitment with token distribution
Correct: reservedPercent: 0
         Explain: "When you sell e-bikes, add the revenue you want to share to your
         project (addToBalanceOf). Supporters claim their portion by cashing out.
         You control what goes in."
```

## Common mistakes

- Asking "what percentage will you share?" and writing the answer into `reservedPercent`.
- Implying the contract automatically sends X% of off-chain sales to supporters — it cannot see off-chain revenue.
- Setting a non-zero `reservedPercent` without configuring reserved-token splits — undistributed reserved tokens accumulate to the project owner.
