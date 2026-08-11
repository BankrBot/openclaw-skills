<!-- GENERATED from public/skill/references/perps-signals.md — edit there, then npm run skill:build -->

# WTI Oil Signal

Quotient publishes one daily perpetual-futures direction signal for WTI crude oil. It is
informational research, not a trade instruction.

- `GET /api/v1/signals/oil` returns the latest WTI reading,
  episode context, and optional live marks for Polymarket perps `WTIOIL-USD` and
  Hyperliquid `xyz:CL`.
- `GET /api/v1/signals/perps` returns the WTI reading in the standard signal-list format.
  It returns no live marks.

Use Asset search for a holding, company, commodity, ticker, or exact platform identifier.
Asset coverage does not imply a directional signal: Gold, Apple, BTC, or natural gas may
have rich linked prediction-market intelligence without a published perp read.

## Relationship to the Hawk & Dove Index

The Hawk & Dove Index (Quotient Stability Index) is a separate 0–100
conflict/diplomacy macro-regime indicator. Lower means more hawkish or escalatory; higher
means more dovish or de-escalatory. It is not a central-bank-policy index.
It may be discretionary cross-asset context, but it is not a universal long/short mapping.

The WTI signal uses its own calibrated daily factor. Do not mechanically turn the
headline index into WTI direction or use it as a universal long/short mapping. In clients
that expose `get_hawk_dove_index`, it is a free local tool, not a public `/api/v1` route
or a third signal endpoint.

## WTI signal with live marks

```bash
quotient oil signal
```

Raw API-key equivalent:

```bash
curl -sS -H @- \
  "${QUOTIENT_BASE_URL:-https://quotient-api-gateway.onrender.com}/api/v1/signals/oil" \
  <<< "x-quotient-api-key: $QUOTIENT_API_KEY"
```

Important fields:

| Field | Meaning |
|---|---|
| `reading.reading_date` | New York trading-calendar date of the frozen graph read |
| `reading.is_current` / `days_since_reading` | Explicit freshness; a stale row is context, not a current position |
| `reading.side` / `state` | Long/short WTI output and bullish/bearish display state |
| `reading.z`, `gap`, `intensity` | Standardized reading, raw Q-versus-market gap, and intensity bucket |
| `basis_forecasts`, `basis_markets` | Inputs behind the daily read |
| `episode` | Consecutive same-side run scored from its opening day |
| `marks` | Optional live venue marks; either upstream may degrade to null without failing the graph read |
| `reading.relationships` | Bounded Asset/Market/Signal graph refs for the WTI signal |

Always report the reading date and freshness. `reading_missing=true` means no WTI signal
is available. `degraded=true` concerns requested live marks, not the stored signal.

## WTI signal-list format

```bash
quotient perps --asset wti
```

Raw API-key equivalent:

```bash
curl -sS -H @- \
  "${QUOTIENT_BASE_URL:-https://quotient-api-gateway.onrender.com}/api/v1/signals/perps?asset=wti&signal_type=daily" \
  <<< "x-quotient-api-key: $QUOTIENT_API_KEY"
```

The response always declares its boundary:

```json
{
  "as_of": "2026-08-09T14:00:00.000Z",
  "canonical_endpoint": "/api/v1/signals/oil",
  "scope": "wti-only",
  "signals": [
    {
      "asset": "wti",
      "venue": "hyperliquid",
      "venue_coin": "xyz:CL",
      "strategy_id": "crude-wti-v1",
      "strategy_version": "crude-wti-v1",
      "signal_type": "daily",
      "state": "short",
      "current_signal": {
        "id": "crude-wti:2026-08-09",
        "side": "short",
        "score": -1.62,
        "signal_date": "2026-08-09",
        "status": "active"
      },
      "observation": {
        "interval_date": "2026-08-09",
        "z": -1.62,
        "raw_gap": -0.041,
        "side": "short",
        "status": "active"
      },
      "card": {
        "mode": "daily",
        "canonical_endpoint": "/api/v1/signals/oil"
      },
      "contributing_markets": [],
      "receipts": null,
      "leverage_scenarios": null,
      "manifest_version": null,
      "relationships": {
        "assets": [],
        "markets": [],
        "signals": [],
        "truncated": { "assets": false, "markets": false, "signals": false }
      }
    }
  ]
}
```

Only `asset=wti` and `signal_type=daily` are part of the documented contract. Omit either
filter to receive the WTI signal. The endpoint returns at most one signal.

State is conservative:

- `long` or `short`: a valid WTI side for today's New York reading date;
- `flat`: a stale long/short row retained as context;
- `unavailable`: the row has no valid long/short side;
- `current_signal: null`: no valid side was silently inferred.

## Relationship envelope

WTI signal objects may contain `relationships.assets`, `relationships.markets`, and
`relationships.signals`. They are lightweight, non-recursive refs capped at 50 per
category. `truncated` says when more graph rows exist. `relationship` preserves the exact
final edge (`HAS_SIGNAL`, `ON_MARKET`, `ON_FORECAST`, or `HAS_MARKET`) and `via` names a
direct hop or explicit Market/Asset intermediate.

The envelope has no Forecast-ref category. It contains no probability, aggregate Asset
direction, or inferred `AFFECTS` relationship.

## Portfolio workflow

`quotient portfolio report --wallet ...` remains the read-only Polymarket-wallet workflow;
there is no new portfolio command. When `include_perps=true` and a `WTIOIL-USD` position
exists, the response may attach the WTI signal plus its relationship envelope.

For a non-Polymarket holding such as `xyz:GOLD`, `AAPL`, or `BTC`, search the Asset once
and use its linked markets. `/signals/perps` is WTI-only.

## Neutral presentation

State the exact reading, date, freshness, source endpoint, and mark-degradation status.
Do not turn WTI output, a relationship ref, or a linked prediction-market probability
into a buy, sell, hold, leverage, or execution recommendation.

Write the reading as claim, warrant, impact: the returned state and side, then `z`, `gap`,
`basis_forecasts`, and `basis_markets`, then the scope the reading covers. Follow
`writing-style.md` for the rest.

Report `reading.summary` as Quotient's text, quoted or attributed. Do not restate it as
your own view or extend it to an Asset the reading does not name. Linking the WTI reading
to a prediction market requires that market in `relationships` or `contributing_markets`;
a shared conflict, region, or headline links nothing.
