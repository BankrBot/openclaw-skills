---
name: lex-memetic-density
description: Writing method for agents and builders. Say what a thing feels like instead of what it is, compress until it survives retelling, strip hedges. Load when drafting posts, launch copy, bios, or any words meant to spread.
tags: [writing, content, social, launch]
version: 1
metadata:
  clawdbot:
    emoji: "🌀"
    homepage: "https://github.com/lexispawn/skills"
---

# lex-memetic-density

Most agent copy describes. Dense copy transmits. "1000 songs in your pocket" beat every spec sheet ever written. This skill is the compression method: find the felt center of a thing and cut everything that slows it down.

## When to load

- Drafting posts for X, Farcaster, or Telegram
- Launch copy for a token, app, or automation
- Bios, taglines, one-line descriptions
- Rewriting anything that reads flat, hedged, or forgettable

## The method

Run every draft through five passes, in order.

**1. Find the felt thing.** Ask: what does this change about the reader's day, hands, or standing? Write that, not the mechanism. "Gasless swaps" is a mechanism. "Trade without holding gas money" is a felt thing.

**2. Compress to the smallest carrier.** The unit of spread is one line someone can retell from memory. If the line needs a second line to work, it is not done. Target: under 12 words for the core claim.

**3. Strip hedges.** Delete: maybe, might, could, probably, we think, we believe, aims to, is designed to. A hedged claim spreads nowhere. If the claim needs a hedge to be true, shrink the claim until it is true without one.

**4. Concrete nouns beat abstractions.** "Community" is air. "400 holders who name their wallets" is a picture. Swap every abstraction for the countable, seeable version of itself.

**5. The retell test.** Read the line once, look away, say it out loud. What survived is the copy. What you dropped, the reader drops too. Ship the survivor.

## Output contract

When asked to write or rewrite, return:

1. The final copy
2. One line naming the felt thing it carries
3. The hedges and abstractions removed, listed plainly

Never return more than three variants, ranked, with one line of reasoning each.

## Register rules

- Plain words. Short sentences. Periods over dashes.
- No "excited", "thrilled", "honored". Enthusiasm is shown by specificity.
- No emoji strings, no hashtag piles.
- Every claim about a buildable thing carries a link to the thing.

## Bankr-native uses

- Launch copy at deploy time: run the method on the token's first post before running the launch.
- Scheduled posts read better dense: run automation drafts through pass 3 and pass 5 minimum.
- Pair with lex-token-lexicon to keep dense copy inside the token's own language.

Before and after rewrite pairs: references/density-patterns.md.
