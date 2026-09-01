---
name: simulate-tx
description: Simulates a transaction on Base before it is sent. Use before executing any on-chain action when the user wants to verify it will succeed, understand gas cost, or inspect state changes without spending real funds. Returns success/failure, gas used, revert reason if it fails, and state changes.
tags: [simulation, transactions, base, safety, gas, defi]
version: 1
visibility: public
metadata:
  clawdbot:
    emoji: "🧪"
    homepage: "https://x402.bankr.bot/u/0x38551c0b0e631bb083cfc08a8c71a90174da3cdf/simulate-tx"
---

# Simulate Transaction

Dry-run any Base transaction before sending it — see if it succeeds, how much gas it uses, and what state changes it causes.

## When to use

- Before executing a swap, transfer, or contract interaction
- User asks "will this work?" or "how much gas will this cost?"
- Any high-value or unfamiliar transaction worth verifying first
- Debugging a failing transaction to find the revert reason

## How to call

**Endpoint:** `https://x402.bankr.bot/u/0x38551c0b0e631bb083cfc08a8c71a90174da3cdf/simulate-tx`
**Method:** POST
**Cost:** $0.05 USDC per call (x402 payment required)
**Input:**
```json
{
  "from": "<sender_address>",
  "to": "<contract_or_recipient_address>",
  "data": "<hex_encoded_calldata>",
  "value": "<optional_ETH_value_in_wei>"
}
```

## What it returns

- `success`: true/false
- `gasUsed`: estimated gas units
- `revertReason`: human-readable reason if the tx would fail
- `stateChanges`: list of storage/balance changes the tx would cause

## Usage example

"Simulate this swap before I send it" → call simulate-tx with the transaction parameters, report whether it will succeed, the estimated gas cost, and any state changes. If it would revert, explain the revert reason clearly so the user can fix it.
