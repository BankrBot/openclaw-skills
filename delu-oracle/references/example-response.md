# Example Response

Full default response (no `?social=true`) for `$BNKR` in a MIXED regime.

```json
{
  "decision": {
    "action": "WATCH",
    "conviction": 25,
    "direction": "long",
    "entry_low": null,
    "entry_high": null,
    "stop": null,
    "size_pct": null,
    "read": "bnkr scores 46, hold, in a mixed regime at low conviction. price action is mixed, up on the hour but down on the day, a short term bounce against a broader downtrend. structure sits in markdown with a bearish bias, volatility is normal at 2.32% atr. no clean entry yet, wait for structure to resolve."
  },
  "ca": "0x22af33fe49fd1fa80c7149773dde5890d3c76f3b",
  "chain": "base",
  "score": 46,
  "verdict": "hold",
  "confidence": 0.55,
  "drivers": [
    "premium liquidity ($2.33M) — deep execution headroom",
    "high turnover (vol24h $163k against liquidity)"
  ],
  "risks": [
    "structure in markdown, downside continuation risk",
    "hourly and daily momentum diverge"
  ],
  "signals": {
    "momentum":   { "h1_aligned_with_h24": false, "direction": "bullish", "strength": "weak" },
    "flow":       { "buyer_pressure": "balanced", "net_flow_h1_pct": -33.4, "txn_intensity": "high", "data_quality": "full" },
    "structure":  { "state": "markdown", "bias": "bearish" },
    "volatility": { "regime": "normal", "atr_pct_1h": 2.32, "atr_pct_band": "p25-p50" },
    "liquidity":  { "depth_tier": "premium", "liquidity_to_volume_ratio": 14.31 }
  },
  "context": {
    "regime_label": "MIXED",
    "regime_confidence": 0.11,
    "base_eco_pulse": "flat",
    "macro_pulse": "neutral"
  },
  "mandate": {
    "action": "WATCH",
    "entry_zone": null,
    "stop_loss": null,
    "stop_basis": null,
    "size_hint_pct": null,
    "size_basis": null,
    "horizon": "30m-2h",
    "invalidations": [
      "regime flip away from MIXED",
      "structure confirms markdown continuation"
    ]
  },
  "payment_tier": {
    "tier": "holder",
    "delu_balance": 50000000,
    "settled_delu": 50000,
    "note": "50M+ DELU holder rate applied"
  },
  "observed": {
    "market": {
      "symbol": "BNKR",
      "price_usd": 0.000412,
      "liquidity_usd": 2330000,
      "volume_h24": 163000,
      "volume_h6": 41200,
      "volume_h1": 8900,
      "price_change_h1": 1.2,
      "price_change_h6": -0.8,
      "price_change_h24": -3.1,
      "atr_pct_1h": 2.32,
      "pool_age_days": 13,
      "dex_id": "uniswap_v3",
      "raw_ohlcv_used": true
    },
    "regime": {
      "label": "MIXED",
      "confidence": 0.11
    },
    "social": { "status": "unavailable" },
    "deluagent": {
      "scout": {
        "symbol": "BNKR",
        "address": "0x22af33fe49fd1fa80c7149773dde5890d3c76f3b",
        "priceUsd": 0.000412,
        "liquidity": 2330000,
        "volume24h": 163000,
        "viabilityScore": 62,
        "smartMoney": false,
        "capitalInflowRatio": 0.04,
        "buyPressure": 0.44,
        "bucket": "tier2",
        "poolAgeDays": 13,
        "source": "internal"
      },
      "auditor": {
        "verdict": "PASS",
        "safetyScore": 78,
        "hardFail": false,
        "hardFails": [],
        "source": "internal"
      },
      "quant": {
        "quantScore": 46,
        "regime": "MIXED",
        "structure_phase": "markdown",
        "atr_pct_1h": 2.32,
        "volatility_regime": "normal",
        "weights_used": { "momentum": 0.35, "volume": 0.30, "inflow": 0.35, "structure": 0.25 },
        "source": "internal"
      }
    }
  },
  "summary": "bnkr scores 46 in a mixed regime. momentum is weak bullish on the hour but bearish on the day — divergence. structure is markdown with bearish bias. liquidity is premium at $2.33M. no clean entry.",
  "selected_timeframe": "1h",
  "pool_source": "primary",
  "candle_count": 168,
  "timestamp": "2026-06-09T00:00:00.000Z",
  "oracle_version": "v29-tiered-flywheel"
}
```

## Key things to note

- `decision.action` is `WATCH` → all position fields are `null` (no trade to execute)
- `payment_tier.settled_delu: 50000` — holder rate applied, not the 250k ceiling
- `observed.social.status: "unavailable"` — social not requested (`?social=true` not passed)
- `observed.deluagent.quant.weights_used` — live regime-adaptive weights, loaded from learning store per request
- `selected_timeframe: "1h"` and `candle_count: 168` — data provenance for the quant read
- `pool_source: "primary"` — canonical pool resolved without fallback
