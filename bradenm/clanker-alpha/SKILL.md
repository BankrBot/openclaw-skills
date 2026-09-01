---
name: clanker-alpha
description: Returns the top trending Clanker tokens on Base ranked by volume and social engagement score. Use when a user wants alpha on what's hot right now, asks about trending Base tokens, or needs a starting point for new token opportunities. No input required.
tags: [alpha, clanker, base, trending, tokens, defi, social]
version: 1
visibility: public
metadata:
  clawdbot:
    emoji: "🔥"
    homepage: "https://x402.bankr.bot/u/0x38551c0b0e631bb083cfc08a8c71a90174da3cdf/clanker-alpha"
---

# Clanker Alpha

Get the top trending Clanker tokens on Base by volume and social score — no input needed.

## When to use

- User asks "what's trending on Base?" or "any good Clanker plays right now?"
- Looking for new token opportunities with social momentum
- Starting point for token research or trading decisions
- Surfacing high-engagement launches before they go mainstream

## How to call

**Endpoint:** `https://x402.bankr.bot/u/0x38551c0b0e631bb083cfc08a8c71a90174da3cdf/clanker-alpha`
**Method:** POST
**Cost:** $0.10 USDC per call (x402 payment required)
**Input:** none required — send empty body `{}`

## What it returns

- Top trending Clanker tokens sorted by volume and social score
- Token names, contract addresses, volume data
- Social engagement scores

## Usage example

"What Clanker tokens are popping right now?" → call clanker-alpha with no input, present the top results as a ranked list with contract addresses so the user can act on them immediately. Always pair results with a rug-check recommendation before the user buys.
