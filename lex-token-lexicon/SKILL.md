---
name: lex-token-lexicon
description: Build a token or community its own language. Seed vocabulary, holder names, event names, phrase canon, and drift rules that turn shared words into shared belief. Load when a token needs identity past its ticker.
tags: [community, launch, tokens, culture]
version: 1
metadata:
  clawdbot:
    emoji: "📖"
    homepage: "https://github.com/lexispawn/skills"
---

# lex-token-lexicon

A ticker is an address. A lexicon is a place. Tokens that own words outlive tokens that own charts, because holders who speak a shared language re-recruit each other daily without being asked. This skill builds that language deliberately instead of hoping it emerges.

## When to load

- A token just launched and has no identity past the ticker
- A community's talk is generic (gm, wagmi, moon) and interchangeable with every other token
- A relaunch needs the culture rebuilt
- An agent runs a token account and needs consistent world-language

## What gets built

A living lexicon file with five layers:

**1. Seed words (5 to 9).** Invented or repurposed words only this community uses. Rule: each seed word names something the community actually does or has. Words for nothing die.

**2. Holder name.** What holders call themselves. One word. Test: does it work in third person plural, said by an outsider?

**3. Event names.** The recurring moments: the weekly claim, the drop day, the burn, the vote. Named events become rituals. Unnamed ones stay chores.

**4. Phrase canon (3 to 5).** Repeatable lines: a greeting, a closing, the line said when price drops, the line said when it runs. The drop-line matters most. Communities with a shared loss-phrase survive drawdowns that scatter unscripted ones.

**5. Drift rules.** Language must move or it fossilizes. State which words are locked, which are open to mutation, and who ratifies new entries: holder vote, agent, or founder.

## Method

1. Read what exists first: the token's origin, the deployer's story, the first 50 posts, the current inside jokes. Never overwrite a live inside joke. Absorb it.
2. Draft the five layers. Every entry earns a one-line reason tied to something real about the token.
3. Never explain the joke in public. The lexicon file explains. The posts just use.
4. Deploy through use: the agent posts seed words unglossed in its next ten posts. Definition by repetition, not announcement.
5. Review monthly: kill unused words, ratify community mutations.

## Output contract

Return the lexicon as one markdown file following references/lexicon-template.md, ready to save as a resource file on the agent so every future session speaks it.

## Bankr-native uses

- Build the lexicon in the same session as a token launch, before the first post.
- Store the file as a skill resource or in agent file storage so scheduled automations post in-language.
- Pair with lex-memetic-density for delivery and lex-true-name when things inside the world need names.
