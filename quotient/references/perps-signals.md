<!-- GENERATED from public/skill/references/perps-signals.md — edit there, then npm run skill:build -->

# Price outlooks

Quotient publishes calibrated price outlooks under the `asset-price/1` contract:
for each covered asset and anchor cadence, the latest reading with a median and
p10/p25/p75/p90 distribution, grouped by price source. An asset with outlooks
always serves at least one group — where no source basis is stamped yet, the
newest reading is served through the legacy head pointer and tagged
`source: "legacy-head-fallback"`.
The lane is badged `maturity: "experimental"`. It is informational research, not
a trade instruction.

Records published after the tilt cutover stamp `asset-price/2` in the pipeline
and decide their side against the live Hyperliquid price in every mode — the
venue ladder no longer referees direction. The wire response contract remains
`asset-price/1`; the change is strictly additive.

- `GET /api/v1/signals/perps` returns one asset × anchor series container with
  its `basis_groups[]`. Filter with `asset`, `anchor`, and `asset_class`
  (`asset_class=commodity` returns every covered commodity series in one
  call); no params returns every covered series.
- A series is `{assetKey}:price-outlook:{anchorType}`, e.g.
  `commodity:wti:price-outlook:weekly`. Read `asset_key` and `anchor_type` from
  their own fields — asset keys contain a colon, so never parse `series_id`.
- Anchor cadences today: `daily`, `two-day`, `weekly`, `monthly`. The set is
  open; new cadences appear without a contract change.
- Coverage spans commodities (wti, gold, silver, copper, natural-gas,
  platinum), crypto (btc, eth), and single-name equities (nvda, intc, meta,
  tsla, aapl, orcl, hood, pltr).

Use Asset search for a holding, company, commodity, ticker, or exact platform
identifier. Asset coverage does not imply a price-outlook series: an asset may
have rich linked prediction-market intelligence without one.

## Relationship to the Hawk & Dove Index

The Hawk & Dove Index (Quotient Stability Index) is a separate 0–100
conflict/diplomacy macro-regime indicator. Lower means more hawkish or
escalatory; higher means more dovish or de-escalatory. It is not a
central-bank-policy index. It may be discretionary cross-asset context, but it
is not a universal long/short mapping.

Price-outlook series carry their own calibrated distributions. Do not
mechanically turn the headline index into an asset direction. In clients that
expose `get_hawk_dove_index`, it is a free local tool, not a public `/api/v1`
route or a third signal endpoint. The published asset-level direction is the
separate EXPERIMENTAL `/assets/stance` read (api-reference.md), which arbitrates
its per-settle-date stance against these outlooks.

## Reading price outlooks

```bash
quotient perps --asset wti --anchor weekly
```

Raw API-key equivalent:

```bash
curl -sS -H @- \
  "${QUOTIENT_BASE_URL:-https://quotient-api-gateway.onrender.com}/api/v1/signals/perps?asset=wti&anchor=weekly" \
  <<< "x-quotient-api-key: $QUOTIENT_API_KEY"
```

Response shape:

```json
{
  "as_of": "2026-08-17T12:00:00.000Z",
  "contract": "asset-price/1",
  "filters": { "asset": "wti", "anchor": "weekly" },
  "series_count": 1,
  "series": [
    {
      "series_id": "commodity:wti:price-outlook:weekly",
      "asset_key": "commodity:wti",
      "asset_class": "commodity",
      "anchor_type": "weekly",
      "display_name": "WTI crude oil",
      "mode": "signal",
      "maturity": "experimental",
      "contributing_venues": ["kalshi"],
      "basis_groups": [
        {
          "source": "basis-head",
          "basis_id": "basis:ice:wti:clu26:settle:v3",
          "resolution_reference": {
            "provider": "ice",
            "instrument_id": "CL-U26",
            "contract_month": "2026-09",
            "window": "official settlement",
            "timezone": "America/New_York",
            "rounding": "nearest 0.01",
            "value": 64.1,
            "freshness": "verified",
            "mapping_status": "verified"
          },
          "reference_quote": { "value": 64.1, "freshness": "verified" },
          "execution_reference": {
            "provider": "hyperliquid",
            "instrument_id": "xyz:CL",
            "value": 64.8,
            "freshness": "verified"
          },
          "basis_gap": {
            "settlement_value": 64.1,
            "execution_value": 64.8,
            "absolute": 0.7,
            "percentage": 0.01092
          },
          "basis_status": "verified",
          "grounding_status": "actionable",
          "suppression_reason": null,
          "outlook": {
            "anchor_date": "2026-08-22",
            "median_price": 64.1,
            "p10": 60.2,
            "p90": 68.1,
            "status": "active",
            "freshness_state": "fresh",
            "tilt": {
              "applied": true,
              "total_sigma": -0.12,
              "components": [
                {
                  "factor": "venue_gap",
                  "sigma_push": -0.12,
                  "weight": 0.25,
                  "cap": 0.15,
                  "inputs": { "venue_median_hl": 63.7 },
                  "reason": null
                }
              ],
              "version": "tilt/1"
            }
          },
          "provenance": { "source_type": "researched_forecast" },
          "price_signals": [],
          "contributing_venues": ["kalshi"]
        }
      ],
      "outlook": null,
      "spot_at_obs": null,
      "price_signals": []
    }
  ]
}
```

Important fields:

