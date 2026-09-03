<!-- GENERATED from public/skill/references/api-reference.md — edit there, then npm run skill:build -->

# Quotient API Reference (Skill-Focused)

Base URL: `${QUOTIENT_BASE_URL:-https://quotient-api-gateway.onrender.com}` — use this single origin for runtime requests and discovery (`/openapi.json`, `/api/public/pricing`, `/llms.txt`, `/skill/*`).

Canonical schemas: `https://quotient-api-gateway.onrender.com/openapi.json`. All reads are informational intelligence, not trade instructions. "Q's value" = the price implied by Quotient's latest forecast on the signal side.

## Breaking change (v5)

`GET /api/v1/signals` now serves **published Quotient trade signals** (`QuotientSignal`). The old article-opinion feed at that path is gone; article reads remain at `GET /api/v1/markets/{slug}/signals`. Old clients of `/v1/signals` must migrate.

## Access and Authorization

- Monetized requests use x402 pay-per-call (`402` challenge → sign → retry; see
  `bankr-x402-flow.md` / `vanilla-x402-flow.md`).
- The examples use `bankr x402 call` with an explicit USD payment cap. Agents with another
  x402-compatible wallet should make the equivalent paid request through their client.
- Every example pins `--max-payment` to the route's published price, so a raised gateway
  price fails closed instead of overpaying — on a payment-cap failure re-read
  `GET /api/public/pricing` and get fresh user approval; never blindly raise the cap. The
  vendored scripts go further: they pre-flight each route's 402 challenge (a free read),
  validate the pinned payment tuple (network, asset, payee, expiry), and cap at the live
  price under a pinned ceiling of 2× the published price
  (`references/payments-policy.md`).
- The examples deliberately omit `-y`/`--yes` (which skips the Bankr CLI's own payment
  confirmation). In non-interactive agent runtimes, run reads through
  `scripts/quotient.sh` instead — it enforces the host allowlist, per-route caps, spend
  ledger, and the payment protocol in `SKILL.md`, and adds `--yes` only for an authorized
  spend.
- Treat the runtime `402` challenge and `GET /api/public/pricing` as authoritative for prices. The table below is **indicative only**:

| Endpoint | Indicative USD |
|---|---|
| `/v1/markets` | 0.005 |
| `/v1/markets/mispriced` | 0.05 |
| `/v1/markets/lookup` | 0.005 |
| `/v1/markets/{slug}/forecast` | 0.01 |
| `/v1/markets/{slug}/intelligence` | 0.025 |
| `/v1/markets/{slug}/signals` | 0.025 |
| `/v1/sources` | 0.01 |
| `/v1/signals` | 0.02 |
| `/v1/signals/featured` | 0.01 |
| `/v1/signals/oil` | 0.025 |
| `/v1/portfolio` | 0.0025 |
| `/v1/narratives` | 0.01 |
| `/v1/signal-score` | 0.005 |

## Pagination Contract

- `cursor` is opaque; pass it exactly as returned.
- Cursor values are bound to endpoint + sort + active filters.
- Reusing a cursor with different filters/sort returns `422 invalid_cursor`.
- Loop until `has_more` is false.

## Endpoints

All market-shaped responses include `quotientUrl` and `polymarketUrl` (canonical Polymarket event page, or `null` when no linked event is known).

### GET /api/v1/markets

List covered markets with forecast status. Sorted catalog — there is no free-text search; grep `question`/`slug` client-side.

```bash
bankr x402 call "${QUOTIENT_BASE_URL:-https://quotient-api-gateway.onrender.com}/api/v1/markets?sort=updated_desc&limit=2" \
  --max-payment 0.005 --raw
```

| Param | Type | Default | Constraints |
|---|---|---|---|
| `topic` | string | — | category/tag name, case-insensitive |
| `max_forecast_age` | int hours | 48 | ≥ 1; window for `forecast_count`/`latest_forecast_at` |
| `sort` | string | `updated_desc` | `updated_desc` \| `volume_desc` \| `signal_count_desc` |
| `changed_within` | int hours | — | 1–168; only markets whose latest forecast is newer than this |
| `cursor` | string | — | opaque |
| `limit` | int | 20 | 1–50 |

