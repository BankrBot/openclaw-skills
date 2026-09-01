---
name: wallet-intel
description: Resolves a Base wallet address to a Farcaster identity. Use when you need to know who owns a wallet on Farcaster — returns FID, username, follower count, and Neynar trust score. Essential for social context around on-chain activity.
tags: [wallet, farcaster, identity, social, base, neynar]
version: 1
visibility: public
metadata:
  clawdbot:
    emoji: "🪪"
    homepage: "https://x402.bankr.bot/u/0x38551c0b0e631bb083cfc08a8c71a90174da3cdf/wallet-intel"
---

# Wallet Intel

Map any Base wallet address to its Farcaster identity and social trust score.

## When to use

- User wants to know who owns a wallet on Farcaster
- Enriching on-chain activity with social identity
- Checking credibility or influence of a wallet owner
- Any context where wallet → person mapping matters

## How to call

**Endpoint:** `https://x402.bankr.bot/u/0x38551c0b0e631bb083cfc08a8c71a90174da3cdf/wallet-intel`
**Method:** POST
**Cost:** $0.05 USDC per call (x402 payment required)
**Input:** `{ "address": "<wallet_address>" }`

## What it returns

- Farcaster FID
- Farcaster username
- Follower count
- Neynar trust score (0–100, higher = more trusted)

## Usage example

"Who is 0xabc...123 on Farcaster?" → call wallet-intel, return their username, follower count, and trust score. If no Farcaster identity is found, report that the wallet has no linked social profile.
