#!/usr/bin/env bash
# HyperLiquid CLI — query perp market data, funding rates, candles, and more.
# Usage: hl.sh <command> [args...]
#
# Commands:
#   price <coin|all>           — Current mid price(s)
#   funding <coin|top>         — Funding rate + OI
#   book <coin>                — Top 5 bids/asks
#   candles <coin> <interval> [count] — OHLCV candles
#   overview                   — Market summary
#   meta                       — List all available perps
#   oi <top>                   — Open interest rankings
#   ta <coin>                  — Technical analysis (EMA/RSI/ATR)
#   regime <coin>              — Market regime detection
#   account <address>          — Account summary
#   positions <address>        — Open positions

set -euo pipefail

API="https://api.hyperliquid.xyz/info"

_post() {
  curl -s "$API" -X POST -H "Content-Type: application/json" -d "$1"
}

cmd_price() {
  local coin="${1:-BTC}"
  if [[ "$coin" == "all" ]]; then
    _post '{"type":"allMids"}' | python3 -c "
import sys, json
d = json.load(sys.stdin)
pairs = sorted(d.items(), key=lambda x: -float(x[1]) if x[1] else 0)
print(f'{"Coin":<12} {"Price":>14}')
print('-' * 28)
for k, v in pairs[:30]:
    print(f'{k:<12} \${float(v):>13,.2f}')
if len(pairs) > 30:
    print(f'... and {len(pairs)-30} more')
"
  else
    coin="${coin^^}"
    _post '{"type":"allMids"}' | python3 -c "
import sys, json
d = json.load(sys.stdin)
coin = '${coin}'
if coin in d:
    print(f'{coin}: \${float(d[coin]):,.2f}')
else:
    print(f'Coin {coin} not found. Try: hl.sh meta')
    sys.exit(1)
"
  fi
}

cmd_funding() {
  local coin="${1:-BTC}"
  if [[ "$coin" == "top" ]]; then
    _post '{"type":"metaAndAssetCtxs"}' | python3 -c "
import sys, json
d = json.load(sys.stdin)
meta, ctxs = d[0]['universe'], d[1]
items = []
for i, m in enumerate(meta):
    f = float(ctxs[i].get('funding', '0'))
    oi = float(ctxs[i].get('openInterest', '0'))
    mark = float(ctxs[i].get('markPx', '0'))
    oi_usd = oi * mark
    if oi_usd > 100000:  # Filter out dead markets
        items.append((m['name'], f, mark, oi_usd))

# Sort by absolute funding
items.sort(key=lambda x: -abs(x[1]))
print(f'{\"Coin\":<10} {\"Funding (8h)\":>12} {\"Annualized\":>12} {\"Mark\":>12} {\"OI (USD)\":>14}')
print('-' * 64)
for name, f, mark, oi_usd in items[:15]:
    ann = f * 3 * 365 * 100
    print(f'{name:<10} {f*100:>11.4f}% {ann:>11.1f}% \${mark:>11,.2f} \${oi_usd:>13,.0f}')
"
  else
    coin="${coin^^}"
    _post '{"type":"metaAndAssetCtxs"}' | python3 -c "
import sys, json
d = json.load(sys.stdin)
meta, ctxs = d[0]['universe'], d[1]
coin = '${coin}'
for i, m in enumerate(meta):
    if m['name'] == coin:
        c = ctxs[i]
        f = float(c.get('funding', '0'))
        ann = f * 3 * 365 * 100
        mark = float(c.get('markPx', '0'))
        oi = float(c.get('openInterest', '0'))
        vol24 = float(c.get('dayNtlVlm', '0'))
        prem = float(c.get('premium', '0'))
        print(f'{coin} Funding:')
        print(f'  Rate (8h):    {f*100:.4f}%')
        print(f'  Annualized:   {ann:.1f}%')
        print(f'  Mark Price:   \${mark:,.2f}')
        print(f'  Open Interest: {oi:,.2f} {coin} (\${oi*mark:,.0f})')
        print(f'  24h Volume:   \${vol24:,.0f}')
        print(f'  Premium:      {prem*100:.4f}%')
        sys.exit(0)
print(f'Coin {coin} not found')
sys.exit(1)
"
  fi
}

