---
name: autoresearch
description: >
  Karpathy-style autonomous trading strategy discovery for Base DEX.
  AI agent iteratively mutates, backtests, and evolves strategies against
  real Uniswap V3 + Aerodrome data on Base. Uses Bankr LLM Gateway for
  strategy mutations and Bankr wallet for live execution. LCM memory
  ensures each experiment builds on prior discoveries.
  Triggers on: "discover trading strategy", "run autoresearch", "backtest strategy",
  "optimize trading", "find alpha", "evolve strategy", "autonomous trading research",
  "DEX strategy", "Base trading", "strategy mutation".
---

# AutoResearch — Autonomous Trading Strategy Discovery

> Karpathy-style autoresearch for Base DEX. Iteratively mutates, backtests, and evolves
> trading strategies using LLM-driven mutations and persistent experiment memory.

**Repo:** https://github.com/darks0l/autoresearch
**Pairs:** ETH/USDC, cbETH/WETH, AERO/USDC (Uniswap V3 + Aerodrome on Base)
**Tests:** 38 passing | **Experiments:** 117+ logged | **Best Score:** 2.838 Sharpe

---

## How It Works

1. **Read** current strategy + experiment history
2. **Mutate** via Bankr LLM Gateway (claude-sonnet-4.5, or any of 27+ models)
3. **Backtest** against real Base DEX data (CoinGecko hourly OHLCV)
4. **Keep or revert** — only improvements survive
5. **Log to memory** — every experiment indexed for future reference
6. **Repeat** — each cycle gets smarter from accumulated knowledge

One file changes (`strategies/strategy.js`). Everything else stays locked.

---

## Quick Start

```bash
# Clone the skill
git clone https://github.com/darks0l/autoresearch.git
cd autoresearch

# Install (zero external deps beyond Node.js)
npm install

# Run autonomous research (30 experiments)
node scripts/run-autoresearch.js --max 30

# Or run the persistent daemon
node scripts/daemon.js --batch 15 --model claude-sonnet-4.5
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `BANKR_API_KEY` | Bankr API key for LLM mutations + wallet | Yes (for LLM) |
| `BANKR_WALLET` | Bankr wallet address for live execution | No |
| `UNISWAP_API_KEY` | Uniswap Developer Platform API key | No |
| `BASE_RPC_URL` | Base RPC endpoint | No (defaults to mainnet.base.org) |
| `AUTORESEARCH_MODEL` | LLM model for mutations | No (defaults to claude-sonnet-4.5) |

---

## Bankr Integration (3 Layers)

### 1. LLM Gateway — Strategy Mutations
The agent calls Bankr LLM Gateway (`llm.bankr.bot`) to generate strategy mutations.
Each call includes the current strategy code, experiment history, and performance data.
The LLM proposes one atomic change with a testable hypothesis.

```javascript
// POST https://llm.bankr.bot/v1/chat/completions
{
  "model": "claude-sonnet-4.5",
  "messages": [
    { "role": "system", "content": "You are a quantitative trading researcher..." },
    { "role": "user", "content": "Current strategy:\n```js\n...\n```\nHistory: 117 experiments, best score 2.838..." }
  ]
}
```

### 2. Wallet Execution — Live Trading
Optional live execution via Bankr wallet on Base. The executor module handles:
- Position sizing with risk limits (15% max position, 5% daily loss limit)
- Paper trading mode for validation before going live
- Real swap execution via `POST /agent/prompt`

### 3. Balance Tracking — Portfolio Sync
Reads Bankr wallet state via `GET /agent/balances` for position tracking
and credit monitoring via `GET /v1/credits`.

---

## Strategy Interface

Your strategy must implement a `Strategy` class with an `onBar()` method:

```javascript
import { rsi, ema, bollingerBands, atr, vwap, roc } from '../src/indicators.js';

export class Strategy {
  constructor() {
    // Initialize parameters and state
  }

