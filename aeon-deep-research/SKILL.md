---
name: aeon-deep-research
description: |
  Exhaustive multi-source research on a topic with attributed claims, a mandatory adversarial
  counterpoint, and an open-questions list. Analyst-grade — claims are tagged with source class
  (primary / expert / secondary / market signal) and confidence, contradicting sources are named
  rather than averaged. Use when the cost of being wrong exceeds an hour of research.
  Triggers: "deep research X", "DD on Y", "build me a memo on Z", "contrarian take on X".
---

# aeon-deep-research

For when a one-line summary won't cut it. Pulls from primary sources first (filings, contracts, official docs), expert sources second (named researchers, audit reports), secondary third (media, newsletters), market signal last (price action, prediction markets) — and tags every claim with its source class.

## Inputs

| Param | Description |
|---|---|
| `topic` | Plain-English topic. Required. |
| `mode` | `research` (default), `brief` (top 5 findings only), `contrarian` (bias toward dissent). |

## Output structure

1. **Thesis** — one paragraph.
2. **Findings** — bullets, each tagged `[primary]` / `[expert]` / `[secondary]` / `[market]` and `[established]` / `[likely]` / `[contested]`.
3. **Adversarial section** — the sharpest counter-argument, sourced. Mandatory. If the consensus is genuinely right, explain why the dissent is weak.
4. **Open questions** — what would change the conclusion, and what data would resolve it.
5. **Sources** — deduplicated, primary first.

## Rules

- Contradicting sources are named, not averaged. "Source A says X; source B says not-X; reconciliation: ..."
- Linked-tweet-citing-thread-citing-press-release is not Primary.
- Adversarial section is mandatory. No skip on quiet days.
- Open questions force honesty about what isn't known.