cmd_book() {
  local coin="${1:-BTC}"
  coin="${coin^^}"
  _post "{\"type\":\"l2Book\",\"coin\":\"${coin}\"}" | python3 -c "
import sys, json
d = json.load(sys.stdin)
levels = d.get('levels', [[],[]])
bids, asks = levels[0][:5], levels[1][:5]
print(f'${coin} Order Book')
print(f'{\"Ask\":>12} {\"Size\":>12}')
print('-' * 26)
for a in reversed(asks):
    print(f'\${float(a[\"px\"]):>11,.2f} {float(a[\"sz\"]):>11,.4f}')
print(f'  --- spread ---')
for b in bids:
    print(f'\${float(b[\"px\"]):>11,.2f} {float(b[\"sz\"]):>11,.4f}')
print('-' * 26)
print(f'{\"Bid\":>12} {\"Size\":>12}')
"
}

cmd_candles() {
  local coin="${1:-BTC}"
  local interval="${2:-1h}"
  local count="${3:-24}"
  coin="${coin^^}"
  
  # Convert interval to API format
  local api_interval="$interval"
  
  # Calculate time range
  local now_ms=$(python3 -c "import time; print(int(time.time()*1000))")
  local interval_ms
  case "$interval" in
    1m)  interval_ms=60000 ;;
    5m)  interval_ms=300000 ;;
    15m) interval_ms=900000 ;;
    1h)  interval_ms=3600000 ;;
    4h)  interval_ms=14400000 ;;
    1d)  interval_ms=86400000 ;;
    *)   interval_ms=3600000 ;;
  esac
  
  local start_ms=$(( now_ms - interval_ms * count ))
  
  _post "{\"type\":\"candleSnapshot\",\"req\":{\"coin\":\"${coin}\",\"interval\":\"${interval}\",\"startTime\":${start_ms},\"endTime\":${now_ms}}}" | python3 -c "
import sys, json
candles = json.load(sys.stdin)
if not candles:
    print('No candle data returned')
    sys.exit(1)
print(f'${coin} ${interval} candles (last ${count})')
print(f'{\"Time\":>20} {\"Open\":>12} {\"High\":>12} {\"Low\":>12} {\"Close\":>12} {\"Volume\":>12}')
print('-' * 84)
for c in candles[-int('${count}'):]:
    from datetime import datetime, timezone
    t = datetime.fromtimestamp(c['t']/1000, tz=timezone.utc).strftime('%Y-%m-%d %H:%M')
    o, h, l, cl = float(c['o']), float(c['h']), float(c['l']), float(c['c'])
    v = float(c['v'])
    print(f'{t:>20} \${o:>11,.2f} \${h:>11,.2f} \${l:>11,.2f} \${cl:>11,.2f} {v:>11,.2f}')
"
}

cmd_overview() {
  _post '{"type":"metaAndAssetCtxs"}' | python3 -c "
import sys, json
d = json.load(sys.stdin)
meta, ctxs = d[0]['universe'], d[1]

print('=== HyperLiquid Market Overview ===')
print(f'Total perps: {len(meta)}')
print()

# Top coins
top = ['BTC', 'ETH', 'SOL', 'AVAX', 'BNB']
print(f'{\"Coin\":<8} {\"Mark\":>12} {\"Funding\":>10} {\"24h Vol\":>14} {\"OI (USD)\":>14}')
print('-' * 62)
for i, m in enumerate(meta):
    c = ctxs[i]
    name = m['name']
    if name in top:
        mark = float(c.get('markPx', '0'))
        f = float(c.get('funding', '0'))
        vol = float(c.get('dayNtlVlm', '0'))
        oi = float(c.get('openInterest', '0')) * mark
        print(f'{name:<8} \${mark:>11,.2f} {f*100:>9.4f}% \${vol:>13,.0f} \${oi:>13,.0f}')

# Top by volume
print()
items = []
for i, m in enumerate(meta):
    c = ctxs[i]
    vol = float(c.get('dayNtlVlm', '0'))
    mark = float(c.get('markPx', '0'))
    items.append((m['name'], vol, mark))
items.sort(key=lambda x: -x[1])

print('Top 10 by 24h Volume:')
print(f'{\"Coin\":<10} {\"24h Volume\":>14}')
print('-' * 26)
for name, vol, _ in items[:10]:
    print(f'{name:<10} \${vol:>13,.0f}')
"
}

