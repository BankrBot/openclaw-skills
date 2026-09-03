# delu-oracle — Response Schema

Locked JSON shape returned by `GET /analyze/{ca}?chain=base`. Fields are stable across the `v29-tiered-flywheel` version. Any breaking change bumps the `oracle_version` string.

> **v29 change:** `observed` (market/regime/social + scout/auditor/quant mirror) is now always included in the default response. No `?verbose=true` required. `?verbose=true` is accepted but is a no-op — it returns the same payload. `summary` (pre-lint narrative) is also always present.

> **Sequential calls required:** The x402 `upto` scheme uses a single-use Permit2 signature per authorization. Parallel requests from the same payer wallet will result in `402 Payment could not be verified` on all but the first. Always await each response before issuing the next call.

## `decision` (read this first)

The flat decision header. Everything an executor needs, no traversal.

| Field | Type | Description |
|---|---|---|
| `action` | enum | `ENTER`, `WATCH`, or `AVOID`. Mapped from `verdict` (strong_buy/buy → ENTER, hold → WATCH, avoid/drop → AVOID). |
| `conviction` | number | 0–100. `round(score × confidence)` — a single number to threshold on. |
| `direction` | enum | `long`. The oracle is long-only on Base spot. |
| `entry_low` | number \| null | Lower entry bound (mirrors `mandate.entry_zone[0]`). |
| `entry_high` | number \| null | Upper entry bound (mirrors `mandate.entry_zone[1]`). |
| `stop` | number \| null | Hard invalidation price (mirrors `mandate.stop_loss`). |
| `size_pct` | number \| null | Suggested size as % of portfolio (mirrors `mandate.size_hint_pct`). |
| `read` | string | One-line delu-voiced signal. lowercase, no cashtags, no contract addresses, no dashes. |

A simple agent gate: `decision.action === "ENTER" && decision.conviction >= 70 && confidence >= 0.6`.

## Top-level

| Field | Type | Description |
|---|---|---|
| `decision` | object | Flat decision header — see above. |
| `oracle_version` | string | `"v29-tiered-flywheel"` for this API. |
| `ca` | string | The 0x-prefixed EVM contract address echoed back. |
| `chain` | string | Always `"base"`. |
| `verdict` | enum | One of `strong_buy`, `buy`, `hold`, `avoid`, `drop`. |
| `score` | number | 0–100. Fused quant + structure + flow + regime tilt. |
| `confidence` | number | 0–1. Reflects data quality and inter-signal agreement. |
| `signals` | object | Per-dimension breakdown — see below. |
| `context` | object | Regime + macro + base-eco pulse. |
| `mandate` | object | Tactician trade plan — see `mandate-fields.md`. |
| `payment_tier` | object | Actual settlement info — see below. Source of truth for what was charged. |
| `observed` | object | Always present. Raw market block + deluagent scout/auditor/quant mirror — see below. |
| `summary` | string | Pre-lint narrative; source of `decision.read` before voice guardrails. |
| `drivers` | string[] | Up to 3 bullet-form positives. |
| `risks` | string[] | Up to 3 bullet-form risks. |
| `selected_timeframe` | enum \| null | OHLCV timeframe the read was built on: `1h`, `15m`, `5m`, or `null` if no usable candles. |
| `candle_count` | number | Number of candles in the selected timeframe. |
| `pool_source` | enum | `primary` (canonical pool) or `gecko_alt_pool` (alt-pool fallback used). |
| `timestamp` | string | ISO-8601. |

## `signals.momentum`

`h1_aligned_with_h24` (bool), `direction` (`bullish`/`bearish`/`neutral`), `strength` (`strong`/`moderate`/`weak`).

## `signals.flow`

Money flow from dexscreener trade data: `buyer_pressure` (`dominant`/`balanced`/`weak`/`unknown`), `net_flow_h1_pct`, `txn_intensity` (`high`/`normal`/`low`), and `data_quality` (`full` when both buys and sells are present, `estimated` when only one side is reported).

## `signals.structure`

Detected chart structure from the selected-timeframe OHLCV ladder: `state` (`accumulation`, `markup`, `distribution`, `markdown`, `mixed`) and `bias` (`bullish`/`bearish`/`neutral`).

## `signals.volatility`

`regime` (`low`/`normal`/`elevated`/`extreme`), `atr_pct_1h` (ATR as % of price, computed on the selected timeframe; `null` if unavailable), `atr_pct_band` (`p0-p25`/`p25-p50`/`p50-p75`/`p75-p100`).

## `signals.liquidity`

`depth_tier` (`thin`/`moderate`/`deep`/`premium`), `liquidity_to_volume_ratio`.

## `context`

| Field | Type | Description |
|---|---|---|
| `regime_label` | enum | One of `BASE_DECOUPLED`, `BULL_TREND`, `BULL_CHOP`, `MIXED`, `BEAR_TREND`, `BEAR_CAPITULATION`, `DEAD`. |
| `regime_confidence` | number | 0–1. |
| `base_eco_pulse` | enum | `expanding`, `contracting`, or `flat`. Pulse of base-eco anchors (BNKR, AERO, VIRTUAL, VVV, LFI). |
| `macro_pulse` | enum | `supportive`, `neutral`, or `headwind`. cbBTC/WETH macro anchors. |

## `payment_tier`

The actual settlement applied to this request. Always present in the response body.

| Field | Type | Description |
|---|---|---|
| `tier` | enum | `"whale"` (100M+ DELU, free), `"holder"` (50M+ DELU, 50k settled), `"public"` (< 50M DELU, 250k settled). |
| `delu_balance` | number | Caller's DELU balance on Base at request time. |
| `settled_delu` | number | Actual DELU settled: `0` (whale), `50000` (holder), `250000` (public). |
| `note` | string | Human-readable tier description. |

## `observed` (always present)

### `observed.market`

Raw market data: `symbol`, `price_usd`, `liquidity_usd`, `volume_h24`, `volume_h6`, `volume_h1`, `price_change_h1`, `price_change_h6`, `price_change_h24`, `atr_pct_1h`, `pool_age_days`, `dex_id`, `raw_ohlcv_used`.

### `observed.regime`

`label`, `confidence`.

### `observed.social`

`{ "status": "unavailable" }` when `?social=true` is not passed. When passed, contains `sentiment_score`, `momentum`, `mention_velocity`, `influencer_hits`.

### `observed.deluagent`

Scout/auditor/quant mirror — computed server-side on every call with `source: "internal"`.

**`scout`:** `symbol`, `address`, `priceUsd`, `liquidity`, `volume24h`, `viabilityScore`, `smartMoney`, `capitalInflowRatio`, `buyPressure`, `bucket`, `poolAgeDays`, `source`

**`auditor`:** `verdict` (`PASS`/`CAUTION`/`FAIL`), `safetyScore`, `hardFail`, `hardFails`, `source`

**`quant`:** `quantScore`, `regime`, `structure_phase`, `atr_pct_1h`, `volatility_regime`, `weights_used`, `source`
