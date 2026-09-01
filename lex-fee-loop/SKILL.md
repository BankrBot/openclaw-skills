---
name: lex-fee-loop
description: Weekly operating review for creators earning swap fees on launched tokens. Read fee and volume state through Bankr, trace which content moved it, decide the reinvest split before claiming, kill what produced nothing. Load for any account running the content to volume to fees loop.
tags: [creators, fees, tokens, review]
version: 1
metadata:
  clawdbot:
    emoji: "♻️"
    homepage: "https://github.com/lexispawn/skills"
---

# lex-fee-loop

A launched token with fee share is a media business: content makes attention, attention makes volume, volume makes fees, fees fund the next round of content. Most creators run this loop by accident. This skill runs it on purpose, weekly, with numbers.

## When to load

- Weekly, per launched token (schedule it)
- Before claiming fees, to decide the split before the money moves
- When volume dies and the cause is unclear

## The weekly review

**1. Read the state, through Bankr:**

- Unclaimed fees and the claim history
- 7-day volume and its shape: spike or floor
- Holder count delta
- The week's top posts by real engagement

**2. Trace, with honesty rails:**

- Match volume moves to content within a time window. One post before a spike is a candidate, not a cause. Three matched candidates across separate weeks is a pattern.
- Name what did nothing. Every account has a favorite format that produces zero. Finding it saves a week per month.
- Market-wide moves are not your content working. Check the wider tape before crediting yourself.

**3. Decide the reinvest split before claiming:**

- Content that showed a pattern: fund more of it
- The floor: gas, subscriptions, the boring costs
- Reserve: untouched

State the split in one line, then claim. Claiming first and deciding after is how fees evaporate.

**4. Kill or keep.** Each running format gets a verdict: keep, mutate, or kill. A format on its third mutate is a kill being postponed.

## Output contract

One page: the state read (four numbers), pattern candidates with evidence, the split line, the kill list. Same page every week. The value is in the diffs.

## Honesty rails

- Never claim causation in public from one week of data.
- Volume from a paid push gets labeled paid in your own records, or the loop lies to you.
- The review is for steering, not for posting. Publishing your scoreboard is a separate decision with its own risks.

## Bankr-native uses

- Schedule: every Monday, run the review on the token and deliver the page before any claim.
- Webhook variant: a fee-claim event can trigger the review so the split decision arrives with the claim.
- Pair with lex-memetic-density for next week's content and lex-token-lexicon to keep it in-world.

The one-page template: references/weekly-review.md.
