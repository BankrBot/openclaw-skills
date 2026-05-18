# Market Intelligence Reference

Pull a live overview of all Orderly perp markets — no auth required.

## Full Market Snapshot

```
GET https://api-evm.orderly.org/v1/public/futures
```

Returns all perp markets. Key fields per row:
- `symbol` — e.g. `PERP_BTC_USDC`
- `mark_price` / `index_price`
- `open_interest` — in base asset units (multiply by mark_price for USD value)
- `24h_volume` — USD volume
- `last_funding_rate` / `estimated_funding_rate` — as a decimal (multiply by 100 for %)
- `change_24h` — price change %

## How to Build an Intel Overview

```javascript
const r = await fetch("https://api-evm.orderly.org/v1/public/futures")
const { data } = await r.json()
const markets = data.rows.map(row => ({
  name:     row.symbol.replace("PERP_","").replace("_USDC",""),
  symbol:   row.symbol,
  markPx:   parseFloat(row.mark_price),
  oi:       parseFloat(row.open_interest) * parseFloat(row.mark_price),
  vol24h:   parseFloat(row["24h_volume"]),
  funding:  parseFloat(row.last_funding_rate || row.estimated_funding_rate) * 100,
  change24h: parseFloat(row.change_24h || 0) * 100,
}))
.filter(m => m.oi > 10_000)
.sort((a, b) => b.oi - a.oi)
```

## Signals to Surface

**Top OI markets** — sort by `oi` desc → these are the most crowded trades

**Extreme funding rates** (|funding| > 0.05% per period):
- Positive and high → longs being squeezed, market overextended long → potential short setup
- Negative and very low → shorts paying heavily, market overextended short → potential long setup

**Regime read:**
```
const longs  = markets.filter(m => m.funding > 0)
const shorts = markets.filter(m => m.funding < 0)
const avgFunding = markets.reduce((s,m) => s + m.funding, 0) / markets.length

// avgFunding > 0.03 → crowded longs across board → bearish regime signal
// avgFunding < -0.03 → crowded shorts → bullish mean-reversion setup
```

**Volume spike scan** — compare `vol24h` to typical baseline; outsized volume on a market signals potential catalyst

## Example Agent Response Pattern

When user asks "give me a market intel overview" or "what's hot on-chain right now":

1. Fetch `GET https://api-evm.orderly.org/v1/public/futures`
2. Extract top 5 by OI
3. Find markets with extreme funding (outliers)
4. Compute average funding regime signal
5. Return formatted summary:

```
MARKET INTEL — [timestamp]

TOP MARKETS BY OI:
1. BTC  — OI $2.1B | Funding +0.045%/hr | 24h Vol $890M | +1.2%
2. ETH  — OI $680M | Funding +0.021%/hr | 24h Vol $340M | -0.5%
3. SOL  — OI $210M | Funding -0.012%/hr | 24h Vol $180M | +3.1%

REGIME: Avg funding +0.029% → slight long bias, watch for squeeze on BTC/ETH

OUTLIERS:
• HYPE: funding -0.08% → shorts being squeezed, bullish signal
• ARB:  funding +0.11% → extreme long crowding, fade setup
```

## Combine with User's Open Positions

If the user has open positions (from `POST https://og.nexustradinglabs.com/positions`), cross-reference:
- If user is LONG BTC and funding is extremely positive → warn: "You're aligned with the crowd — high squeeze risk, funding cost eating P&L"
- If user is SHORT SOL and funding is negative → confirm: "Trend is with you — shorts being paid"
- If user is positioned against the regime signal → flag the tension
