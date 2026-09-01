# Zonein Data Schema Reference

## Prediction Market (Polymarket)

### Leaderboard Entry
```json
{
  "wallet": "0x...",
  "proxyWallet": "0x...",
  "userName": "trader_name",
  "profileImage": "https://...",
  "rank": 1,
  "pnl": 50000.0,
  "vol": 200000.0,
  "period": "WEEK",
  "category": "OVERALL"
}
```

### Trader / User
```json
{
  "wallet": "0x...",
  "username": "trader_name",
  "pfp": "https://...",
  "score": 85.5,
  "labels": ["smart_money", "whale", "consistent_winner"],
  "stats": {
    "total_trades": 150,
    "win_rate": 0.68,
    "roi": 0.45,
    "volume": 500000,
    "avg_hold_hours": 48
  }
}
```

### Trader Performance (pre-calculated)
```json
{
  "wallet": "0x...",
  "username": "trader_name",
  "overall": {
    "pnl": 50000,
    "volume": 200000,
    "roi": 0.25,
    "positions_count": 12
  },
  "best_category": "POLITICS",
  "category_stats": [
    {"category": "POLITICS", "pnl": 30000, "volume": 100000, "roi": 0.30},
    {"category": "CRYPTO", "pnl": 20000, "volume": 100000, "roi": 0.20}
  ]
}
```

### Position (PM)
```json
{
  "wallet": "0x...",
  "slug": "will-trump-win-2024",
  "eventSlug": "presidential-election-2024",
  "conditionId": "0x...",
  "title": "Will Trump win the 2024 election?",
  "outcome": "Yes",
  "outcomeIndex": 0,
  "size": 5000.0,
  "avgPrice": 0.45,
  "curPrice": 0.62,
  "totalBought": 5000.0,
  "category": "POLITICS",
  "endDate": "2024-11-05T00:00:00Z",
  "icon": "https://..."
}
```

### PM Signal (consensus-based)
```json
{
  "market_slug": "will-btc-hit-100k",
  "condition_id": "0x...",
  "title": "Will BTC hit $100k by end of 2024?",
  "direction": "YES",
  "consensus": 0.85,
  "total_wallets": 8,
  "yes_wallets": 7,
  "no_wallets": 1,
  "yes_size": 45000.0,
  "no_size": 3000.0,
  "cur_yes_price": 0.42,
  "cur_no_price": 0.58,
  "best_rank": 5,
  "category": "CRYPTO",
  "end_date": "2024-12-31T00:00:00Z"
}
```

## Perp Trading (HyperLiquid)

### Smart Trader
```json
{
  "address": "0x...",
  "smart_trader_score": 85.5,
  "smart_trader_metrics": {
    "win_rate": 0.72,
    "profit_factor": 2.5,
    "avg_trade_duration": 48,
    "max_drawdown": 0.15
  },
  "categories": ["whale", "momentum_trader"],
  "account_value": 500000.0,
  "perp_month_pnl": 50000.0,
  "perp_week_pnl": 12000.0,
  "perp_day_pnl": 3000.0,
  "current_positions": {
    "asset_positions": [
      {
        "position": {
          "coin": "BTC",
          "szi": 0.5,
          "entryPx": 95000.0,
          "positionValue": 47500.0,
          "unrealizedPnl": 1200.0,
          "leverage": {"value": 3.0}
        }
      }
    ]
  }
}
```

### Perp Signal (consensus-based)
```json
{
  "coin": "BTC",
  "direction": "LONG",
  "consensus": 0.82,
  "total_wallets": 15,
  "long_wallets": 12,
  "short_wallets": 3,
  "long_value": 2500000.0,
  "short_value": 300000.0,
  "avg_entry_long": 95500.0,
  "avg_entry_short": 96200.0,
  "best_trader_score": 92.0
}
```

### Coin Distribution
```json
{
  "BTC": {
    "long_count": 45,
    "short_count": 12,
    "total_value": 5000000.0,
    "wallet_count": 57
  }
}
```

## Agent Management

### Agent Config
```json
{
  "agent_id": "agent_abc123def456",
  "name": "PM Politics Agent",
  "agent_type": "prediction_market",
  "description": "Trades politics markets based on smart money signals",
  "enabled": true,
  "status": "enabled",
  "pm_config": {
    "categories": ["POLITICS", "ECONOMICS"],
    "leaderboard_period": "WEEK",
    "min_smart_wallets_agreeing": 3,
    "preferred_odds": 0.50,
    "min_edge": 0.03,
    "max_signals": 10,
    "signal_weights": {
      "consensus_ratio": 25,
      "user_count": 30,
      "leaderboard_rank": 20,
      "price_deviation_penalty": 10,
      "reward_ratio": 15
    }
  },
  "risk_config": {
    "max_position_size_pct": 0.05,
    "max_portfolio_exposure_pct": 0.50,
    "max_category_exposure_pct": 0.20,
    "min_edge": 0.05,
    "daily_loss_limit_pct": 0.10
  },
  "llm_config": {
    "provider": "openai",
    "model": "gpt-4-turbo",
    "temperature": 0.3
  },
  "strength_thresholds": {
    "BTC": {"min_strength_buy": 70, "min_strength_sell": 65},
    "ETH": {"min_strength_buy": 75, "min_strength_sell": 65},
    "SOL": {"min_strength_buy": 80, "min_strength_sell": 65},
    "OTHERS": {"min_strength_buy": 80, "min_strength_sell": 65}
  },
  "timeframe_weights": {
    "24h": 0.5,
    "4h": 0.35,
    "1h": 0.15
  }
}
```

### Agent Stats
```json
{
  "total_trades": 45,
  "successful_trades": 28,
  "win_rate": 0.622,
  "total_pnl": 1250.50,
  "total_volume": 8500.0
}
```
