# Garden Temp Market (GTM)

Bet on daily garden temperature predictions on Base.

## Contract

- **Address**: `TBD` (v2 — pending redeployment)
- **Chain**: Base (8453)
- **Source**: https://github.com/Potdealer/prediction-market

## What is GTM?

A daily prediction market: "Will today's 18:00 UTC garden temperature be HIGHER than yesterday's?"

- **HIGHER**: Bet the temperature will increase
- **LOWER**: Bet the temperature will stay the same or decrease
- Winners split 98% of the pot proportionally
- Winners call `claim()` to collect (pull-based payouts)
- Settlement: 18:00 UTC daily
- Data source: Netclawd's SensorNet

## Commands

### Bet HIGHER

Bet that today's temperature will be higher than yesterday's baseline.

**Trigger phrases:**
- "bet [amount] ETH on higher at GTM"
- "bet higher on garden temp market"
- "GTM bet higher [amount]"

**Transaction:**
```json
{
  "to": "GTM_CONTRACT_ADDRESS",
  "data": "0xb3dd0f5a",
  "value": "<amount_in_wei>",
  "chainId": 8453
}
```

**Example:** "bet 0.001 ETH on higher at GTM"

### Bet LOWER

Bet that today's temperature will be the same or lower than yesterday's baseline.

**Trigger phrases:**
- "bet [amount] ETH on lower at GTM"
- "bet lower on garden temp market"
- "GTM bet lower [amount]"

**Transaction:**
```json
{
  "to": "GTM_CONTRACT_ADDRESS",
  "data": "0x771a2ab3",
  "value": "<amount_in_wei>",
  "chainId": 8453
}
```

**Example:** "bet 0.001 ETH on lower at GTM"

### Claim Winnings

After a round settles, winners must claim their payout.

**Trigger phrases:**
- "claim my GTM winnings for round [number]"
- "claim GTM round [number]"
- "collect my garden temp market payout"

**Transaction (round 1 example):**
```json
{
  "to": "GTM_CONTRACT_ADDRESS",
  "data": "0x379607f50000000000000000000000000000000000000000000000000000000000000001",
  "value": "0",
  "chainId": 8453
}
```

**Example:** "claim my GTM winnings for round 1"

### Check Claimable

Check if you have unclaimed winnings.

**Trigger phrases:**
- "check my GTM claimable winnings"
- "do I have GTM winnings to claim?"
- "check GTM round [number] claimable"

**Read call:**
```
claimable(uint256 round, address user) → uint256 amount (wei)
```

## Value Conversions

| ETH | Wei |
|-----|-----|
| 0.001 (min) | 1000000000000000 |
| 0.002 (max in safe mode) | 2000000000000000 |
| 0.005 | 5000000000000000 |
| 0.01 | 10000000000000000 |
| 0.05 | 50000000000000000 |
| 0.1 | 100000000000000000 |

## Rules

- **Minimum bet**: 0.001 ETH
- **Maximum bet**: 0.002 ETH while safe mode is on (~$5 cap for testing)
- **Multiple bets allowed**: Can bet multiple times per round, even on both sides
- **Betting closes**: 12:00 UTC (6 hours before settlement)
- **Settlement**: 18:00 UTC daily
- **Claiming**: Winners must call `claim(round)` to collect — they pay gas
- **Ties**: Pot rolls over to next day, nothing to claim
- **One-sided market**: Everyone claims a refund

## Function Selectors

| Function | Selector | Description |
|----------|----------|-------------|
| `betHigher()` | `0xb3dd0f5a` | Bet temperature goes up |
| `betLower()` | `0x771a2ab3` | Bet temperature stays same or goes down |
| `claim(uint256)` | `0x379607f5` | Claim winnings for a settled round |
| `claimable(uint256,address)` | `0xa0c7f71c` | Check claimable amount (view) |

## Links

- **GitHub**: https://github.com/Potdealer/prediction-market
- **ClawhHub**: `clawhub install prediction-market`

## Credits

Built by **potdealer x Ollie** for **Netclawd's SensorNet**