```json
{
  "markets": [
    {
      "slug": "russia-x-ukraine-ceasefire-in-2026",
      "question": "Russia x Ukraine ceasefire in 2026?",
      "end_date": "2026-12-31T12:00:00Z",
      "market_odds": 0.36,
      "inDispute": false,
      "clarifications": null,
      "volume_24h": 184233.5,
      "signal_count": 41,
      "forecast_count": 2,
      "latest_forecast_at": "2026-08-01T10:14:03Z",
      "market_updated_at": "2026-08-01T15:50:12Z",
      "latest_forecast_delta": -0.04,
      "latest_forecast_refresh_reason": "price_move",
      "quotientUrl": "https://quotient.social/market/512345",
      "polymarketUrl": "https://polymarket.com/event/russia-x-ukraine-ceasefire-in-2026"
    }
  ],
  "next_cursor": "eyJlbmRwb2ludCI6Im1hcmtldHMiLC4uLn0",
  "has_more": true
}
```

| Field | Notes |
|---|---|
| `market_odds` | current YES odds, 0–1 |
| `latest_forecast_delta` | latest forecast's probability change vs its prior (0–1 scale); non-zero = Q moved |
| `latest_forecast_refresh_reason` | non-null = the forecast reran off a trigger (e.g. price move), not just schedule |
| `changed_within` vs `max_forecast_age` | independent: `changed_within` filters on the latest forecast overall; `max_forecast_age` only windows the counts |

### GET /api/v1/markets/mispriced

Markets where Quotient's odds diverge from market odds. Only markets with YES odds in the 0.10–0.80 band are eligible.

```bash
bankr x402 call "${QUOTIENT_BASE_URL:-https://quotient-api-gateway.onrender.com}/api/v1/markets/mispriced?min_spread=0.08&limit=2" \
  --max-payment 0.05 --raw
```

| Param | Type | Default | Constraints |
|---|---|---|---|
| `min_spread` | float | 0.05 | 0–1 |
| `max_forecast_age` | int hours | 48 | ≥ 1 |
| `sort` | string | `spread_desc` | `spread_desc` \| `spread_asc` \| `volume_desc` \| `updated_desc` |
| `cursor` | string | — | opaque |
| `limit` | int | 20 | 1–50 |

```json
{
  "markets": [
    {
      "slug": "russia-x-ukraine-ceasefire-in-2026",
      "question": "Russia x Ukraine ceasefire in 2026?",
      "end_date": "2026-12-31T12:00:00Z",
      "quotient_odds": 0.29,
      "market_odds": 0.36,
      "inDispute": false,
      "clarifications": null,
      "bluf": "Negotiation preconditions have hardened; no credible path to a 2026 ceasefire.",
      "spread": 0.07,
      "spread_direction": "q_lower",
      "volume_24h": 184233.5,
      "last_updated": "2026-08-01T10:14:03Z",
      "signal_count": 41,
      "quotientUrl": "https://quotient.social/market/512345",
      "polymarketUrl": "https://polymarket.com/event/russia-x-ukraine-ceasefire-in-2026"
    }
  ],
  "next_cursor": null,
  "has_more": false
}
```

| Field | Notes |
|---|---|
| `spread` | `abs(quotient_odds − market_odds)`, 0–1 |
| `spread_direction` | `q_higher` (Q above market) \| `q_lower` |

### GET /api/v1/markets/lookup

Batch lookup by identifier. Returns full intelligence objects (same schema as `/markets/{slug}/intelligence`) per match.

```bash
bankr x402 call "${QUOTIENT_BASE_URL:-https://quotient-api-gateway.onrender.com}/api/v1/markets/lookup?slugs=russia-x-ukraine-ceasefire-in-2026,fed-rate-cut-september" \
  --max-payment 0.005 --raw
```

| Param | Type | Default | Constraints |
|---|---|---|---|
| `slugs` | csv string | — | max 10; use exactly one of `slugs` / `condition_ids` |
| `condition_ids` | csv string | — | max 10 |

```json
{
  "results": [ { "slug": "russia-x-ukraine-ceasefire-in-2026", "...": "see /intelligence schema" } ],
  "not_found": ["fed-rate-cut-september"]
}
```

### GET /api/v1/markets/{slug}/forecast

