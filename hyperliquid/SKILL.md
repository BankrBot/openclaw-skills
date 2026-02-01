---
name: hyperliquid
description: Query HyperLiquid perpetual futures data — prices, funding rates, open interest, candles, orderbooks, and account positions. Use when the user asks about perp markets, funding rates, liquidation prices, or wants to analyze HyperLiquid trading data. Supports 228+ perpetual contracts. No API key required for market data; private key needed only for trading.
metadata: {"clawdbot":{"emoji":"📊","homepage":"https://hyperliquid.xyz","requires":{"bins":["curl","jq","python3"]}}}
---

# HyperLiquid Skill

Query and trade on HyperLiquid — the largest on-chain perpetual futures exchange.

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

### Trading Setup (Optional)

To place orders, you need a private key. Add it to config:

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

| Command | Description | Example |
|---------|-------------|---------|
| `ta <coin>` | Technical analysis (EMA, RSI, ATR) | `scripts/hl.sh ta BTC` |
| `regime <coin>` | Market regime detection | `scripts/hl.sh regime BTC` |

### Account (Requires Private Key)

| Command | Description | Example |
|---------|-------------|---------|
| `account <address>` | Account summary + positions | `scripts/hl.sh account 0x...` |
| `positions <address>` | Open positions only | `scripts/hl.sh positions 0x...` |

## Candle Intervals

| Interval | Code |
|----------|------|
| 1 minute | `1m` |
| 5 minutes | `5m` |
| 15 minutes | `15m` |
| 1 hour | `1h` |
| 4 hours | `4h` |
| 1 day | `1d` |

## Use Cases

- **Funding rate arbitrage**: Find coins with extreme funding rates
- **Technical analysis**: EMA regime detection, RSI, ATR for any of 228+ perps
- **Market monitoring**: Track open interest shifts, volume spikes
- **Position tracking**: Monitor account positions and PnL

## API Reference

All endpoints use `POST https://api.hyperliquid.xyz/info` with JSON body.

See [references/api.md](references/api.md) for full API documentation.
