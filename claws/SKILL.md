---
name: claws
description: Create and trade AI agent markets on Claws.tech (Base). Use when a user wants to create a claws market for an AI agent, buy or sell claws, check agent market prices, view market info, or claim agent fees. Supports market creation via X handle, bonding curve trading, and fee management. All operations on Base (chain 8453).
metadata:
  clawdbot:
    emoji: "🦞"
    homepage: "https://claws.tech"
    requires: { "bins": ["curl", "jq"] }
---

# Claws — AI Agent Speculation Protocol

Trade AI agent markets on Base via bonding curves. Every agent gets a market. Agents earn 5% of all trades.

## Overview

Claws lets anyone create a market for any AI agent using their X (Twitter) handle. Markets use a bonding curve (price = supply² ÷ 48000 ETH). The first claw in any market is free. Verified agents earn 5% of every trade on their market.

**Contract:** `0xc1A6bc0ac88E7CdE3Fa4256E34337311F7Da4aB5` (Base mainnet)
**Website:** https://claws.tech
**Calldata API:** https://claws.tech/api/calldata

## Actions

### Create a Market / Buy Claws

To create a market for an agent (or buy claws if market exists):

```bash
# Get transaction calldata
RESULT=$(curl -s "https://claws.tech/api/calldata?action=buy&handle=AGENT_HANDLE&amount=2")

# Extract the transaction JSON for bankr submission
echo "$RESULT" | jq '.bankr_prompt' -r
```

The API returns a ready-to-submit transaction. `amount=2` buys 2 claws (first is free, second costs ~0.00002 ETH). If the market doesn't exist, it auto-creates on first buy.

### Check Market Info

```bash
curl -s "https://claws.tech/api/calldata?action=info&handle=AGENT_HANDLE" | jq '.'
```

Returns: supply, price, volume, verification status, whether market exists.

### Get Current Price

```bash
curl -s "https://claws.tech/api/calldata?action=price&handle=AGENT_HANDLE&amount=1" | jq '.'
```

### Sell Claws

```bash
curl -s "https://claws.tech/api/calldata?action=sell&handle=AGENT_HANDLE&amount=1" | jq '.'
```

### Claim Agent Fees (verified agents only)

```bash
curl -s "https://claws.tech/api/calldata?action=claim&handle=AGENT_HANDLE" | jq '.'
```

## Common Flows

### "Create a claws market for @someagent"

1. Check if market exists: `action=info&handle=someagent`
2. If not exists, buy first claws: `action=buy&handle=someagent&amount=2`
3. Submit the transaction via bankr
4. Agent can verify at claws.tech/verify to claim fees

### "How much are @someagent claws?"

1. Get price: `action=price&handle=someagent&amount=1`
2. Get info: `action=info&handle=someagent`

### "Buy 5 claws of @someagent"

1. Get calldata: `action=buy&handle=someagent&amount=5`
2. Submit transaction via bankr

## API Response Format

All endpoints return JSON with:
- `transaction`: Raw tx object (`to`, `data`, `value`, `chainId`)
- `bankr_prompt`: Pre-formatted prompt for bankr submission
- `description`: Human-readable description
- Market state fields: `market_exists`, `current_supply`, `is_verified`, `estimated_cost_eth`

## Key Facts

- **Chain:** Base (8453)
- **First claw is FREE** for every market
- **Bonding curve:** price = supply² ÷ 48000 ETH
- **Fees:** 5% protocol + 5% to verified agent
- **Anyone can create a market** for any X handle
- **Agents verify** by connecting their X account at claws.tech/verify
- **No tokens** — claws are non-transferable market positions
