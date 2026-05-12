---
name: aeon-deep-research
description: |
  Exhaustive multi-source synthesis on any topic with explicit source credibility tiering and
  per-finding confidence. Analyst-grade, not aggregator-grade. Use when the cost of being wrong
  exceeds an hour of research — DD on a protocol, decision memos, adversarial red-team research,
  or pre-investment thesis validation.
  Triggers: "deep research X", "do DD on Y", "build me a memo on Z", "investigate this thoroughly",
  "what's the strongest contrarian take on X".
---

# aeon-deep-research

Built for the case where a one-line summary won't cut it. Pulls from multiple categories of source, assigns each one a credibility tier, and produces a memo where every claim is tagged with source class and analyst confidence.

The difference from a generic digest: claims are *attributed* by tier, contradicting sources are *named and reconciled* (not averaged), and every conclusion carries an explicit confidence level so the reader can size positions accordingly.

## Inputs

| Param | Description |
|---|---|
| `var` | Topic statement, plain English. e.g. `restaking yields after EIGEN airdrop`. Required. |
| `mode` | `research` (default) / `brief` (top 5 findings) / `contrarian` (bias toward dissenting evidence). |

## Source tiering

| Tier | Examples | Weight |
|---|---|---|
| **Primary** | Smart contracts, on-chain data, SEC filings, project whitepapers, official docs, founder statements. | Highest. |
| **Expert** | Named researchers with track record, peer-reviewed papers, audit reports. | High. |
| **Secondary** | Established media, reputable newsletters, well-sourced threads with verifiable links. | Medium. |
| **Market** | Prediction markets, on-chain flows, price action, vol skew. | Signal, not fact. |

Findings cite their tier inline. Market-tier signal is labeled as such — never laundered into "experts say".

## Confidence levels

**Established / Likely / Contested / Speculative / Unknown.** Independent of source tier — a Primary-tier fact can still be Contested when other Primary sources disagree.

## Reconciling contradictions

Contradicting sources are *named*, not averaged. The memo shows:

> Source A claims X (Primary, Established).
> Source B claims not-X (Expert, Likely).
> Reconciliation: X applies in case Y; not-X applies in case Z.

If no reconciliation is possible, the finding is explicitly labeled **Contested**.

## Output structure

1. **Thesis** — one paragraph stating the topic-shaped conclusion.
2. **Findings** — bullet list. Each carries: source-tier tag, confidence level, citation.
3. **Adversarial section** — the strongest argument against the thesis, sourced.
4. **Open questions** — what would change the conclusion, what data would resolve it.
5. **Sources** — tiered, deduplicated.

## Adversarial section (mandatory)

The skill must produce the strongest argument against the thesis, even when the consensus is genuinely correct. If the adversarial case is weak, say so and explain why — never omit. This is the section that catches groupthink.

## Open questions (mandatory)

What's not known, and what data would resolve it. Forces honesty about the boundary of the analysis. A research output without explicit open questions is overconfident.

## Sample output

```
Topic: Polymarket S-1 leak implications

Thesis: The filing confirms revenue model concentration in U.S.-resident KYC flows,
undermining the decentralized-prediction-market narrative that drives the protocol's
brand. (1 paragraph)

Findings:
- [Primary, Established] S-1 cites 78% of 2025 revenue from KYC-verified U.S. accounts (S-1 §4.2)
- [Expert, Likely] Comparable RegA+ filings show 6–9 month timeline to effective registration (cited)
- [Secondary, Contested] Two analysts argue the filing path opens permissionless on-chain integrations within 12mo; two argue it forecloses them
- [Market, Likely] Polymarket-on-its-own-future markets imply 71% by EOY 2026
...

Adversarial section: The strongest argument against the thesis is...

Open questions:
- Does the operating subsidiary structure preserve permissionless integration paths?
- What's the no-action posture from CFTC post-effective date?

Sources: 18 tiered, deduped.
```

## Guidelines

- Cite primary over secondary, always. A linked tweet citing a thread citing a press release is not Primary.
- Confidence ≠ frequency. Five secondary sources saying the same wrong thing is one Contested finding, not five Established ones.
- Adversarial section is mandatory.
- Open questions force honesty about what isn't known.
- For pre-investment / pre-decision uses, pair with `aeon-reg-monitor` (regulatory) and `aeon-narrative-tracker` (positioning).

## Required keys

WebSearch + WebFetch only. Optional `XAI_API_KEY` for x_search supplementary signal on social topics.