| Field | Meaning |
|---|---|
| `basis_groups` | Price-source groups. `[]` still prohibits fallback to the legacy singular fields |
| `source` | `basis-head`, or `legacy-head-fallback` when the asset had no basis heads yet and the newest outlook was served through the legacy head pointer as an exact-Hyperliquid group — outlooks never go dark |
| `basis_id` | Content-derived identity for the complete price-observable semantics and rules version |
| `resolution_reference` | Settlement provider, feed or instrument, contract month, window, timezone, rounding, and value |
| `reference_quote` | Timestamped underlying observation for the settlement basis |
| `value_kind` / `estimate` | Whether the settlement value is a provider print (`observed`) or Quotient's basis estimate (`estimated`) with its mandatory `{provider, method, ci_low, ci_high, inputs_at, estimate_version}` block |
| `execution_reference` | Separately labelled execution mark. It does not replace the settlement value |
| `basis_gap` | Signed execution-minus-settlement basis observation. `percentage` is a fraction. It is not arbitrage |
| `feed_basis` | The asset's learned venue↔Hyperliquid feed gap: each settled venue print vs the Hyperliquid close at the same instant, averaged per (asset, venue). `gap_pct` > 0 means the venue's settlement feed prints above Hyperliquid. Null until enough settled prints accumulate. Use it to restate a venue threshold in Hyperliquid terms |
| `basis_status` / `grounding_status` | Source mapping and freshness state for the group's reference values. Price signals attach only on a grounded group; the outlook itself always serves |
| `outlook.anchor_date` / `anchor_at` | The settlement anchor the group distribution targets |
| `outlook.median_price`, `p10`–`p90` | The calibrated distribution for that exact basis and anchor |
| `outlook.spot_at_obs` | Settlement-reference value when the reading was taken |
| `outlook.spot_gap_pct` / `spot_gap_sigma` | Median versus spot at observation, as a fraction and in horizon-sigma units. On asset-price/2 records this is the displacement the side is decided from; null on records published before 2026-08-18 |
| `outlook.spot_aligned` | Whether the side points the same way as median-versus-spot. True on asset-price/2 records (the side is decided from that very gap) — except a commodity outlook holding its old side while a flip pends its second confirming read, which stamps an honest false; false otherwise survives only on records from the venue-refereed era (2026-08-18 through the cutover); null when sideless or pre-2026-08-18 |
| `outlook.tilt` | Post-blend factor attribution: `{applied, total_sigma, components[], version}`, each component `{factor, sigma_push, weight, cap, inputs, reason}` in horizon-sigma units. Null on records published before the tilt engine. Price signals never carry a tilt |
| `outlook.revision` / `revisions` | Readings revise at most hourly; the newest revision wins |
| `outlook.freshness_state` / `status` | Explicit freshness; a stale reading is context, not a current view |
| `contributing_venues` | Prediction-market venues whose complete target keys match this basis group |
| `mode` | `signal` = a venue ladder informs the blend; `coverage` = the house/Q view without one. On asset-price/2 records both modes may carry a state/side and publish calls; on earlier records coverage was context only |
| `price_signals` | Published entry/exit calls for the current anchor |

`price_signals: []` is the normal state inside a basis group. Calls publish
only when the decide gate fires: the pooled median's displacement from the live
Hyperliquid price must clear an entry floor. On commodities a directional call
publishes only after two consecutive revisions argue the same side; other
asset classes publish on the single qualifying revision, and an exit to
neutral always publishes immediately. (Calls from the venue-refereed era —
2026-08-18 through the asset-price/2 cutover — measured that displacement
against the venue ladder's implied median instead.) A published call carries
`side`, `entry_ref_price`, `target`, `band_low`/`band_high` (the tight range),
`wide_low`/`wide_high` (the wide range), `stop`, `stop_touch_probability`,
`valid_from`, and `expires_at`, plus `spot_gap_pct` and `spot_aligned` (null on
calls published before 2026-08-18; tautologically true on asset-price/2 calls,
whose side is decided against the live Hyperliquid price). These fields
describe the moment of publication — recompute against a live price for a
current read. Calls are immutable: a revision is a new entry pointing back
through `supersedes_signal_id`. Calls never carry a `tilt`; attribution lives
on the reading.

An unknown but well-formed `asset`, `anchor`, or `asset_class` returns
`series: []` — an empty answer, not an error.

A settlement group whose reference carries `value_kind: "estimated"` prices from
Quotient's basis estimate rather than a licensed provider print. `grounding_status:
"estimated"` authorizes the same reads as `actionable`, and `price_signals` publish
normally — but attribute the value to Quotient (the estimate block's `provider`,
`quotient-basis`), never to the settlement provider named in the rules. A stale
estimate suppresses with `settlement_reference_stale`; a too-wide confidence interval
suppresses with `estimate_uncertainty_exceeded`.

Legacy singular `outlook`, `spot_at_obs`, and `price_signals` mirror only an exact
Hyperliquid basis group. Pyth, ICE, CME, and other settlement groups — observed or
estimated — leave them null or empty. Never fall back when `basis_groups` is present.

## Portfolio workflow

`quotient portfolio report --wallet ...` remains the read-only
Polymarket-wallet workflow. `include_perps=true` annexes perps positions and
equity only; it attaches no outlook. For the outlook on a held asset, call
`/signals/perps` with that asset.

## Neutral presentation

State the exact reading: basis, anchor date, median, distribution bounds, settlement
reference, execution reference, freshness, and mode. Do not turn an outlook, a distribution bound, or a
published price signal into a buy, sell, hold, leverage, or execution
recommendation. Relay a `price_signals` entry as Quotient's published call with
its exact fields and validity window.

Write the reading as claim, warrant, impact: the median and distribution, then
spot and displacement, then the anchor scope. Follow `writing-style.md` for the
rest.
