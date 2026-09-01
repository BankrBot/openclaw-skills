# Zonein Trading Strategy Reference

## Signal Scoring Formula

### Prediction Market Signals

Signals are scored 0-100 based on weighted components:

| Component | Weight | Description |
|-----------|--------|-------------|
| Consensus Ratio | 25% | % of wallets agreeing on direction (YES/NO) |
| User Count | 30% | Number of smart wallets holding the market |
| Leaderboard Rank | 20% | Best rank among holders (lower = better) |
| Price Deviation | 10% | Penalty if entry price deviates from current |
| Reward Ratio | 15% | Potential payout relative to cost |

**Threshold:** Signals with score >= 60 are considered actionable.

### Perp Signals

Perp signals are consensus-based:
- **Consensus** = dominant_side_count / total_count
- Higher consensus + more wallets = stronger signal
- Best trader score adds credibility
- Long/Short value ratio shows conviction

## Risk Management Rules

### Position Sizing
- **Max per trade:** 5% of portfolio
- **Max total exposure:** 50% of portfolio
- **Max per category:** 20% of portfolio

### Safety Rails
- **Min edge:** 3-5% (signal price vs market price)
- **Daily loss limit:** 10% of portfolio
- **Cooldown:** 24h per market after analysis without trade
- **Kill switch:** Disable agent immediately if daily loss exceeded

### Agent Types

#### Prediction Market Agent
- Follows smart bettor consensus on Polymarket
- Trades YES/NO shares based on signal strength
- Domain filter: categories like POLITICS, CRYPTO, SPORTS
- Uses LLM to validate signal direction before execution

#### Perp Trading Agent
- Follows HyperLiquid whale positions
- Opens LONG/SHORT based on smart money consensus
- Coin filter: specific tokens (BTC, ETH, SOL, etc.)
- Leverage and stop-loss management

## Trading Flow

```
1. Signal Detection
   └─ Smart wallet consensus detected
   └─ Score >= threshold (60)

2. Validation
   └─ Domain/category filter
   └─ Risk check (position limits, exposure)
   └─ LLM confirmation (optional)

3. Execution
   └─ Size calculation (Kelly or fixed %)
   └─ Order placement
   └─ Position tracking

4. Monitoring
   └─ Price updates
   └─ Stop-loss / Take-profit
   └─ Portfolio rebalancing
```

## Recommended Cron Schedules

| Schedule | Job | Description |
|----------|-----|-------------|
| `*/5 * * * *` | Signal scan | Check for new signals every 5 min |
| `0 * * * *` | Risk check | Hourly portfolio risk assessment |
| `0 */6 * * *` | Performance | 6-hourly PnL and win rate report |
| `0 23 * * *` | Daily summary | End-of-day report with full breakdown |
| `0 8 * * 1` | Weekly review | Monday morning weekly performance review |