Latest forecast plus optional prior history for diffing. Cheaper than `/intelligence` — no drivers/citations/sentiment joins.

```bash
bankr x402 call "${QUOTIENT_BASE_URL:-https://quotient-api-gateway.onrender.com}/api/v1/markets/russia-x-ukraine-ceasefire-in-2026/forecast?history=1" \
  --max-payment 0.01 --raw
```

| Param | Type | Default | Constraints |
|---|---|---|---|
| `history` | int | 0 | 0–10 prior forecasts returned in `history[]` |

```json
{
  "market_slug": "russia-x-ukraine-ceasefire-in-2026",
  "question": "Russia x Ukraine ceasefire in 2026?",
  "market_odds": 0.36,
  "end_date": "2026-12-31T12:00:00Z",
  "quotientUrl": "https://quotient.social/market/512345",
  "polymarketUrl": "https://polymarket.com/event/russia-x-ukraine-ceasefire-in-2026",
  "forecast": {
    "id": "fc_9f2c1a",
    "probability": 0.29,
    "created_at": "2026-08-01T10:14:03Z",
    "headline": "Ceasefire odds slip as preconditions harden",
    "bluf": "Negotiation preconditions have hardened; no credible path to a 2026 ceasefire.",
    "crux": "Whether either side accepts territorial status quo as a talks baseline.",
    "delta_from_prior": -0.04,
    "delta_reasoning": "Down 4 points after the Kremlin ruled out talks before autumn.",
    "prior_forecast_id": "fc_8e11b0",
    "refresh_reason": "price_move",
    "refresh_triggered_by": "pm-odds-monitor",
    "conviction_tier": 3,
    "draw_std_log_odds": 0.18,
    "draw_count": 5,
    "band25": 0.24,
    "band75": 0.33
  },
  "history": [ { "id": "fc_8e11b0", "probability": 0.33, "created_at": "2026-07-31T10:02:44Z", "...": "same shape" } ]
}
```

Known market with no coverage yet → `200` with `forecast: null`, `history: []`, and a `message`. Unknown slug → `404 invalid_market`.

| Field | Notes |
|---|---|
| `probability` | canonical Q, 0–1 (YES) |
| `delta_from_prior` / `delta_reasoning` | precomputed diff vs `prior_forecast_id`; `delta_reasoning` is a deterministic sentence, safe to quote verbatim |
| `refresh_reason` / `refresh_triggered_by` | non-null = triggered rerun (price move, catalyst), not scheduled |
| `conviction_tier` | 1–3 from ensemble draw dispersion (`draw_std_log_odds` across `draw_count` independent draws) — NOT the Q-vs-market spread. 3 = tight self-agreement |
| `band25` / `band75` | interquartile band of the ensemble draws, 0–1 |

### GET /api/v1/markets/{slug}/intelligence

Full intelligence briefing for one market: forecast odds, BLUF, key drivers with citations, article reads, sentiment.

```bash
bankr x402 call "${QUOTIENT_BASE_URL:-https://quotient-api-gateway.onrender.com}/api/v1/markets/russia-x-ukraine-ceasefire-in-2026/intelligence" \
  --max-payment 0.025 --raw
```

No params.

```json
{
  "slug": "russia-x-ukraine-ceasefire-in-2026",
  "question": "Russia x Ukraine ceasefire in 2026?",
  "end_date": "2026-12-31T12:00:00Z",
  "quotient_odds": 0.29,
  "market_odds": 0.36,
  "inDispute": false,
  "clarifications": null,
  "bluf": "Negotiation preconditions have hardened; no credible path to a 2026 ceasefire.",
  "last_updated": "2026-08-01T10:14:03Z",
  "volume_24h": 184233.5,
  "quotientUrl": "https://quotient.social/market/512345",
  "polymarketUrl": "https://polymarket.com/event/russia-x-ukraine-ceasefire-in-2026",
  "key_drivers": [
    { "factor": "Kremlin ruled out pre-autumn talks", "direction": "against", "impact": "significant", "citation": "https://example-news.com/kremlin-talks" }
  ],
  "signals": [
    { "title": "Kremlin rules out talks before autumn", "comment": "Hardens the no-ceasefire base case.", "direction": "no" }
  ],
  "sentiment": { "pct_bullish": 22, "pct_bearish": 63, "pct_neutral": 15 }
}
```

