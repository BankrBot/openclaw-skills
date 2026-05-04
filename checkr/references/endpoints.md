# checkr API — Endpoint Reference

## GET /v1/leaderboard

**Price:** $0.02/call  
**Params:** `?hours=1|2|4|8|12|24` (default 4), `?limit=1-50` (default 10)

```json
{
  "updated_at": "2026-03-06T17:21:04Z",
  "delta_hours": 2,
  "tokens": [
    {
      "symbol": "FAI",
      "ATT_pct": 9.63,
      "ATT_delta": -0.44,
      "MS_pct": 4.19,
      "INF_pct": 14.52,
      "velocity": 4.1,
      "mentions_2h": 11,
      "engagement_quality": 0.067,
      "top_account": { "username": "TheCryptoDog", "followers": 312000 },
      "ATT_trend_direction": "reversing",
      "ATT_accelerating": false
    }
  ]
}
```

**Fields:**
- `ATT_pct` — share of total attention across all tracked tokens (%)
- `ATT_delta` — change in ATT_pct over the `hours` window (percentage points)
- `MS_pct` — mindshare % (engagement-weighted)
- `INF_pct` — influence % (account-weight-adjusted)
- `velocity` — current 2h mentions / 48h baseline (>3x = spike)
- `engagement_quality` — fraction of posts with ≥10 likes
- `ATT_trend_direction` — "rising" | "falling" | "reversing" | "stable"

---

## GET /v1/spikes

**Price:** $0.05/call  
**Params:** `?min_velocity=3.0`, `?min_mentions=10`

```json
{
  "spikes": [
    {
      "symbol": "FAI",
      "velocity": 4.1,
      "ATT_pct": 9.63,
      "ATT_delta_1h": "-0.5pp",
      "narrative_summary": "$fai catching rotation from $tibbir and $drb. @TheCryptoDog: '$45m from $10m in a few days.'",
      "signal_type": "rotation",
      "divergence": false,
      "price_1h_pct": 23.11,
      "rotating_from": [
        { "symbol": "TIBBIR", "att_delta": -2.1 },
        { "symbol": "DRB", "att_delta": -1.4 }
      ]
    }
  ]
}
```

**Fields:**
- `velocity` — how fast attention is accelerating vs baseline
- `narrative_summary` — most recent approved narrative (null if none in last 4h)
- `signal_type` — "rotation" | "ecosystem" | "divergence" | "infrastructure" | "spike"
- `divergence` — true if attention and price are moving in opposite directions
- `rotating_from` — tokens losing attention share to this spike

---

## GET /v1/bankr

**Price:** $0.05/call  
**Params:** `?hours=1|2|4|8|12|24` (default 4, optional)

Competitive intelligence dashboard for bankr agents. Shows attention metrics for all 19 tracked bankr agents with dual normalization: bankr-relative (ATT_pct) and full Base context (ATT_base).


```json
{
  "updated_at": "2026-03-14T20:15:41.900167+00:00",
  "data_age_minutes": 0.0,
  "window_hours": 4,
  "agents_tracked": 19,
  "active_agents": 8,
  "total_attention_share": 25.0,
  "leaderboard": [
    {
      "symbol": "doppel",
      "ATT_pct": 25.0,
      "ATT_base": 5.7,
      "ATT_delta": 0.0,
      "velocity": 0.0,
      "mentions_4h": 6,
      "unique_authors": 5,
      "rank": 4
    },
    {
      "symbol": "kellyclaude",
      "ATT_pct": 24.1,
      "ATT_base": 5.5,
      "ATT_delta": 0.0,
      "velocity": 0.0,
      "mentions_4h": 4,
      "unique_authors": 4,
      "rank": 5
    }
  ],
  "top_gainers": [
    {
      "symbol": "felix",
      "delta": 0.7,
      "ATT_pct": 18.4
    }
  ],
  "top_losers": [
    {
      "symbol": "earendel",
      "delta": -3.8,
      "ATT_pct": 0.0
    }
  ]
}
```

**Fields:**
- `window_hours` — time window used for aggregation (matches `hours` param, default 4)
- `data_age_minutes` — always 0.0 (computed fresh from DB on every request)
- `ATT_pct` — attention share within bankr universe (normalized to 100%). Shows competitive position: "25.0% = this agent has 25% of all bankr agent attention"
- `ATT_base` — attention share in full Base ecosystem (context). Shows real market performance: "5.7% = this agent has 5.7% of all Base token attention"
- `ATT_delta` — change in base ATT% vs previous window. Positive = gaining real market attention, negative = losing
- `velocity` — spike multiplier vs baseline (0.0 from snapshot aggregation; use mentions growth for spike detection)
- `mentions_Nh` — total mentions in the time window (field name varies: `mentions_1h`, `mentions_4h`, etc.)
- `unique_authors` — number of distinct accounts posting about this agent
- `rank` — global rank among all Base tokens (1 = most attention)

**Use cases:**
- Competitive intelligence: "Which bankr agent is dominating the ecosystem?"
- Portfolio monitoring: "Is my agent gaining or losing attention?"
- Trading signals: "Which agents are spiking right now?"

**Tracked agents:** All active bankr agents. Universe is dynamically managed — agents are added and removed as activity changes.

---

## GET /v1/token/[symbol]

**Price:** $0.50/call

```json
{
  "symbol": "FAI",
  "ATT_delta_1h": "-0.5pp",
  "ATT_delta_4h": "+0.8pp",
  "price": {
    "usd": 0.00733,
    "change_1h_pct": 23.11,
    "change_24h_pct": 112.02,
    "fetched_at": "2026-03-06T17:21:04Z"
  },
  "divergence": {
    "detected": false,
    "att_direction": "down",
    "price_direction": "up",
    "note": "attention -0.5pp, price +23.1% in 1h"
  },
  "spike_history": {
    "confirmed": 1,
    "total": 1,
    "hit_rate": 1.0
  },
  "narrative": {
    "summary": "$fai catching rotation from $tibbir and $drb. @TheCryptoDog: '$45m from $10m in a few days.'",
    "confidence": 0.72,
    "last_posted_at": "2026-03-06T14:00:57Z",
    "price_at_post": 0.0045
  },
  "data_age_minutes": 6.2
}
```

**Fields:**
- `ATT_delta_1h/4h` — attention share change over 1h and 4h windows
- `divergence.detected` — true when attention and price are diverging (potential alpha signal)
- `spike_history.hit_rate` — fraction of past spikes that confirmed (price followed attention)
- `narrative` — most recent approved narrative with confidence score. null if no narrative in last 4h.
- `data_age_minutes` — how stale the data is (max ~30 min)

---

## Interpreting Signals

**High alpha situations:**
- `divergence.detected = true` + attention rising + price flat/down = potential accumulation
- `velocity > 5x` + `engagement_quality > 0.3` = high-conviction spike
- `signal_type = "rotation"` + `rotating_from` has large tokens = capital rotating in

**Low signal situations:**
- `engagement_quality < 0.1` = mostly low-engagement posts, treat velocity with skepticism
- `spike_history.hit_rate < 0.5` = this token's past spikes didn't confirm
- `narrative = null` = spike but no approved narrative yet (too early or filtered)

## Universe

Base chain tokens, dynamically managed. Tokens enter via on-chain pool discovery and social signal detection. Tokens are removed when activity drops below threshold.

`GET /v1/token/{symbol}` returns `404` if a symbol isn't currently tracked.