  onBar(barData, portfolio) {
    // barData: { 'ETH/USDC': { open, high, low, close, volume, history: [...bars] } }
    // portfolio: { cash: number, positions: { pair: signedUsdNotional } }
    // Return: [{ pair, targetPosition, orderType? }]
    return [];
  }
}
```

---

## Available Indicators

All from `src/indicators.js` — pure math, no dependencies:

- `sma(values, period)` — Simple Moving Average
- `ema(values, period)` — Exponential Moving Average
- `rsi(closes, period)` — Relative Strength Index (default 14)
- `macd(closes, fast, slow, signal)` — MACD (default 12/26/9)
- `bollingerBands(closes, period, stdDev)` — Bollinger Bands (default 20/2)
- `atr(highs, lows, closes, period)` — Average True Range (default 14)
- `vwap(closes, volumes, period)` — VWAP (default 20)
- `roc(values, period)` — Rate of Change (default 10)
- `stddev(values, period)` — Standard Deviation (default 20)
- `percentileRank(values, period)` — Percentile Rank (default 100)

---

## Scoring System

```
score = sharpe × √(min(trades/50, 1.0)) − drawdown_penalty − turnover_penalty
```

- **Drawdown penalty:** `max(0, max_drawdown_pct − 15) × 0.05`
- **Turnover penalty:** `max(0, annual_turnover/capital − 500) × 0.001`
- **Hard cutoffs (→ −999):** Fewer than 10 trades, drawdown > 50%, lost > 50%

---

## Data Pipeline

Three-tier data sourcing with disk caching:
1. **CoinGecko** — Free hourly OHLCV (90 days, 703 bars per pair)
2. **DeFiLlama** — Price data fallback
3. **Synthetic GBM** — Last resort for testing (geometric Brownian motion)

Cache TTL: 7 days. Pairs: ETH/USDC, ETH/USDC-30 (0.3% fee tier), cbETH/WETH, AERO/USDC.

---

## Modules

| Module | Description |
|--------|-------------|
| `src/indicators.js` | 10 technical indicators, pure math |
| `src/backtest.js` | Replay engine with fee model and scoring |
| `src/controller.js` | Autoresearch loop orchestrator |
| `src/memory.js` | LCM experiment memory layer |
| `src/data.js` | OHLCV data fetcher with caching |
| `src/datafeed.js` | Production data feed (DeFiLlama + CoinGecko) |
| `src/regime.js` | Regime detection (Hurst, trend, volatility) |
| `src/executor.js` | Production execution via Bankr wallet |
| `src/bankr.js` | Bankr LLM Gateway + wallet integration |
| `src/reporter.js` | Batch reporting for Discord/Telegram |
| `src/config.js` | Configuration management |
| `strategies/strategy.js` | THE mutable file (agent modifies only this) |

---

## OpenClaw Integration

### As a Skill
Drop into your OpenClaw skills directory (`~/.openclaw/skills/autoresearch/`).

### As a Cron Job
```
"Run 15 autoresearch experiments, report results to #trading"
```

### Sub-Agent Pattern
```javascript
sessions_spawn({
  task: "Run 50 autoresearch experiments. Report after each batch of 5.",
  mode: "run"
})
```

---

## Key Discovery

VWAP mean-reversion peaked at score 0.740 over 106 experiments on synthetic data.
When switched to real CoinGecko data, it collapsed to **-1.46** — completely overfit.
The system autonomously pivoted to adaptive trend-following (Donchian breakout +
EMA filter + RSI dip-buying + ATR trailing stops) and achieved **score 2.838** on real data.

The agent doesn't just execute trades — it discovers *how* to trade, and learns from its mistakes.

---

## Live Trade Proof

- **TX:** [`0x752f7393...`](https://basescan.org/tx/0x752f73935fa93862fb37d14c09054785fdd983ce9bcc928af7ece91d3d69b4b8)
- **Action:** 1 USDC → 0.000464 ETH on Base via Bankr wallet
- **Chain:** Base mainnet

---

*Built by DARKSOL 🌑 — autonomous strategy discovery for Base DEX*
