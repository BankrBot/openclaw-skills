# Bankr Support/Resistance Bot

AI-powered trading automation for Bankr. Places limit buy orders at technical support levels and limit sell orders at resistance. Buys low, sells high — automatically.

## Description

Automated trading strategy that monitors social sentiment vs price action on Base chain. When sentiment diverges from price, places staggered limit orders at calculated support/resistance levels for optimal entry/exit. Never uses market orders — always buys at support, sells at resistance.

## Features

- **Support/Resistance Trading**: Limit buys at support, limit sells at resistance
- **Sentiment Signals**: Detects when social sentiment diverges from price
- **Ultra-Efficient Polling**: 60s intervals, 15 max attempts per job (80× fewer API calls)
- **Reserve Protection**: Configurable minimum balance per token
- **Smart Re-entries**: Reinvests 50% of sell proceeds at lower levels
- **Telegram Control**: Bot interface with /start, /stop, /run, /status

## Supported Tokens (Configurable)

Default configuration:
- BNKR (Bankr) - Base
- DEGEN (Degen) - Base  
- DRB (DRB Token) - Base

**Add your own tokens in `config.json`** — see Configuration section below.

## Commands

| Command | Description |
|---------|-------------|
| `/start` | Enable automation |
| `/stop` | Pause automation |
| `/status` | Current positions & PnL |
| `/positions` | Open limit orders |
| `/run` | Execute manual cycle |
| `/logs` | Recent decisions |
| `/config` | View thresholds |

## Configuration

### 1. API Key (Required)

Set environment variable before running:
```bash
export BANKRBOT_API_KEY="your_api_key_here"
```

Get your key at: https://bankr.bot (requires Trading + Agent API access)

### 2. Target Tokens

Edit `config.json` to customize tokens:

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
      "symbol": "YOUR_TOKEN",
      "name": "Your Token Name",
      "chain": "base",
      "contract": "0x...",
      "enabled": true
    }
  ],
  "minimum_reserves": {
    "BNKR": {
      "min_usd_value": 50,
      "reason": "Club subscription payment"
    },
    "YOUR_TOKEN": {
      "min_usd_value": 100,
      "reason": "HODL reserve"
    }
  }
}
```

**To add a new token:**
1. Add entry to `target_tokens` array
2. Set `enabled: true`
3. Add reserve to `minimum_reserves` (optional)
4. Restart the bot

### 3. Trading Thresholds

```json
{
  "sentiment_thresholds": {
    "buy_spike_percent": 35,
    "sell_drop_percent": 35,
    "price_lag_max_percent": 8
  },
  "risk_controls": {
    "max_position_percent": 8,
    "stop_loss_percent": 18,
    "take_profit_percent": 25,
    "min_usdc_reserve": 50
  }
}
```

## Installation

1. Set `BANKRBOT_API_KEY` environment variable
2. Configure `config.json` with your tokens and thresholds
3. Set Telegram bot token for notifications
4. Run `./start.sh` to launch

## Requirements

- Bankr API key with Trading + Agent access
- Python 3.8+
- python-telegram-bot >= 20.0

## Author

CardShark 🦈 — Automated trading for the Bankr ecosystem