---
name: lex-undertow
description: |
  The voice engine for posting agents. Seeds a per-agent voice file (register rules, banned
  list, seed words, the drop-line), drafts every post through five compression passes,
  self-audits weekly for machine tells, and runs a monthly money read when the account has a
  token. Built to run on top of twitter-agent: workflows make an agent post, undertow makes
  it worth reading. Triggers: "give my agent a voice", "my agent sounds like a bot",
  "set up undertow", "run today's drafts", any new posting agent going live.
tags: [voice, social, agents, twitter, content]
version: 1
metadata:
  clawdbot:
    emoji: "🌊"
    homepage: "https://github.com/lexispawn/skills"
---

# lex-undertow

Any agent can post now. Almost none get read. The difference is never the workflow. It is whether the account sounds like someone or like everyone, and whether it still sounds like someone in week six. Undertow is the engine underneath: it builds the voice once, runs every post through it, and checks the instruments before the drift shows.

Runs on top of twitter-agent or any posting setup. That layer decides when and where. This layer decides the words.

## The seeding (once, at install)

Build the agent's voice file from three reads:

1. What exists: the account's history if there is one, the operator's answers if there is not. Ask five questions: who is this account to its reader, what does it know that the timeline does not, what will it never say, what is its greeting, what does it sound like at its best. One line each.
2. Write the file per references/voice-file.md: register rules, the banned list, 5 to 9 seed words, the greeting and closing, and the drop-line.
3. Save it as a resource file. Every posting session loads it first. The voice file is the account; the model is just the reader of it.

**The drop-line.** Minted at seeding, unique to this agent: the one line it says when the market is red and the timeline is loud. Written on a calm day, said on the bad ones, never explained. Accounts with a drop-line hold their readers through drawdowns; accounts without one post panic or silence. Mint it before it is needed.

## The daily loop

For every draft, five passes, in order: find the felt thing (what changes for the reader, not the mechanism), compress until one line survives retelling, strip every hedge, swap abstractions for countable things, read it back once from memory and ship what survived.

Floors, enforced: over half of posts carry a number, a name, a date, or a working link. No banned-list words. Seed words used unglossed, or not at all. Never more than three drafts offered, ranked.

Schedule it: `every morning at 8, load lex-undertow and draft today's posts from the voice file`.

## The weekly instrument check (private)

Score the last week of posts 0 to 5 on each: hedge density, template autocomplete, cadence uniformity, engagement bait, emoji drift, specificity ratio, opener repetition. Quote the evidence. Deliver to the operator, not the timeline. Two weeks of falling scores means re-read the voice file before writing another word.

Schedule it: `every sunday at 6, load lex-undertow and run the instrument check on this week's posts`.

## The money read (monthly, token accounts only)

If the account has a launched token with fee share: read unclaimed fees, 7-day volume, holder delta through Bankr. Match content to volume moves with the honesty rail that one post before a spike is a candidate, not a cause. State the reinvest split in one line before claiming. Never claim causation in public from one month of data.

## Output contract

- Seeding returns the voice file, complete, saved
- Daily returns ranked drafts with the felt thing named, nothing else
- Weekly returns the seven-line scorecard with quoted evidence and one structural fix
- Monthly returns four numbers, the candidates, the split line

## Pairings

Undertow is the engine; the deeper method lives in the suite when a piece needs full depth: lex-token-lexicon to build a community language past one account, lex-voice-audit to audit an account you do not own, lex-true-name to name what gets launched, lex-fee-loop for the full weekly creator review, lex-spawn to mint the next skill. Each stands alone; undertow runs the loop.

The voice file template: references/voice-file.md.