cmd_meta() {
  _post '{"type":"meta"}' | python3 -c "
import sys, json
d = json.load(sys.stdin)
coins = [u['name'] for u in d['universe']]
print(f'Available perps ({len(coins)}):')
# Print in columns
cols = 6
for i in range(0, len(coins), cols):
    row = coins[i:i+cols]
    print('  '.join(f'{c:<10}' for c in row))
"
}

cmd_oi() {
  local subcmd="${1:-top}"
  _post '{"type":"metaAndAssetCtxs"}' | python3 -c "
import sys, json
d = json.load(sys.stdin)
meta, ctxs = d[0]['universe'], d[1]
items = []
for i, m in enumerate(meta):
    c = ctxs[i]
    mark = float(c.get('markPx', '0'))
    oi = float(c.get('openInterest', '0'))
    oi_usd = oi * mark
    items.append((m['name'], oi_usd, oi, mark))
items.sort(key=lambda x: -x[1])
print(f'{\"Coin\":<10} {\"OI (USD)\":>16} {\"OI (Coins)\":>14} {\"Mark\":>12}')
print('-' * 56)
for name, oi_usd, oi, mark in items[:15]:
    print(f'{name:<10} \${oi_usd:>15,.0f} {oi:>13,.2f} \${mark:>11,.2f}')
"
}

cmd_ta() {
  local coin="${1:-BTC}"
  coin="${coin^^}"
  
  # Fetch 100 1h candles for TA
  local now_ms=$(python3 -c "import time; print(int(time.time()*1000))")
  local start_ms=$(( now_ms - 3600000 * 100 ))
  
  _post "{\"type\":\"candleSnapshot\",\"req\":{\"coin\":\"${coin}\",\"interval\":\"1h\",\"startTime\":${start_ms},\"endTime\":${now_ms}}}" | python3 -c "
import sys, json, numpy as np

candles = json.load(sys.stdin)
if len(candles) < 30:
    print('Insufficient data for TA')
    sys.exit(1)

closes = np.array([float(c['c']) for c in candles])
highs = np.array([float(c['h']) for c in candles])
lows = np.array([float(c['l']) for c in candles])
volumes = np.array([float(c['v']) for c in candles])

price = closes[-1]

# EMA 20
ema20 = closes.copy().astype(float)
alpha = 2 / 21
for i in range(1, len(ema20)):
    ema20[i] = alpha * closes[i] + (1 - alpha) * ema20[i-1]

# EMA 50
ema50 = closes.copy().astype(float)
alpha50 = 2 / 51
for i in range(1, len(ema50)):
    ema50[i] = alpha50 * closes[i] + (1 - alpha50) * ema50[i-1]

# RSI 14
deltas = np.diff(closes)
gains = np.where(deltas > 0, deltas, 0)
losses = np.where(deltas < 0, -deltas, 0)
avg_gain = np.mean(gains[-14:])
avg_loss = np.mean(losses[-14:])
rs = avg_gain / avg_loss if avg_loss > 0 else 100
rsi = 100 - (100 / (1 + rs))

# ATR 14
tr = np.maximum(highs[1:] - lows[1:], np.maximum(
    np.abs(highs[1:] - closes[:-1]),
    np.abs(lows[1:] - closes[:-1])
))
atr = np.mean(tr[-14:])
atr_pct = (atr / price) * 100

# Volume
vol_avg = np.mean(volumes[-20:])
vol_current = volumes[-1]
vol_ratio = vol_current / vol_avg if vol_avg > 0 else 0

# Trend
ema_slope = (ema20[-1] - ema20[-5]) / ema20[-5] * 100 if len(ema20) >= 5 else 0
if ema_slope > 0.1:
    trend = '📈 UPTREND'
elif ema_slope < -0.1:
    trend = '📉 DOWNTREND'
else:
    trend = '➡️  RANGING'

# Signal
above_ema20 = price > ema20[-1]
above_ema50 = price > ema50[-1]

print(f'=== ${coin} Technical Analysis (1H) ===')
print(f'Price:        \${price:,.2f}')
print(f'Trend:        {trend} (EMA slope: {ema_slope:+.3f}%)')
print()
print(f'EMA 20:       \${ema20[-1]:,.2f} ({\"above ✅\" if above_ema20 else \"below ❌\"})')
print(f'EMA 50:       \${ema50[-1]:,.2f} ({\"above ✅\" if above_ema50 else \"below ❌\"})')
print(f'RSI (14):     {rsi:.1f} ({\"overbought ⚠️\" if rsi > 70 else \"oversold ⚠️\" if rsi < 30 else \"neutral\"})')
print(f'ATR (14):     \${atr:,.2f} ({atr_pct:.2f}%)')
print(f'Volume:       {vol_ratio:.2f}x avg ({\"high 🔥\" if vol_ratio > 1.5 else \"low\" if vol_ratio < 0.7 else \"normal\"})')
"
}