### GET /api/v1/markets/{slug}/signals — article reads

Paginated **article-opinion reads** for one market (the pre-v5 "signals"). Not trade signals — those are at `/api/v1/signals`.

```bash
bankr x402 call "${QUOTIENT_BASE_URL:-https://quotient-api-gateway.onrender.com}/api/v1/markets/russia-x-ukraine-ceasefire-in-2026/signals?limit=5" \
  --max-payment 0.025 --raw
```

| Param | Type | Default | Constraints |
|---|---|---|---|
| `cursor` | string | — | opaque |
| `limit` | int | 10 | 1–50 |

```json
{
  "market_slug": "russia-x-ukraine-ceasefire-in-2026",
  "quotientUrl": "https://quotient.social/market/512345",
  "polymarketUrl": "https://polymarket.com/event/russia-x-ukraine-ceasefire-in-2026",
  "signals": [
    { "title": "Kremlin rules out talks before autumn", "comment": "Hardens the no-ceasefire base case.", "direction": "no" }
  ],
  "sentiment": { "pct_bullish": 22, "pct_bearish": 63, "pct_neutral": 15 },
  "next_cursor": null,
  "has_more": false,
  "total": 41
}
```

### GET /api/v1/sources

Batch recent-source feed (articles + X posts) for up to 10 markets in one call. There is no per-market sources path — always use this endpoint with `markets=`.

```bash
bankr x402 call "${QUOTIENT_BASE_URL:-https://quotient-api-gateway.onrender.com}/api/v1/sources?markets=russia-x-ukraine-ceasefire-in-2026&window=48&types=article,x_post" \
  --max-payment 0.01 --raw
```

| Param | Type | Default | Constraints |
|---|---|---|---|
| `markets` | csv string | — | **required**; 1–10 market slugs |
| `window` | int hours | 48 | 1–168 |
| `types` | csv string | both | subset of `article,x_post` |
| `cursor` | string | — | opaque |
| `limit` | int | 20 | 1–50 |

```json
{
  "sources": [
    {
      "type": "article",
      "market_slug": "russia-x-ukraine-ceasefire-in-2026",
      "title": "Kremlin rules out talks before autumn",
      "url": "https://example-news.com/kremlin-talks",
      "source_name": "Reuters",
      "feed_tier": "primary",
      "published_at": "2026-08-01T07:40:00Z",
      "relevance": {
        "confidence": "high",
        "reasoning": "Directly addresses the ceasefire negotiation timeline.",
        "evidence_quote": "No conditions exist for negotiations before autumn."
      },
      "author_handle": null,
      "is_expert": null
    },
    {
      "type": "x_post",
      "market_slug": "russia-x-ukraine-ceasefire-in-2026",
      "title": null,
      "url": "https://x.com/osint_account/status/1950000000000000000",
      "source_name": null,
      "feed_tier": "specialist",
      "published_at": "2026-07-31T22:10:00Z",
      "relevance": {
        "confidence": "interesting",
        "reasoning": "First-hand report on frontline posture relevant to ceasefire feasibility.",
        "evidence_quote": "Rotation activity continues on both axes."
      },
      "author_handle": "osint_account",
      "is_expert": true
    }
  ],
  "next_cursor": null,
  "has_more": false
}
```

| Field | Notes |
|---|---|
| `feed_tier` | source tier: `primary` \| `specialist` \| `secondary` |
| `published_at` | ordering key (desc). X posts are **windowed** on when Quotient last saw them linked to the market but **ordered** on publish time — an older post recently re-linked can appear |
| `relevance` | why Quotient correlated the source to the market; for `x_post` rows it derives from the post's relevance annotation, and `confidence` is the edge's materiality defaulting to `"interesting"` — never null (null occurs only on `article` rows) |
| `is_expert` | X only: author is on Quotient's reviewed expert list |

### GET /api/v1/signals — trade signals

Active Quotient trade signals whose latest market forecast was updated inside the requested window, live-priced against CLOB midpoints with derived status/conviction/convergence. Publication and forecast freshness are separate: an older published signal can remain active for up to seven days and become fresh again when Q updates its forecast. The feed returns at most one signal per market. This is the v5 semantics of this path (see Breaking change above).

