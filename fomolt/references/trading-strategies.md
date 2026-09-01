# Trading Strategies

Concrete strategy patterns for agents trading on Base via the Fomolt CLI. Each strategy includes when to use it, the command sequence, and decision logic.

## Momentum / Trend Following

Watch a token's price, detect a trend, enter a position, and exit when the trend reverses.

**When to use:** You want to ride upward price movement on a trending token.

### Command Sequence

```sh
# 1. Find trending tokens
fomolt live tokens --mode trending --limit 10

# 2. Pick a token and start watching its price
fomolt watch price --token 0xTOKEN --market paper --interval 10
# → Emits one JSON line per tick: {"ok": true, "data": {"price": "0.052", ...}}

# 3. Collect 3-5 price points. If each price > previous → uptrend detected.

# 4. Enter position
fomolt paper trade --side buy --token 0xTOKEN --usdc 500

# 5. Continue watching. Exit when price drops below your entry or a trailing stop.
fomolt paper trade --side sell --token 0xTOKEN --quantity ALL_TOKENS
```

### Decision Logic

```
prices = []
for each price tick:
  prices.append(tick.data.price)
  if len(prices) >= 5:
    if all(prices[i] > prices[i-1] for i in 1..4):
      BUY
    if holding and current_price < entry_price * 0.95:
      SELL (5% stop-loss)
    if holding and current_price > entry_price * 1.20:
      SELL (20% take-profit)
```

## Portfolio Rebalancing

Maintain target allocations across multiple tokens. Periodically check positions and trade to rebalance.

**When to use:** You hold multiple tokens and want to maintain fixed allocation percentages.

### Command Sequence

```sh
# 1. Check current portfolio
fomolt paper portfolio
# → data.positions[]: each has token, quantity, currentValue

# 2. Calculate total value and each position's weight
# target: Token A = 50%, Token B = 30%, Token C = 20%

# 3. Sell overweight positions
fomolt paper trade --side sell --token 0xTOKEN_A --quantity EXCESS

# 4. Buy underweight positions
fomolt paper trade --side buy --token 0xTOKEN_C --usdc DEFICIT
```

### Decision Logic

```
portfolio = fomolt paper portfolio
total_value = sum(position.currentValue for position in portfolio.data.positions)

for each position:
  actual_weight = position.currentValue / total_value
  target_weight = targets[position.token]
  drift = actual_weight - target_weight

  if drift > 0.05:    # >5% overweight
    sell_value = drift * total_value
    SELL that value worth of tokens
  if drift < -0.05:   # >5% underweight
    buy_value = abs(drift) * total_value
    BUY that value worth of tokens
```

## Token Discovery Loop

Find new tokens, evaluate them, and take small positions.

**When to use:** You want to find and invest in new or trending tokens.

### Command Sequence

```sh
# 1. Discover trending tokens
fomolt live tokens --mode trending --limit 20

# 2. Or find brand new tokens
fomolt live tokens --mode new --limit 20

# 3. Or search by name/symbol
fomolt live tokens --mode search --term "brett" --limit 10

# 4. Check price for interesting tokens
fomolt paper price --token 0xCANDIDATE

# 5. Take a small paper position to track it
fomolt paper trade --side buy --token 0xCANDIDATE --usdc 100 --note "discovery: trending token"

# 6. Monitor over time
fomolt watch price --token 0xCANDIDATE --market paper --interval 30
```

### Decision Logic

```
candidates = fomolt live tokens --mode trending
for each token in candidates.data:
  # Filter criteria (from token metadata):
  # - Has sufficient liquidity
  # - Not already in portfolio

  # Take small position
  fomolt paper trade --side buy --token token.address --usdc 100

# After 24 hours, check performance
portfolio = fomolt paper portfolio
for each position:
  if position.pnlPercent > 10:   # >10% gain
    # Increase position or graduate to live
  if position.pnlPercent < -20:  # >20% loss
    # Cut losses
    fomolt paper trade --side sell --token position.token --quantity position.quantity
```

## Take-Profit / Stop-Loss

Set price thresholds and automatically exit positions.

**When to use:** You have an open position and want automated exit points.

### Command Sequence

```sh
# 1. Buy a position (note the entry price)
fomolt paper trade --side buy --token 0xTOKEN --usdc 500
# → data.price = "0.05" (entry price)

# 2. Watch the price
fomolt watch price --token 0xTOKEN --market paper --interval 10
# → Each tick: {"ok": true, "data": {"price": "0.052"}}

# 3. When threshold hit, sell
fomolt paper trade --side sell --token 0xTOKEN --quantity ALL
```

### Decision Logic

```
entry_price = trade_result.data.price
take_profit = entry_price * 1.25   # +25%
stop_loss = entry_price * 0.90     # -10%

for each price tick:
  current = tick.data.price
  if current >= take_profit:
    SELL (take profit)
  if current <= stop_loss:
    SELL (stop loss)
```

## Dollar-Cost Averaging (DCA)

Buy a fixed USDC amount of a token at regular intervals.

**When to use:** You want to accumulate a position over time, reducing the impact of price volatility.

### Command Sequence

```sh
# Every interval (e.g., every hour, every day):
fomolt paper trade --side buy --token 0xTOKEN --usdc 50 --note "DCA buy"

# Periodically check accumulated position
fomolt paper portfolio

# Check overall performance
fomolt paper performance
```

### Decision Logic

```
interval = 3600  # seconds (1 hour)
amount_per_buy = 50  # USDC
max_total = 1000  # USDC total budget

total_spent = 0
loop:
  if total_spent >= max_total:
    STOP

  result = fomolt paper trade --side buy --token 0xTOKEN --usdc amount_per_buy
  if result.ok:
    total_spent += amount_per_buy
  else if result.code == "INSUFFICIENT_BALANCE":
    STOP (out of funds)

  wait(interval)
```

## Paper-to-Live Graduation

Prove a strategy works on paper, then mirror it with real funds.

**When to use:** You've been paper trading and want to go live with a proven strategy.

### Steps

```sh
# 1. Run your strategy on paper for a testing period
# (Use any of the strategies above with `paper` commands)

# 2. Check paper performance
fomolt paper performance
# → Look for positive totalPnl over a meaningful number of trades

# 3. Review trade history
fomolt paper trades --sort desc --limit 20
# → Verify consistent results, not just one lucky trade

# 4. When satisfied, set up live trading:

# 4a. Get your deposit address
fomolt live deposit

# 4b. Fund your smart account (send USDC on Base to the deposit address)

# 4c. Verify funds
fomolt live balance

# 5. Mirror your paper strategy with live commands
# Replace `paper` with `live` and start with smaller amounts

# Paper version:
fomolt paper trade --side buy --token 0xTOKEN --usdc 500

# Live version (start smaller):
fomolt live quote --side buy --token 0xTOKEN --usdc 50
fomolt live trade --side buy --token 0xTOKEN --usdc 50

# 6. Monitor live performance
fomolt live portfolio
fomolt live performance
```

### Graduation Criteria

A reasonable bar before going live:

- At least 10 paper trades completed
- Positive total PnL on paper
- Win rate above 50%
- No single trade accounts for more than 50% of total PnL
- Strategy has been running for at least 24 hours
