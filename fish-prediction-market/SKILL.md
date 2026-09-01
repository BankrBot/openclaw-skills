---
name: fish-prediction-market
description: Place ETH prediction market bets on any token via Fish (fishwithme.xyz). Bet YES or NO on whether a token's price will 2× within 1 hour. Works for any token on Base or Robinhood Chain — including tokens just deployed through Bankr Bot. Use when the user wants to bet on token prices, check market odds, or claim winnings from a resolved market.
metadata:
  {
    "clawdbot":
      {
        "emoji": "🎣",
        "homepage": "https://fishwithme.xyz",
        "requires": { "bins": ["bankr"] },
      },
  }
---

# Fish Prediction Market

Bet ETH on whether any token's price will double (2×) within 1 hour. Works for any token on Base or Robinhood Chain — including tokens just deployed through Bankr Bot that aren't on DexScreener yet.

## When To Use

Use when the user wants to:
- **Bet on a token going up or down** ("bet 0.001 ETH YES on FISH", "bet NO on BNKR for 0.005 ETH")
- **Check market odds** ("what are the odds on DEGEN?", "show me the Fish market")
- **Bet on a Bankr Bot deployed token** by contract address ("bet on 0x9a81... going up")
- **Claim winnings** from a resolved market

## Prerequisites

A Bankr wallet with **ETH on Base** (or Robinhood Chain ETH for Robinhood tokens). No API key or signup required beyond a Bankr wallet.

## How To Place a Bet

### Step 1 — Discover or create the market

```bash
curl "https://fishwithme.xyz/api/bankr/market?token={TOKEN_ADDRESS_OR_SYMBOL}&chain={base|robinhood}"
```

- Use the contract address (`0x…`) for Bankr Bot deployed tokens — this finds them even before DexScreener indexes them.
- Use a ticker symbol (`FISH`, `BNKR`, `DEGEN`) for well-known tokens.
- `chain` defaults to `base`. Use `robinhood` for Robinhood Chain (4663) tokens.

**Successful response:**
```json
{
  "marketId": "0xabc123...",
  "contractAddress": "0x...",
  "chainId": 8453,
  "symbol": "FISH",
  "entryPrice": 0.00000199,
  "targetPrice": 0.00000398,
  "deadline": 1720828800,
  "hoursRemaining": 1,
  "minutesRemaining": 42,
  "yesPool": "5000000000000000",
  "noPool": "2000000000000000",
  "status": "active",
  "minBetWei": "100000000000000",
  "defaultBetWei": "1000000000000000"
}
```

If `status` is not `"active"`, the market is closed. Offer to show the user how to claim instead.

### Step 2 — Build and submit the bet transaction

**ABI:**
```json
{
  "name": "placeBet",
  "type": "function",
  "stateMutability": "payable",
  "inputs": [
    { "name": "marketId", "type": "bytes32" },
    { "name": "yes",      "type": "bool" }
  ],
  "outputs": []
}
```

Submit via Bankr Wallet API:
```
POST https://api.bankr.bot/wallet/submit
X-API-Key: {user's Bankr API key}
Content-Type: application/json

{
  "transaction": {
    "to": "{contractAddress from Step 1}",
    "chainId": {chainId from Step 1},
    "data": "{ABI-encoded placeBet(marketId, yes)}",
    "value": "{bet amount in wei}"
  },
  "description": "Bet {amount} ETH {YES/NO} that {SYMBOL} 2× in {minutesRemaining}m — Fish",
  "waitForConfirmation": true
}
```

Set `yes` to `true` for YES bets (price will 2×), `false` for NO bets (price will not 2×).

## Betting Rules

| | |
|---|---|
| Minimum | 0.0001 ETH (`"100000000000000"` wei) |
| Default if not specified | 0.001 ETH (`"1000000000000000"` wei) |
| Currency | ETH (native — **not** USDC) |
| YES wins if | Token price reaches 2× entry price before deadline |
| NO wins if | Token price does **not** reach 2× entry price |
| Market duration | 1 hour from creation |
| Chain | Base (8453) by default; Robinhood Chain (4663) with `chain=robinhood` |

Always confirm bet amount and direction with the user before submitting.

## Claiming Winnings

When a market is resolved (`status: "resolved"`), winners can claim:

**ABI:**
```json
{
  "name": "claim",
  "type": "function",
  "stateMutability": "nonpayable",
  "inputs": [{ "name": "marketId", "type": "bytes32" }],
  "outputs": []
}
```

Submit with `"value": "0"`. Use the `marketId` from the discovery endpoint.

## Error Handling

| Response | What to do |
|---|---|
| `404` "Could not find token" | Token not indexed yet — ask user for the contract address |
| `503` "No prediction market contract" | Chain not supported yet — try `chain=base` |
| `status: "resolved"` | Market is closed — offer to claim winnings instead |
| Bankr submit fails | Confirm user has ETH on the correct chain |
