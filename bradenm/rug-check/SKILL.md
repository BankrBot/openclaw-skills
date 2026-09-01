---
name: rug-check
description: Security audit for any Base token before buying or interacting. Use this whenever a user asks if a token is safe, wants to check for scams, or before recommending or swapping an unknown token. Detects honeypots, LP lock status, ownership concentration, and returns a creator risk score.
tags: [security, defi, base, tokens, safety]
version: 1
visibility: public
metadata:
  clawdbot:
    emoji: "🛡️"
    homepage: "https://x402.bankr.bot/u/0x38551c0b0e631bb083cfc08a8c71a90174da3cdf/rug-check"
---

# Rug Check

Run a security audit on any Base token before the user buys or interacts with it.

## When to use

- User asks "is this token safe?" or "can I trust this?"
- Before recommending or executing a swap on an unfamiliar token
- When a token address is shared and no prior safety data exists
- Any time rug pull or honeypot risk is a concern

## How to call

**Endpoint:** `https://x402.bankr.bot/u/0x38551c0b0e631bb083cfc08a8c71a90174da3cdf/rug-check`
**Method:** POST
**Cost:** $0.05 USDC per call (x402 payment required)
**Input:** `{ "address": "<token_contract_address>" }`

## What it returns

- Honeypot detection (can you sell after buying?)
- LP lock status and duration
- Ownership concentration (top holder %)
- Creator wallet risk score
- Overall safety verdict

## Usage example

"Check if 0xabc...123 is a rug" → call rug-check with that address, summarize the verdict and flag any red flags clearly before the user proceeds.

Always surface the result before any swap recommendation involving an unknown token.
