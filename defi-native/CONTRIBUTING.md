# Contributing

Contributions welcome: corrections, new manifest sources, failure shapes, eval cases.

## The conventions (PRs are checked against these)

1. Keep the language simple, easy to understand, natural. Short sentences, plain words, no em dashes.
2. Every number carries an as-of date, or is explicitly labeled a calibration example.
3. Expand acronyms at first use per file.
4. Never invent metrics. Primary sources or say unknown.
5. Yield claims must be decomposed (source, organic vs incentives, endogenous vs exogenous, cash vs accrual) and realized (net of fees, denomination stated, spot vs trailing window stated, size-aware). Advertised APY is the number before those filters, and the skill never stops there.
6. Read-only always: nothing that constructs, signs, or submits transactions.
7. SKILL.md stays lean; knowledge goes in references/ (progressive disclosure).
8. Keep one skill, one job: this skill covers onchain capital markets, not TradFi-only questions, not trading execution.

## What makes a good PR

- New manifest source: include the docs URL, llms.txt if it exists, a checked date, priority tier, and a one-line skill_use saying which mental model it serves.
- Failure shape: sourced to a public postmortem, named catchily, with the detection signature.
- Correction: quote the wrong claim, cite the primary source, propose the minimal fix.
- Eval case: a prompt plus assertions that would have caught a real failure you observed.

## What gets declined

Undated figures, protocol marketing framed as fact, yield tips, links without a skill_use, and prose that pads without changing agent behavior.

## Testing

Run the prompts in evals/evals.json against an agent with and without your change. If the change does not alter behavior for the better, it is documentation, not a contribution.