cmd_regime() {
  local coin="${1:-BTC}"
  coin="${coin^^}"
  
  local now_ms=$(python3 -c "import time; print(int(time.time()*1000))")
  local start_ms=$(( now_ms - 3600000 * 200 ))
  
  _post "{\"type\":\"candleSnapshot\",\"req\":{\"coin\":\"${coin}\",\"interval\":\"1h\",\"startTime\":${start_ms},\"endTime\":${now_ms}}}" | python3 -c "
import sys, json, numpy as np

candles = json.load(sys.stdin)
if len(candles) < 50:
    print('Insufficient data for regime detection')
    sys.exit(1)

closes = np.array([float(c['c']) for c in candles])
highs = np.array([float(c['h']) for c in candles])
lows = np.array([float(c['l']) for c in candles])

price = closes[-1]

# EMA 20
ema20 = closes.copy().astype(float)
alpha = 2 / 21
for i in range(1, len(ema20)):
    ema20[i] = alpha * closes[i] + (1 - alpha) * ema20[i-1]

# ATR 14
tr = np.maximum(highs[1:] - lows[1:], np.maximum(
    np.abs(highs[1:] - closes[:-1]),
    np.abs(lows[1:] - closes[:-1])
))
atr_series = []
for i in range(13, len(tr)):
    atr_series.append(np.mean(tr[i-13:i+1]))
atr_series = np.array(atr_series)

# Volatility regime
atr_pct = (atr_series / closes[14:14+len(atr_series)]) * 100
current_atr_pct = atr_pct[-1] if len(atr_pct) > 0 else 0
mean_atr_pct = np.mean(atr_pct)
std_atr_pct = np.std(atr_pct)

if current_atr_pct > mean_atr_pct + std_atr_pct:
    vol_regime = '🔴 HIGH VOLATILITY'
elif current_atr_pct < mean_atr_pct - std_atr_pct:
    vol_regime = '🟢 LOW VOLATILITY'
else:
    vol_regime = '🟡 MEDIUM VOLATILITY'

# Trend regime
ema_slope = (ema20[-1] - ema20[-5]) / ema20[-5] * 100
above_ema = price > ema20[-1]

if ema_slope > 0.2 and above_ema:
    trend_regime = '🟢 BULLISH TREND'
    bias = 'LONG bias (70/30)'
elif ema_slope < -0.2 and not above_ema:
    trend_regime = '🔴 BEARISH TREND'
    bias = 'SHORT bias (70/30)'
else:
    trend_regime = '🟡 NEUTRAL / CHOPPY'
    bias = 'No directional bias (50/50)'

# Consecutive candles above/below EMA
streak = 0
direction = 'above' if closes[-1] > ema20[-1] else 'below'
for i in range(len(closes)-1, -1, -1):
    if direction == 'above' and closes[i] > ema20[i]:
        streak += 1
    elif direction == 'below' and closes[i] < ema20[i]:
        streak += 1
    else:
        break

print(f'=== ${coin} Market Regime ===')
print(f'Price:           \${price:,.2f}')
print(f'EMA 20:          \${ema20[-1]:,.2f}')
print()
print(f'Trend Regime:    {trend_regime}')
print(f'  EMA Slope:     {ema_slope:+.3f}%')
print(f'  Price vs EMA:  {direction} for {streak} candles')
print(f'  Suggested:     {bias}')
print()
print(f'Volatility:      {vol_regime}')
print(f'  ATR%:          {current_atr_pct:.3f}% (avg: {mean_atr_pct:.3f}%)')
print(f'  Z-score:       {(current_atr_pct - mean_atr_pct) / std_atr_pct:.2f}')
"
}

