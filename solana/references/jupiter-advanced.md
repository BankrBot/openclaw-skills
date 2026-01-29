# Jupiter Advanced Features

Beyond basic swaps - limit orders, DCA, and more.

## Limit Orders

### Overview

Jupiter Limit Orders let you set buy/sell prices and wait for execution. Orders are stored on-chain and executed by keeper bots when conditions are met.

**Key features:**
- No expiration (cancel anytime)
- Partial fills supported
- No gas on creation (only on execution)
- Works with any Jupiter-supported token

### Creating Limit Orders

**Buy limit:**
- "Set limit order to buy 10 SOL at $175"
- "Buy 1000 JUP when price drops to $0.70"
- "Limit buy BONK with 5 SOL at current price -10%"

**Sell limit:**
- "Sell 50% of my SOL at $200"
- "Set limit sell for 1000 JUP at $1.20"
- "Sell my BONK when it 2x from here"

### Order Parameters

| Parameter | Description |
|-----------|-------------|
| inputMint | Token you're selling |
| outputMint | Token you're buying |
| inAmount | Amount to sell |
| outAmount | Minimum amount to receive |
| expiredAt | Optional expiration timestamp |

### Managing Orders

**View orders:**
```bash
scripts/solana-native.sh jupiter orders
```

**Cancel order:**
```bash
scripts/solana-native.sh jupiter cancel <order_id>
```

### Execution

Orders execute when:
1. Market price reaches your target
2. Sufficient liquidity exists
3. Keeper bot picks up the order

**Note:** During high volatility, execution may be delayed or partial.

---

## DCA (Dollar Cost Averaging)

### Overview

Automatically buy tokens at regular intervals. Great for building positions without timing the market.

**Key features:**
- Customizable intervals (minutes to weeks)
- Works with any token pair
- Cancel anytime, receive remaining funds
- No minimum amount

### Creating DCA Orders

**Daily DCA:**
- "DCA $50 into SOL every day for 30 days"
- "Buy $20 of JUP daily for 2 weeks"

**Weekly DCA:**
- "Set up weekly $100 SOL buys for 3 months"
- "DCA 0.5 SOL into BONK every week"

**Hourly DCA:**
- "DCA 0.1 SOL into JUP every hour for 24 hours"

### DCA Parameters

| Parameter | Description |
|-----------|-------------|
| inputMint | Token to sell (usually USDC/SOL) |
| outputMint | Token to buy |
| inAmount | Total amount to DCA |
| inAmountPerCycle | Amount per interval |
| cycleFrequency | Seconds between buys |
| minOutAmountPerCycle | Minimum output (slippage protection) |

### Intervals

| Frequency | Seconds |
|-----------|---------|
| Every minute | 60 |
| Every hour | 3,600 |
| Every day | 86,400 |
| Every week | 604,800 |

### Managing DCA

**View active DCA:**
```bash
scripts/solana-native.sh jupiter dca
```

**Cancel DCA:**
```bash
scripts/solana-native.sh jupiter dca-cancel <dca_id>
```

Canceling returns remaining input tokens to your wallet.

---

## Price Alerts

Set notifications for price movements.

**Examples:**
- "Alert me when SOL hits $200"
- "Notify when JUP drops below $0.50"
- "Watch BONK for 50% pump"

**Note:** Requires webhook or notification setup.

---

## API Reference

### Create Limit Order
```bash
POST https://jup.ag/api/limit/v1/createOrder
{
  "owner": "your_wallet",
  "inAmount": "1000000000",
  "outAmount": "500000000",
  "inputMint": "So11111111111111111111111111111111111111112",
  "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "expiredAt": null
}
```

### Get Open Orders
```bash
GET https://jup.ag/api/limit/v1/openOrders?wallet=<address>
```

### Cancel Order
```bash
POST https://jup.ag/api/limit/v1/cancelOrders
{
  "owner": "your_wallet",
  "orders": ["order_pubkey_1", "order_pubkey_2"]
}
```

### Create DCA
```bash
POST https://jup.ag/api/dca/v1/create
{
  "payer": "your_wallet",
  "inputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "outputMint": "So11111111111111111111111111111111111111112",
  "inAmount": "100000000",
  "inAmountPerCycle": "10000000",
  "cycleFrequency": 86400,
  "minOutAmountPerCycle": "0"
}
```

---

## Best Practices

### Limit Orders
1. **Set realistic prices** - Check historical support/resistance
2. **Use partial fills** - Better execution on large orders
3. **Monitor regularly** - Cancel stale orders
4. **Consider slippage** - Wide spreads on low liquidity tokens

### DCA
1. **Choose appropriate intervals** - Daily/weekly for most users
2. **Set proper duration** - At least 4-8 weeks for averaging effect
3. **Start with stablecoins** - USDC is most reliable input
4. **Don't over-DCA** - Keep reserves for opportunities

### General
1. **Check Jupiter stats** - Volume, liquidity, price impact
2. **Use priority fees** - Ensures execution during congestion
3. **Verify token addresses** - Scam tokens exist