```bash
bankr x402 call "${QUOTIENT_BASE_URL:-https://quotient-api-gateway.onrender.com}/api/v1/signals?window=24&status=actionable&min_conviction=2" \
  --max-payment 0.02 --raw
```

| Param | Type | Default | Constraints |
|---|---|---|---|
| `window` | int hours | 24 | 1–168; latest-forecast update lookback, not signal age |
| `status` | csv string | `actionable,unconfirmed` | subset of `actionable,unconfirmed,paused,done,retired`; pass an explicit set for lifecycle/history reads |
| `side` | string | both | `YES` \| `NO` |
| `market` | string | — | single market slug |
| `min_conviction` | int | — | 1–3; keeps `conviction_tier ≥` value |
| `min_capacity_usd` | float | — | ≥ 0; keeps `capacity_usd_at_2c ≥` value, or null-capacity rows with `capacity_basis: "volume-fallback"` |
| `cursor` | string | — | opaque |
| `limit` | int | 20 | 1–50 |

The candidate pool spans the full seven-day active hold window. For each market, the API first selects the newest published signal (`published_at DESC`, then signal ID); side/status/conviction/capacity filters never fall back to an older signal when that newest call is ineligible. `window` then filters on the market's latest forecast update. Status/conviction/capacity filters are applied **after** the live pricing overlay, so they reflect current prices. The default feed omits `paused`, `done`, and `retired` rows. Sort is `forecast_updated_at DESC`, then signal ID.

```json
{
  "signals": [
    {
      "id": "qs_a41d2c",
      "created_at": "2026-07-31T14:17:22Z",
      "published_at": "2026-07-31T14:17:22Z",
      "forecast_updated_at": "2026-08-03T16:20:00Z",
      "is_new_today": false,
      "is_fresh": true,
      "is_active": true,
      "side": "NO",
      "entry_q": 29,
      "entry_pm": 38,
      "entry_spread_pp": 9,
      "window_days": 30,
      "resolves_in_window": false,
      "status": "actionable",
      "retired_reason": null,
      "conviction_tier": 3,
      "conviction": "high",
      "has_band": true,
      "latest_q": 0.29,
      "q_side": "NO",
      "q_value_cents": 71,
      "entry_cost_cents": 62,
      "current_cost_cents": 64,
      "distance_to_convergence_cents": 7,
      "converge_upside_pct": 11,
      "live_priced": true,
      "priced_at": "2026-08-01T16:03:11.482Z",
      "capacity_usd_at_2c": 5400,
      "capacity_available": true,
      "capacity_basis": "depth-2c",
      "capacity_as_of": "2026-08-01T09:12:00Z",
      "market": {
        "slug": "russia-x-ukraine-ceasefire-in-2026",
        "question": "Russia x Ukraine ceasefire in 2026?",
        "condition_id": "0x8a3f5b9c1e2d4f60718293a4b5c6d7e8f90123456789abcdef0123456789abcd",
        "end_date": "2026-12-31T12:00:00Z",
        "market_odds": 0.36,
        "volume_24h": 184233.5,
        "quotientUrl": "https://quotient.social/market/512345",
        "polymarketUrl": "https://polymarket.com/event/russia-x-ukraine-ceasefire-in-2026"
      }
    }
  ],
  "next_cursor": null,
  "has_more": false
}
```