cmd_account() {
  local address="${1:?Usage: hl.sh account <address>}"
  _post "{\"type\":\"clearinghouseState\",\"user\":\"${address}\"}" | python3 -c "
import sys, json
d = json.load(sys.stdin)
margin = d.get('marginSummary', {})
print('=== Account Summary ===')
print(f'Account Value:    \${float(margin.get(\"accountValue\", 0)):,.2f}')
print(f'Total Margin:     \${float(margin.get(\"totalMarginUsed\", 0)):,.2f}')
print(f'Total NtlPos:     \${float(margin.get(\"totalNtlPos\", 0)):,.2f}')
print(f'Total Raw USD:    \${float(margin.get(\"totalRawUsd\", 0)):,.2f}')
print()
positions = [p for p in d.get('assetPositions', []) if float(p.get('position', {}).get('szi', '0')) != 0]
if positions:
    print(f'{\"Coin\":<8} {\"Side\":<6} {\"Size\":>10} {\"Entry\":>12} {\"Mark\":>12} {\"uPnL\":>12} {\"Liq\":>12}')
    print('-' * 76)
    for p in positions:
        pos = p['position']
        coin = pos.get('coin', '?')
        szi = float(pos.get('szi', '0'))
        side = 'LONG' if szi > 0 else 'SHORT'
        entry = float(pos.get('entryPx', '0'))
        mark = float(pos.get('positionValue', '0')) / abs(szi) if szi != 0 else 0
        upnl = float(pos.get('unrealizedPnl', '0'))
        liq = pos.get('liquidationPx', 'N/A')
        liq_str = f'\${float(liq):,.2f}' if liq and liq != 'N/A' else 'N/A'
        print(f'{coin:<8} {side:<6} {abs(szi):>10,.4f} \${entry:>11,.2f} \${mark:>11,.2f} \${upnl:>11,.2f} {liq_str:>12}')
else:
    print('No open positions')
"
}

cmd_positions() {
  cmd_account "$@"
}

# --- Main dispatcher ---
cmd="${1:-overview}"
shift 2>/dev/null || true

case "$cmd" in
  price)     cmd_price "$@" ;;
  funding)   cmd_funding "$@" ;;
  book)      cmd_book "$@" ;;
  candles)   cmd_candles "$@" ;;
  overview)  cmd_overview "$@" ;;
  meta)      cmd_meta "$@" ;;
  oi)        cmd_oi "$@" ;;
  ta)        cmd_ta "$@" ;;
  regime)    cmd_regime "$@" ;;
  account)   cmd_account "$@" ;;
  positions) cmd_positions "$@" ;;
  *)
    echo "Unknown command: $cmd"
    echo "Usage: hl.sh <price|funding|book|candles|overview|meta|oi|ta|regime|account|positions> [args...]"
    exit 1
    ;;
esac
