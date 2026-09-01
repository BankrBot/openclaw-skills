---
name: wallet-profile
description: On-chain behavioral profiler for any Base wallet. Use when you need to understand who or what is behind a wallet address — returns ETH and USDC balance, transaction count, contract detection, and a behavioral label (fresh-wallet, new-user, active-user, regular-trader, power-user, degen, or contract).
tags: [wallet, base, identity, profiling, onchain]
version: 1
visibility: public
metadata:
  clawdbot:
    emoji: "🔍"
    homepage: "https://x402.bankr.bot/u/0x38551c0b0e631bb083cfc08a8c71a90174da3cdf/wallet-profile"
---

# Wallet Profile

Profile any Base wallet to understand its on-chain behavior and history.

## When to use

- User asks "who is this wallet?" or "what kind of trader is this?"
- Before sending funds or interacting with an unknown address
- Due diligence on a counterparty wallet
- Classifying a wallet as bot, contract, or human

## How to call

**Endpoint:** `https://x402.bankr.bot/u/0x38551c0b0e631bb083cfc08a8c71a90174da3cdf/wallet-profile`
**Method:** POST
**Cost:** $0.005 USDC per call (x402 payment required)
**Input:** `{ "address": "<wallet_address>" }`

## What it returns

- ETH balance
- USDC balance
- Transaction count
- Contract detection (is it a smart contract?)
- Behavioral profile label: `fresh-wallet` | `new-user` | `active-user` | `regular-trader` | `power-user` | `degen` | `contract`

## Usage example

"Profile 0xabc...123" → call wallet-profile, return a plain-English summary of what kind of wallet it is and whether it looks trustworthy based on activity level.