| Field | Notes |
|---|---|
| `published_at` / `created_at` | signal publication time; `created_at` is a deprecated compatibility alias |
| `forecast_updated_at` | creation time of Q's latest forecast for the market; this is the timestamp filtered by `window` and used for feed ordering |
| `is_new_today` | `true` only when the signal itself was published on the current UTC calendar day |
| `is_fresh` | `true` when `forecast_updated_at` is no more than six hours old; independent of publication age |
| `is_active` | `true` while the signal is non-terminal; an active signal can be several days old and either fresh or stale |
| `status` | `actionable` (live, passes all gates) · `unconfirmed` (Q's latest forecast flipped side vs its prior — held one cycle for confirmation) · `paused` (temporarily unavailable after deep drawdown, venue divergence, or a safety veto while losing) · `done` (**converged**: converge upside ≤ 0, thesis played out) · `retired` (terminal; see `retired_reason`) |
| `retired_reason` | only when `status: "retired"` — `resolved` (market closed/past end) · `flipped` (Q's majority call changed vs entry) · `fading_q` (Q for the trade side ≤ 50%) · `expired` (past the hold window: min(publish + 7d, resolution)) |
| `entry_q` / `entry_pm` | frozen at publish, 0–100 YES scale (Q's probability / market YES price) |
| `entry_spread_pp` | raw `abs(entry_q − entry_pm)` in percentage points — unsigned edge at publish |
| `conviction_tier` / `conviction` | 1–3 (`low`/`medium`/`high`) from **ensemble draw dispersion** — self-agreement of the forecaster's independent draws — NOT the Q-vs-market spread. `has_band` is `false` only when no conviction read could be computed at all (missing Q or price); pre-ensemble inferred reads (fewer than 2 draws) still report `has_band: true` with tier capped at 2 — an inferred read, not a measured dispersion band |
| `latest_q` | Q's current probability, 0–1 (contrast with 0–100 entry fields) |
| `q_side` | side implied by Q's **latest** forecast vs current price — may differ from the signal's entry `side` |
| `q_value_cents` | Q's value: what the position is worth per share if the market converges to Q, in Q-side cents |
| `entry_cost_cents` / `current_cost_cents` | cost of the Q-side share at publish / now, cents |
| `distance_to_convergence_cents` | Q-side cents from current cost to the convergence goal (Q's value, or 100¢ when `resolves_in_window`); **≤ 0 means converged** |
| `converge_upside_pct` | % remaining on current cost to the goal; ≤ 0 → `status: "done"` |
| `resolves_in_window` | `window_days ≤ 7`: can be held to resolution, so the goal is a full 100¢ win |
| `live_priced` / `priced_at` | `true` = convergence fields priced from live CLOB midpoints at `priced_at`; `false` = graph-odds fallback and `priced_at` is the market's last graph update — treat as stale |
| `capacity_usd_at_2c` | persisted notional observed within 2¢ of touch on the signal side, refreshed ~every 12h (`capacity_as_of`); `null` = no depth snapshot. It is not a guaranteed fill or exact price-impact estimate; re-read the live book before trading |
| `capacity_basis` | `depth-2c` (snapshot present) · `volume-fallback` (snapshot null but `market.volume_24h ≥ 5000`) · `null` (no basis — treat capacity as unknown-thin) |

### GET /api/v1/signals/featured

The single featured signal: an operator pin when set (and still healthy), else auto-picked from active actionable, live-priced signals whose latest forecast update is inside `window` and which clear volume/expiry floors. The server owns the pick — never re-implement it.

```bash
bankr x402 call "${QUOTIENT_BASE_URL:-https://quotient-api-gateway.onrender.com}/api/v1/signals/featured" \
  --max-payment 0.01 --raw
```

| Param | Type | Default | Constraints |
|---|---|---|---|
| `window` | int hours | 24 | 1–168; latest-forecast update lookback for auto-pick candidates |

```json
{
  "signal": { "id": "qs_a41d2c", "...": "identical shape to a /v1/signals item" },
  "featured_by": "auto"
}
```

No qualifying signal → `200` with `{ "signal": null, "featured_by": null, "message": "..." }`. Never substitute a stale pick when empty.

### GET /api/v1/signals/oil

The WTI crude read: the latest frozen daily reading plus live venue marks (Polymarket perps `WTIOIL-USD`, Hyperliquid `xyz:CL`). The reading is not recomputed live — freshness is disclosed, check it.

```bash
bankr x402 call "${QUOTIENT_BASE_URL:-https://quotient-api-gateway.onrender.com}/api/v1/signals/oil?include_marks=true" \
  --max-payment 0.025 --raw
```

| Param | Type | Default | Constraints |
|---|---|---|---|
| `include_marks` | bool | true | `false` skips live venue marks |

```json
{
  "asset": "crude-wti",
  "reading": {
    "id": "crude-wti:2026-08-01",
    "reading_date": "2026-08-01",
    "is_current": true,
    "days_since_reading": 0,
    "state": "bearish",
    "side": "short",
    "z": -1.62,
    "gap": -0.041,
    "intensity": "high",
    "basis_forecasts": 14,
    "basis_markets": 9,
    "headline": "Supply-side reads keep pressure on crude",
    "summary": "Forecast-implied balance sits below the curve across the basis set.",
    "formula_version": "v3"
  },
  "episode": {
    "id": "ep_2026-07-28_short",
    "opened_at": "2026-07-28",
    "days": 4,
    "status": "open",
    "ref_price": 86.9,
    "outcome_price": null,
    "outcome_at": null,
    "return_pct": null,
    "live_return_pct": 1.2
  },
  "marks": {
    "polymarket_perps": {
      "symbol": "WTIOIL-USD",
      "mark": 85.835,
      "index": 86.23,
      "funding_rate": -0.0002832,
      "at": "2026-08-01T16:03:11Z"
    },
    "hyperliquid": { "coin": "xyz:CL", "mid": 85.815, "at": "2026-08-01T16:03:11Z" }
  },
  "degraded": false,
  "reading_missing": false
}
```

| Field | Notes |
|---|---|
| `reading` | frozen daily read; `is_current: false` / `days_since_reading > 0` = stale — treat as reduced-quality. `reading_missing: true` → `reading: null` |
| `z` / `gap` / `intensity` | standardized divergence, raw forecast-vs-market gap, and its bucketed strength |
| `basis_forecasts` / `basis_markets` | how many forecasts/markets fed the reading |
| `episode` | consecutive same-side run; `status: "open"` → `live_return_pct` marks `ref_price` to the current mark (signed by `side`); closed → `return_pct`/`outcome_price` final |
| `marks` | live at read time; `funding_rate` is hourly. Venue identifiers are served (`WTIOIL-USD`, `xyz:CL`) — do not hardcode your own mapping |
| `degraded` | `true` when any mark upstream failed (that block is `null`). This endpoint **never returns 502** — it degrades |

### GET /api/v1/portfolio

Wallet intelligence: Polymarket positions (live data-api prices) joined server-side to Quotient coverage — forecast, signal, and convergence per position, in one call.

```bash
bankr x402 call "${QUOTIENT_BASE_URL:-https://quotient-api-gateway.onrender.com}/api/v1/portfolio?wallet=0xEE4E0EB3A626713F5Efa98DB422fA73FdD1e94b8" \
  --max-payment 0.0025 --raw
```

| Param | Type | Default | Constraints |
|---|---|---|---|
| `wallet` | string | — | **required**; `^0x[0-9a-fA-F]{40}$` |
| `size_threshold` | number | 1 | minimum position size (shares) to include |
| `include_perps` | bool | false | append the perps + oil annex |

```json
{
  "wallet": "0xee4e0eb3a626713f5efa98db422fa73fdd1e94b8",
  "as_of": "2026-08-01T16:03:11Z",
  "value_usd": 1243.87,
  "positions_count": 6,
  "covered_count": 4,
  "unmatched_count": 2,
  "positions_capped": false,
  "positions": [
    {
      "condition_id": "0x8a3f5b9c1e2d4f60718293a4b5c6d7e8f90123456789abcdef0123456789abcd",
      "title": "Russia x Ukraine ceasefire in 2026?",
      "slug": "russia-x-ukraine-ceasefire-in-2026",
      "event_slug": "russia-x-ukraine-ceasefire-in-2026",
      "outcome": "No",
      "size": 120.5,
      "avg_price": 0.58,
      "cur_price": 0.64,
      "current_value_usd": 77.12,
      "cash_pnl": 7.23,
      "percent_pnl": 10.34,
      "redeemable": false,
      "end_date": "2026-12-31T12:00:00Z",
      "quotient": {
        "covered": true,
        "market": {
          "slug": "russia-x-ukraine-ceasefire-in-2026",
          "question": "Russia x Ukraine ceasefire in 2026?",
          "quotientUrl": "https://quotient.social/market/512345",
          "polymarketUrl": "https://polymarket.com/event/russia-x-ukraine-ceasefire-in-2026"
        },
        "forecast": {
          "id": "fc_9f2c1a",
          "probability": 0.29,
          "created_at": "2026-08-01T10:14:03Z",
          "delta_from_prior": -0.04,
          "refresh_reason": "price_move",
          "bluf": "Negotiation preconditions have hardened; no credible path to a 2026 ceasefire.",
          "conviction_tier": 3
        },
        "signal": {
          "id": "qs_a41d2c",
          "side": "NO",
          "created_at": "2026-07-31T14:17:22Z",
          "status": "actionable",
          "retired_reason": null
        },
        "convergence": {
          "q_value_cents": 71,
          "entry_cost_cents": 62,
          "current_cost_cents": 64,
          "distance_to_convergence_cents": 7,
          "converge_upside_pct": 11,
          "aligned": true,
          "q_side": "NO",
          "priced_at": "2026-08-01T16:03:11Z"
        }
      }
    }
  ],
  "unmatched": [
    { "condition_id": "0xdeadbeef00000000000000000000000000000000000000000000000000000000", "title": "Album of the year 2026", "slug": "album-of-the-year-2026" }
  ],
  "perps": {
    "positions": [
      { "symbol": "WTIOIL-USD", "size": -12.4, "entry_price": 86.1, "unrealized_pnl": 3.29, "return_on_equity": 0.062 }
    ],
    "equity": 512.4,
    "oil_signal": { "state": "bearish", "z": -1.62, "intensity": "high", "reading_date": "2026-08-01" }
  }
}
```

| Field | Notes |
|---|---|
| `quotient.covered` | `false` = no Quotient market matched, or a non-Yes/No outcome — `forecast`/`signal`/`convergence` are null |
| `convergence.aligned` | your position side equals Q's current side (`q_side`). `false` = Q reads the other way — surface these first |
| `convergence.*_cents` | same semantics as `/v1/signals`: Q-side cents; `distance_to_convergence_cents ≤ 0` = converged |
| price basis | `cur_price`/values come live from the Polymarket data-api; `convergence.priced_at` stamps the pricing moment |
| `positions_capped` | `true` when the wallet exceeded the 1500-row fetch cap — the list is truncated |
| `perps` | present only with `include_perps=true`; degrades independently — on upstream failure the block carries `"error": "upstream_unavailable"` instead of failing the request |
| failure mode | if the Polymarket data-api itself is down the endpoint returns **`502 upstream_unavailable`** (fail-closed — never a partial position list) |

Advisory: all portfolio reads are informational, derived from Quotient's forecasts — not trade instructions.

### GET /api/v1/narratives

Quotient narratives created in the last `hours` hours (default 24), each with linked markets.

```bash
bankr x402 call "${QUOTIENT_BASE_URL:-https://quotient-api-gateway.onrender.com}/api/v1/narratives" \
  --max-payment 0.01 --raw
```

| Param | Type | Default | Constraints |
|---|---|---|---|
| `hours` | int | 24 | 1–168; lookback window for narrative creation; out of range → `422 invalid_request` |

```json
{
  "narratives": [
    {
      "bluf": "Energy markets are repricing supply risk faster than macro markets.",
      "body": "…",
      "summary": "…",
      "title": "Crude leads, macro lags",
      "createdAt": "2026-08-01T06:00:00Z",
      "markets": [
        {
          "slug": "wti-above-90-in-september",
          "conditionId": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
          "question": "WTI above $90 in September?",
          "direction": "no",
          "quotientUrl": "https://quotient.social/market/518890",
          "polymarketUrl": "https://polymarket.com/event/wti-above-90-in-september"
        }
      ]
    }
  ],
  "count": 1
}
```

### GET /api/v1/signal-score

Signal score for a Farcaster user.

```bash
bankr x402 call "${QUOTIENT_BASE_URL:-https://quotient-api-gateway.onrender.com}/api/v1/signal-score?fid=3621" \
  --max-payment 0.005 --raw
```

| Param | Type | Default | Constraints |
|---|---|---|---|
| `fid` | int | — | **required**; positive Farcaster id |

```json
{ "fid": 3621, "signal_score": 74.21, "snapshot_timestamp": "2026-08-01T04:00:00Z" }
```

`404 not_found` when no score exists for the fid.

## Common Error Codes

- `401 gateway_required`
- `402 payment_required`
- `404 invalid_market` / `404 not_found`
- `422 invalid_request` / `422 invalid_cursor`
- `429 rate_limited`
- `502 upstream_unavailable` (portfolio only; oil degrades instead)

Full contract and retry guidance: `error-handling.md`.
