# Bankr Support/Resistance Bot Configuration

## API Key Setup (REQUIRED)

The bot requires a Bankr API key. **Never hardcode your key in the code.**

Set as environment variable:
```bash
export BANKRBOT_API_KEY="your_api_key_here"
```

Or add to your `~/.bashrc` or `~/.zshrc`:
```bash
echo 'export BANKRBOT_API_KEY="your_key"' >> ~/.bashrc
source ~/.bashrc
```

Get your key at: https://bankr.bot (requires Trading + Agent API permissions)

## Token Configuration

### Adding Custom Tokens

Edit `config.json` → `target_tokens` array:

```json
{
  "target_tokens": [
    {
      "symbol": "BNKR",
      "name": "Bankr",
      "chain": "base",
      "contract": null,
      "enabled": true
    },
    {
      "symbol": "DEGEN", 
      "name": "Degen",
      "chain": "base",
      "contract": null,
      "enabled": true
    },
    {
      "symbol": "AERO",
      "name": "Aerodrome",
      "chain": "base",
      "contract": "0x940181a94A35A4569E4529A3CDfB74e38CF986d0",
      "enabled": true
    }
  ]
}
```

**Fields:**
| Field | Description |
|-------|-------------|
| `symbol` | Token ticker (e.g., "BNKR") |
| `name` | Full token name |
| `chain` | Blockchain ("base" for Base) |
| `contract` | Contract address or `null` for native |
| `enabled` | `true` to trade, `false` to skip |

### Setting Minimum Reserves

Protect specific tokens from being sold:

```json
{
  "minimum_reserves": {
    "BNKR": {
      "min_usd_value": 50,
      "reason": "Club subscription payment"
    },
    "AERO": {
      "min_usd_value": 100,
      "reason": "Long-term HODL"
    }
  }
}
```

The bot will never sell below this USD value.

## API Settings

```json
{
  "api": {
    "bankr_url": "https://api.bankr.bot",
    "poll_interval_seconds": 60,
    "max_poll_attempts": 15,
    "retry_attempts": 1,
    "retry_delay_seconds": 60,
    "batch_poll_interval_seconds": 60,
    "batch_max_poll_attempts": 15,
    "batch_timeout_seconds": 900
  }
}
```

**Key**: 60s polling = ~15 requests per job vs 240+ with aggressive defaults.

## Sentiment Thresholds

| Parameter | Default | Description |
|-----------|---------|-------------|
| `buy_spike_percent` | 35% | Sentiment increase to trigger buy |
| `sell_drop_percent` | 35% | Sentiment decrease to trigger sell |
| `price_lag_max_percent` | 8% | Max price gap for valid signal |
| `trailing_1h_weight` | 0.6 | 1-hour sentiment weight |
| `trailing_4h_weight` | 0.4 | 4-hour sentiment weight |

## Risk Controls

| Parameter | Default | Description |
|-----------|---------|-------------|
| `max_position_percent` | 8% | Max portfolio allocation per token |
| `stop_loss_percent` | 18% | Auto-exit on loss |
| `take_profit_percent` | 25% | Auto-exit on gain |
| `max_daily_trades` | 6 | Daily trade limit |
| `min_usdc_reserve` | $50 | Minimum USDC balance |
| `cooldown_minutes` | 30 | Time between trades |

## Limit Order Strategy

```json
{
  "limit_orders": {
    "buy_levels": [
      {"percent": 40, "offset": 0},
      {"percent": 30, "offset": -3},
      {"percent": 30, "offset": -6}
    ],
    "reentry_percent_of_proceeds": 50,
    "default_reentry_offsets": [-5, -10, -15]
  }
}
```

Places 3 staggered buy orders at support levels with decreasing sizes.