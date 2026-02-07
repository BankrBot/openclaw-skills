---
name: hyperliquid
description: Query HyperLiquid perpetual futures data — prices, funding rates, open interest, candles, orderbooks, and account positions. Use when the user asks about perp markets, funding rates, liquidation prices, or wants to analyze HyperLiquid trading data. Supports hundreds of perpetual contracts. No API key required for market data; private key needed only for trading (not implemented in scripts yet).
metadata: {"clawdbot":{"emoji":"📊","homepage":"https://hyperliquid.xyz","requires":{"bins":["curl","jq","python3"]}}}
---

# HyperLiquid Skill

Query HyperLiquid — the largest on-chain perpetual futures exchange.

## Quick Start

No setup needed for market data! HyperLiquid's API is fully public.

```bash
# Get BTC price
scripts/hl.sh price BTC

# Get funding rates
scripts/hl.sh funding BTC

# Get orderbook
scripts/hl.sh book BTC

# Get candles (1h, 15m, 1d, etc.)
scripts/hl.sh candles BTC 1h 50

# Full market overview
scripts/hl.sh overview
```

### Trading Setup (Optional, Not Implemented in Scripts Yet)

Trading endpoints are not implemented in `scripts/hl.sh` yet. This config is included for future expansion:

```bash
mkdir -p ~/.clawdbot/skills/hyperliquid
cat > ~/.clawdbot/skills/hyperliquid/config.json << 'EOF'
{
  "privateKey": "0xYOUR_PRIVATE_KEY",
  "vault": null
}
EOF
```

⚠️ **Trading is advanced.** Start with market data only. HyperLiquid perps use leverage and can liquidate your position.

## Commands

### Market Data (No Auth)

| Command | Description | Example |
|---------|-------------|---------|
| `price <coin>` | Current mid price | `scripts/hl.sh price BTC` |
| `price all` | All mid prices | `scripts/hl.sh price all` |
| `funding <coin>` | Current funding rate + OI | `scripts/hl.sh funding BTC` |
| `funding top` | Top 10 by funding rate | `scripts/hl.sh funding top` |
| `book <coin>` | Top 5 bids/asks | `scripts/hl.sh book BTC` |
| `candles <coin> <interval> [count]` | OHLCV candles | `scripts/hl.sh candles ETH 1h 24` |
| `overview` | Market summary (BTC, ETH, top movers) | `scripts/hl.sh overview` |
| `meta` | List all available perps | `scripts/hl.sh meta` |
| `oi top` | Top 10 by open interest (USD) | `scripts/hl.sh oi top` |

### Analysis (No Auth)

The `ta` and `regime` commands require numpy:

```bash
pip install numpy
```

| Command | Description | Example |
|---------|-------------|---------|
| `ta <coin>` | Technical analysis (EMA, RSI, ATR) | `scripts/hl.sh ta BTC` |
| `regime <coin>` | Market regime detection | `scripts/hl.sh regime BTC` |

### Account (No Auth)

| Command | Description | Example |
|---------|-------------|---------|
| `account <address>` | Account summary + positions | `scripts/hl.sh account 0x...` |
| `positions <address>` | Open positions only | `scripts/hl.sh positions 0x...` |

## Candle Intervals

| Interval | Code |
|----------|------|
| 1 minute | `1m` |
| 3 minutes | `3m` |
| 5 minutes | `5m` |
| 15 minutes | `15m` |
| 30 minutes | `30m` |
| 1 hour | `1h` |
| 2 hours | `2h` |
| 4 hours | `4h` |
| 8 hours | `8h` |
| 12 hours | `12h` |
| 1 day | `1d` |
| 3 days | `3d` |
| 1 week | `1w` |
| 1 month | `1M` |

## Use Cases

- **Funding rate arbitrage**: Find coins with extreme funding rates
- **Technical analysis**: EMA regime detection, RSI, ATR for hundreds of perps
- **Market monitoring**: Track open interest shifts, volume spikes
- **Position tracking**: Monitor account positions and PnL

## API Reference

All endpoints use `POST https://api.hyperliquid.xyz/info` with JSON body.

See [references/api.md](references/api.md) for full API documentation.
