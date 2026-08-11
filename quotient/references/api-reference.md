<!-- GENERATED from public/skill/references/api-reference.md — edit there, then npm run skill:build -->

# Quotient API Reference (Skill-Focused)

Base URL: `${QUOTIENT_BASE_URL:-https://quotient-api-gateway.onrender.com}` — use this single origin for runtime requests and discovery (`/openapi.json`, `/api/public/pricing`, `/llms.txt`, `/skill/*`).

Canonical schemas: `https://quotient-api-gateway.onrender.com/openapi.json`. All reads are informational intelligence, not trade instructions. "Q's value" = the price implied by Quotient's latest forecast on the signal side.

## Data coverage and identity

- Prediction-market intelligence spans `polymarket` (Polymarket International),
  `polymarket_us` (Polymarket US), `kalshi`, and `limitless`. Catalog/search contain
  Q-covered rows rather than complete venue catalogs.
- Prefer `marketKey` for cross-venue identity. Preserve `venue`, `nativeMarketId`,
  `nativeEventId`, `seriesTicker`, `marketUrl`, and `sourceUrl`; never infer the venue from
  an ID or turn `sourceUrl` into a navigation link. `slug` and `marketUrl` may be null.
- Underlyings are canonical `:Asset:Entity` nodes with UUID `id`, namespaced `assetKey`,
  name/ticker aliases, and exact platform identifiers. `HAS_MARKET` links them directly
  to relevant prediction markets while preserving every Market's venue routing.
- `/assets` is the metadata-only directory. `/assets/search` resolves a name, ticker,
  canonical/platform identity, or linked-market reference and returns every active direct
  market with venue odds and latest Q when available. It excludes causal `AFFECTS`-only
  rows and never creates an Asset-level probability.
- Underlying linkage is broader than signal publication. `/signals/oil` returns the daily
  WTI signal with live marks; `/signals/perps` returns it in standard signal-list format.
  `/portfolio` reads wallet-addressed positions on Polymarket, Polymarket perps, Limitless,
  and Hyperliquid; its venue list is an integration limit, not the forecast-coverage boundary.

## v11 relationship envelopes

Enriched Asset, Market, Forecast, and Signal objects include `relationships` with
`assets`, `markets`, `signals`, and per-category `truncated` flags. Each list is capped at
50 lightweight, non-recursive refs. `relationship` is the exact final graph edge and
`via: direct` is one hop; `via: market|asset` is one explicit two-hop path, whose
`direction` is relative to that intermediate node.

The envelope intentionally has no Forecast-ref category. It contains no forecast or venue
probability, aggregate Asset direction, or inferred causal `AFFECTS` edge. The metadata-only
`GET /assets` directory remains unchanged; enriched Asset search carries relationships.

## Hawk & Dove Index versus perp endpoints

The Hawk & Dove Index (Quotient Stability Index) is a 0–100 macro-regime indicator built from
conflict and diplomacy markets. Lower means more hawkish/escalatory; higher means more
dovish/de-escalatory. This terminology is geopolitical, not a central-bank-policy score.

The index is useful as discretionary context for risk-sensitive assets beyond the active
perp list, including assets without a published factor series. Do not turn its level or
change into a fixed cross-asset long/short rule: polarity, threshold, and holding period
must be validated per asset. The current index research covers one conflict cycle; for
crude, large moves in either direction were a volatility cue rather than direction.

Keep the access and construction boundaries explicit:

- In the Quotient playground, `get_hawk_dove_index` is a free local tool. It is neither
  a public `/api/v1` route nor a third perp signal endpoint, so never invent an API path.
- `GET /api/v1/signals/oil` returns the daily WTI signal with optional live marks.
  `GET /api/v1/signals/perps` returns the WTI signal in standard signal-list format.
  `GET /api/v1/portfolio?include_perps=true` only annexes a wallet's
  Polymarket perps positions; it is not a signal surface.
- The headline index and WTI signal use related conflict/diplomacy forecast data,
  but they are different series. The WTI formula does not mechanically map the headline
  level into direction.

## v10 Asset discovery

- `GET /api/v1/assets` returns the complete metadata-only Asset directory. It has no
  linked markets, venue odds, forecasts, Q probabilities, or signals.
- `GET /api/v1/assets/search` accepts `q`, repeatable exact `reference`, or
  `material_only=true` alone. It costs the same as plain market search.
- `material_only=true` filters Assets by at least one direct active market with venue odds
  or latest Q. It does not prune other active direct links, and published-signal existence
  alone is not the materiality rule.

## v8.1 market discovery

- `GET /api/v1/markets/search` searches only active markets covered by Quotient, using an
  always-on graph text/tag lane plus optional Typesense lexical/typo and embedding lanes.
- `/markets` and `/markets/search` rows expose parent `event`, `tags`, and `categories`.
  Exact `topic` matching includes direct Event tags even when they have no Category.

## v6 additions

- `POST /api/v1/x/search` provides bounded, structured Grok 4.5 X research. Results are
  citation-grounded and are not persisted by Quotient.
- `GET /api/v1/latest` is a board-wide update feed, returned complete for its window.
- Forecast-bearing response objects include `thesis` and `resolution_pathway`
  (`criteria`, `crux`, `deadline`, `source`) with compact venue/market metadata.
- Paid-route price and rate metadata are generated from canonical OpenAPI into
  `contract-prices.json`; do not maintain a second prose price table.

## Breaking change (v5)

`GET /api/v1/signals` now serves **published Quotient trade signals** (`QuotientSignal`). The old article-opinion feed at that path is gone; article evidence remains at `GET /api/v1/markets/{slug}/signals`. Old clients of `/v1/signals` must migrate.

## Access and Authorization

- Monetized requests accept either `x-quotient-api-key: qt_...` (prepaid credits) or x402
  pay-per-call (`402` challenge → sign → retry; see `bankr-x402-flow.md` /
  `vanilla-x402-flow.md`). Set `QUOTIENT_API_KEY` and use the vendored scripts to keep the
  secret out of argv and logs; they automatically prefer the key when present.
- A raw API-key request looks like this (do not paste the expanded command into logs):

  ```bash
  curl -sS -H @- \
    "${QUOTIENT_BASE_URL:-https://quotient-api-gateway.onrender.com}/api/v1/markets" \
    <<< "x-quotient-api-key: $QUOTIENT_API_KEY"
  ```

- The examples use `bankr x402 call` with an explicit USD payment cap. Set
  `MAX_PAYMENT_USD` to the matching operation value in
  `references/contract-prices.json`; agents with another
  x402-compatible wallet should make the equivalent paid request through their client;
  key users can substitute the header pattern above.
- Every example pins `--max-payment` to the route's reviewed local baseline, so a raised gateway
  price fails closed instead of overpaying — on a payment-cap failure re-read
  `GET /api/public/pricing` and get fresh user approval; never blindly raise the cap. The
  vendored scripts go further: they pre-flight each route's 402 challenge (a free read),
  validate the pinned payment tuple (network, asset, payee, expiry), and cap at the live
  price under a pinned ceiling of 2× the reviewed local operation price
  (`references/payments-policy.md`).
- The examples deliberately omit `-y`/`--yes` (which skips the Bankr CLI's own payment
  confirmation). In non-interactive agent runtimes, run reads through
  `scripts/quotient.sh` instead — it enforces the host allowlist, per-route caps, spend
  ledger, and the payment protocol in `SKILL.md`, and adds `--yes` only for an authorized
  spend.
- Treat the runtime `402` challenge and `GET /api/public/pricing` as authoritative for
  live prices. The generated `operation_prices_usd` values in `contract-prices.json` are
  the reviewed local baselines and payment ceilings; OpenAPI `x-payment-info.price` owns
  the source value. API-key credit conversion is also recorded in that artifact.

## Rate Limits

Rate limits are enforced at the public gateway before credits are debited, an x402 payment is
settled, or the upstream API/X provider is called. Do not parallelize requests for one caller.

| Policy scope | Per second | Per minute | Per UTC day | Max in flight |
|---|---:|---:|---:|---:|
| `standard` — all non-X payable endpoints, including `/latest` | 1 | 30 | 5,000 | 1 |
| `x_research` — `/x/search`, `/x/profile` | 1 | 6 | 100 | 1 |

The one-second start interval and concurrency guard apply across scopes for the same caller.
Minute counters reset on the next minute boundary; daily counters reset at `00:00 UTC`. API-key
quota is keyed to the customer, so rotating keys on one account does not add capacity. x402 is
keyed to the verified payer when available, with a normalized client-IP fallback. A secondary
anti-key-spray IP guard allows 3 requests/second, 90/minute, and 10,000/day; it is protective,
not extra caller quota, and Quotient may tighten it during active abuse.

The initial request that obtains an unsigned `402` challenge counts only against the loose IP
abuse guard, not the customer/payer quota. Its signed x402 retry counts against both. Authorized
or admitted attempts count even if they later receive insufficient-credits or upstream errors. A
`429` itself is never charged or settled.

Successful admitted responses and most admitted errors include:

- `RateLimit-Policy`: all active quota windows, for example
  `"standard-second";q=1;w=1, "standard-minute";q=30;w=60, "standard-day";q=5000;w=86400`.
- `RateLimit`: remaining requests (`r`) and seconds to reset (`t`) for those windows.
- `X-Quotient-Max-Concurrent: 1`.
- `Retry-After` on `429`: whole seconds to wait; this is the authoritative retry delay.

On `429`, stop any fan-out, sleep for `Retry-After` plus small jitter, and retry serially. Do not
guess from local clocks. Bundled skill clients derive request pacing from
`contract-prices.json` `operation_rate_limits`, including multi-read workflows. Reusing a
settled x402 payment identifier with a changed payment proof, method, URL, query, or body
returns `409 payment_replay_mismatch`; an exact replay
returns the cached original response instead of executing another paid read.

## Result Sets

Every list route returns its complete result set in one response. There is no `cursor`,
no `limit`, and no `next_cursor`/`has_more`. Absence means no matching Q-covered row under
the route's filters—it is never a missing page and never proof that a supported venue has
no such listed contract. Narrow with `topic`, `venue`, `window`, `hours`, or
`/markets/search`.

## Endpoints

Market-shaped responses carry the canonical routing envelope (`venue`, native IDs,
`marketKey`, nullable `slug`, `marketUrl`, and `sourceUrl`) plus `quotientUrl` where
applicable. `polymarketUrl` is a deprecated compatibility alias populated only for
Polymarket International rows; it is null for Polymarket US, Kalshi, and Limitless.

### GET /api/v1/assets

Complete metadata-only Asset directory. Optional `platform` and `asset_type` filters are
case-insensitive. Each row contains `id`, `assetKey`, `name`, nullable `ticker`,
`asset_type`, `aliases`, exact `identifiers[{platform,kind,value}]`, and
`linked_market_count`. It never embeds forecast or venue-price data.

```bash
./scripts/quotient.sh assets list --platform hyperliquid --asset-type commodity
```

### GET /api/v1/assets/search

Enriched Asset resolution. Supply exactly one selector family:

- `q` (1–200 characters), including `q=*` for the enriched directory; or
- repeatable `reference` (up to 50) for exact Asset UUID/key, AssetIdentifier key/value,
  or linked Market marketKey/native ID.

`material_only=true` may be used by itself and is equivalent to an enriched all-Asset
search followed by the materiality filter. Optional `platform` and `asset_type` filters
apply in every mode.

Each Asset adds `linked_markets[]` and identity-match `relevance`. Linked rows reuse the
canonical market catalog envelope and add `has_forecast`, nullable
`latest_q_probability`, `has_published_signal`, and `published_signal_count`. Every active
direct `HAS_MARKET` row is returned; there is no spread threshold or `AFFECTS` expansion.

```bash
./scripts/quotient.sh assets search "AAPL"
./scripts/quotient.sh assets search "xyz:GOLD" --platform hyperliquid
./scripts/quotient.sh assets search --material-only
```

Read `assets.md` before using these rows for holdings or an Asset section. Each Q/venue
probability belongs to its exact linked question and must not be aggregated into Asset
direction.

### POST /api/v1/x/search

Structured Grok 4.5 X search. The default window is the 30 days ending today; callers may
request at most 90 days and 15 returned posts (default 8). The provider agent is capped at
two turns, 8,000 output tokens, and a 45-second deadline. This is a bounded single-pass
lookup, not a research session — issue follow-up searches to go deeper rather than widening
one call. It is one of the most expensive routes on the surface; read the current price from
`contract-prices.json` rather than copying it into prose.

A `200` always means X Search actually ran, so `meta.result_count: 0` is a genuine empty
result and `meta.search_executed` confirms it. If the underlying search never executes, the
route returns `502 upstream_search_unavailable` and the call is **not billed** — retry it
rather than treating it as "no posts found".

```http
POST /api/v1/x/search
content-type: application/json
x-quotient-api-key: qt_...

{
  "query": "What evidence is changing the odds of a 2026 Ukraine ceasefire?",
  "market_slugs": ["russia-x-ukraine-ceasefire-in-2026"],
  "from_date": "2026-07-31",
  "to_date": "2026-08-07",
  "allowed_x_handles": ["example_handle"],
  "limit": 8
}
```

Response keys: `summary`, citation-grounded `posts[]`, `accounts[]`,
`quotient_markets[]`, `gaps[]`, `citations[]`, and `meta`. Each post's
`author_metadata`, and each account's `quotient_metadata`, includes
`is_quotient_expert` plus structured `quotient_expert` metadata when the handle matches
Quotient's reviewed list. This is metadata only; clients choose their own presentation.
Results are not written to Neo4j, Typesense, the embedding pipeline, or any other
Quotient store, and the xAI request sets `store: false`.

X Search exceeds the vendored x402 policy's default per-call cap. API-key users can call
it directly; an x402 client must support POST bodies and receive explicit authorization
for the operation price read from `contract-prices.json`.

### POST /api/v1/x/profile

Psychographic profile of one X account, built from that account's own posts. Use it to
personalise recommendations to a known handle: what they care about, what they believe,
how they take risk, and how they work through complex or conflicting information.

Three fixed sweeps run against the account — interests and beliefs, risk and trading
behaviour, and reasoning style — followed by a synthesis pass. The window defaults to 120
days and accepts 14–180. Like `/x/search` this is a bounded lookup, not a research session:
the sweep count is fixed, and more depth means calling again rather than widening one call.

```http
POST /api/v1/x/profile
content-type: application/json
x-quotient-api-key: qt_...

{
  "handle": "vitalikbuterin",
  "lookback_days": 120,
  "focus": "trading"
}
```

`focus` (`general`, `trading`, `reasoning`) reweights the same three sweeps; it does not
add a fourth. Response keys: `interests[]`, `beliefs[]`, `tendencies[]`, `risk_profile`,
`information_processing`, `recommendation_hints`, raw per-sweep `observations[]`,
`evidence[]`, `confidence`, `gaps[]`, and `meta`.

Every claim cites `post_ids` that resolve against `evidence[]`. A claim whose supporting
posts fail citation grounding is dropped rather than returned unsupported, so a sparse
profile means sparse evidence, not a truncated response. `meta.coverage` is always
`sampled`: three relevance-ranked sweeps characterise the account, they do not exhaust its
timeline. Treat `confidence: "low"` and a populated `gaps[]` as a reason to widen the
window or call again with a different `focus`.

An account with fewer than 15 grounded posts in the window returns `404
insufficient_post_history` and is **not billed** — widen `lookback_days` rather than
retrying the same request. If fewer than two sweeps complete, the route returns `502` and
is likewise not billed. Results are not persisted by Quotient and the xAI request sets
`store: false`.

Like X Search, this route exceeds the vendored x402 policy's default per-call cap; read
its price from `contract-prices.json`. Being a POST route, it is not exposed through the
vendored GET-only shell payer.

**Persisting profiles.** Because each call is paid, store the response under `x_profiles`
keyed by handle in the user's Quotient config alongside a `generated_at` stamp, and read
the stored copy before profiling that handle again. Re-profile when the user asks or the
stored profile is older than roughly 30 days. `recommendation_hints` tells you which
market categories to surface and what framing to avoid; `risk_profile` tells you how much
hedging to voice; `information_processing` tells you how much reasoning to show. Profile
only handles the user names, present a profile as evidence-backed inference rather than
fact about a person, and personalize lightly when `confidence` is `low`.

### GET /api/v1/latest

Board-wide update feed spanning new forecasts and newly linked articles/X posts. Defaults
to three hours, permits 1–6 whole hours, and returns the complete selected window.

```bash
bankr x402 call "${QUOTIENT_BASE_URL:-https://quotient-api-gateway.onrender.com}/api/v1/latest?hours=3" \
  --max-payment "$MAX_PAYMENT_USD" --raw
```

Params: `hours` (1–6, default 3) and `types` (comma subset of `forecast,article,x_post`).
The whole window comes back in one response, stamped with `as_of` and `window.since`.
Each event includes compact `market`, `venue`, and latest `forecast` context; it does not
carry `resolution_pathway` — read that from a single-market route. Forecast
events have `source: null`; source-association events carry article/X metadata plus the
latest forecast so a caller can review the update without one request per market.

### GET /api/v1/markets

List covered markets with forecast and taxonomy context. Use `topic` for a known exact
tag/category such as `oil`; use `/markets/search` for free text or natural-language intent.
Direct Event tags match whether or not they have an `IN_CATEGORY` relationship.
This route returns the entire covered catalog in one response, so a market missing from it
is genuinely not covered.

```bash
bankr x402 call "${QUOTIENT_BASE_URL:-https://quotient-api-gateway.onrender.com}/api/v1/markets?sort=updated_desc" \
  --max-payment "$MAX_PAYMENT_USD" --raw
```

| Param | Type | Default | Constraints |
|---|---|---|---|
| `topic` | string | — | category/tag name, case-insensitive |
| `venue` | string | — | `polymarket` \| `polymarket_us` \| `kalshi` \| `limitless`; omit for all covered venues |
| `max_forecast_age` | int hours | 48 | ≥ 1; window for `forecast_count`/`latest_forecast_at` |
| `sort` | string | `updated_desc` | `updated_desc` \| `volume_desc` \| `signal_count_desc` |
| `changed_within` | int hours | — | 1–168; only markets whose latest forecast is newer than this |

```json
{
  "markets": [
    {
      "venue": "polymarket",
      "nativeMarketId": "512345",
      "nativeEventId": "event-123",
      "seriesTicker": null,
      "marketKey": "polymarket:512345",
      "slug": "russia-x-ukraine-ceasefire-in-2026",
      "marketUrl": "https://polymarket.com/event/russia-x-ukraine-ceasefire-in-2026",
      "sourceUrl": "https://gamma-api.polymarket.com/markets/512345",
      "question": "Russia x Ukraine ceasefire in 2026?",
      "event": {
        "id": "event-123",
        "title": "Russia–Ukraine ceasefire timing",
        "slug": "russia-ukraine-ceasefire-timing"
      },
      "tags": ["Ukraine", "Ceasefire"],
      "categories": ["World"],
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
  ]
}
```

A Kalshi asset-linked row can legitimately have no slug or navigation URL while retaining
authoritative native routing:

```json
{
  "venue": "kalshi",
  "nativeMarketId": "KXGOLD-26AUG-T2500",
  "nativeEventId": "KXGOLD-26AUG",
  "seriesTicker": "KXGOLD",
  "marketKey": "kalshi:KXGOLD-26AUG-T2500",
  "slug": null,
  "marketUrl": null,
  "sourceUrl": null,
  "question": "Will gold settle above $2,500 in August?",
  "tags": ["Commodities", "Metals", "Gold"],
  "polymarketUrl": null
}
```

| Field | Notes |
|---|---|
| `event` | parent Event `{id,title,slug}`, or null for a standalone market |
| `tags` / `categories` | taxonomy available for exact filtering and agent discovery |
| linked Assets | only a direct graph `HAS_MARKET` relationship links the Market to an underlying Asset; tags/series remain discovery metadata and do not create that relationship |
| `market_odds` | venue-neutral current source-venue implied YES probability, 0–1, across Polymarket International, Polymarket US, Kalshi, and Limitless; null when no live canonical price is available |
| `latest_forecast_delta` | latest forecast's probability change vs its prior (0–1 scale); non-zero = Q moved |
| `latest_forecast_refresh_reason` | non-null = the forecast reran off a trigger (e.g. price move), not just schedule |
| `changed_within` vs `max_forecast_age` | independent: `changed_within` filters on the latest forecast overall; `max_forecast_age` only windows the counts |

### GET /api/v1/markets/search

Hybrid discovery across active, covered markets. Prefer this endpoint whenever the user
describes a concept rather than naming a known exact tag. It ranks market questions,
parent Event titles, descriptions, tags, categories, and geographic actors, then hydrates
canonical venue routing, Q's latest calibrated YES probability when available, and explicit
forecast/published-signal availability. It never
searches unsupported catalog rows.
The contract supports `polymarket`, `polymarket_us`, `kalshi`, and `limitless`, but results
reflect actual Q coverage; an empty venue-filtered response does not mean the venue itself
has no matching listed contracts.

```bash
bankr x402 call "${QUOTIENT_BASE_URL:-https://quotient-api-gateway.onrender.com}/api/v1/markets/search?q=oil%20supply%20disruption&group_by=event" \
  --max-payment "$MAX_PAYMENT_USD" --raw
```

| Param | Type | Default | Constraints |
|---|---|---|---|
| `q` | string | `*` with a taxonomy filter | 1–200 chars; required unless `tag` or `category` is supplied |
| `tag` | repeatable string | — | up to 10; comma-separated also accepted; any supplied tag may match |
| `category` | repeatable string | — | up to 10; comma-separated also accepted; any supplied category may match |
| `venue` | string | — | `polymarket` \| `polymarket_us` \| `kalshi` \| `limitless` |
| `group_by` | string | `market` | `market` \| `event`; `markets` is always returned |

```json
{
  "query": "oil supply disruption",
  "group_by": "event",
  "markets": [
    {
      "marketKey": "polymarket:123",
      "slug": "strait-of-hormuz-traffic-restored-by-september",
      "question": "Will Strait of Hormuz traffic be restored by September?",
      "event": {"id": "e1", "title": "Strait of Hormuz traffic", "slug": "hormuz-traffic"},
      "tags": ["oil", "Strait of Hormuz"],
      "categories": [],
      "market_odds": 0.42,
      "has_forecast": true,
      "latest_q_probability": 0.57,
      "has_published_signal": false,
      "published_signal_count": 0,
      "relevance": {
        "score": 0.0503,
        "matched_by": ["graph", "typesense", "semantic"],
        "matched_fields": ["event_title", "tags"]
      }
    }
  ],
  "events": [],
  "facets": {
    "tags": [{"value": "oil", "count": 16}],
    "categories": []
  },
  "retrieval": {"graph": "ok", "typesense": "ok", "semantic": "ok"}
}
```

`relevance.score` is a reciprocal-rank-fusion ordering value, not a calibrated
probability or confidence score. `retrieval.typesense` and `retrieval.semantic` can be
`unconfigured` or `error`; graph results remain valid. `facets` cover the hydrated top
candidate set returned by the route. When `group_by=event`, `events` groups the returned
matches; otherwise it is null. Convenience wrapper:
`./scripts/quotient.sh search "oil supply disruption" [--tag oil] [--group-by event]`.

`latest_q_probability` is Q's latest committed calibrated probability that the market
resolves YES, or null when no forecast exists. It is enough for a discovery answer; use
lookup or forecast detail for analysis, drivers, citations, uncertainty, and history.
`has_forecast` means at least one committed Q forecast exists, independent of the recent
`forecast_count` window. Use it before making a detail call.
`has_published_signal` and `published_signal_count` use non-backfill `QuotientSignal`
publications, not the legacy analyst `signal_count`. They describe publication history;
they do not say that a published signal is currently active.

### GET /api/v1/markets/mispriced

Markets where Quotient's odds diverge from market odds. Only markets with YES odds in the 0.10–0.80 band are eligible.

```bash
bankr x402 call "${QUOTIENT_BASE_URL:-https://quotient-api-gateway.onrender.com}/api/v1/markets/mispriced?min_spread=0.08" \
  --max-payment "$MAX_PAYMENT_USD" --raw
```

| Param | Type | Default | Constraints |
|---|---|---|---|
| `min_spread` | float | 0.05 | 0–1 |
| `max_forecast_age` | int hours | 48 | ≥ 1 |
| `sort` | string | `spread_desc` | `spread_desc` \| `spread_asc` \| `volume_desc` \| `updated_desc` |

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
  ]
}
```

| Field | Notes |
|---|---|
| `spread` | `abs(quotient_odds − market_odds)`, 0–1 |
| `spread_direction` | `q_higher` (Q above market) \| `q_lower` |

### GET /api/v1/markets/lookup

Batch lookup by identifier. Prefer globally unique `market_keys` for cross-venue work;
legacy slug and condition-ID lookups default to Polymarket unless `venue` is supplied.
Returns full intelligence objects (same schema as `/markets/{slug}/intelligence`) per match.

```bash
bankr x402 call "${QUOTIENT_BASE_URL:-https://quotient-api-gateway.onrender.com}/api/v1/markets/lookup?market_keys=kalshi%3AKXGOLD-26AUG-T2500,limitless%3A4291" \
  --max-payment "$MAX_PAYMENT_USD" --raw
```

| Param | Type | Default | Constraints |
|---|---|---|---|
| `market_keys` | csv string | — | preferred; max 10; use exactly one identifier type |
| `slugs` | csv string | — | legacy; max 10; use exactly one identifier type |
| `condition_ids` | csv string | — | Polymarket-only; max 10 |
| `venue` | string | legacy PM default | optional namespace for slug/condition-ID lookup |

```json
{
  "results": [ { "marketKey": "kalshi:KXGOLD-26AUG-T2500", "slug": null, "...": "see /intelligence schema" } ],
  "not_found": ["limitless:4291"]
}
```

### GET /api/public/forecast-availability (free)

Check one market when coverage or identity is unresolved or forecast generation may be
needed. It is not routine preflight for a known stable market reference. Prefer `market_key`;
alternatively provide `venue` with `market_id`, or a `slug` (Polymarket by default). The
response exposes existence metadata only—never probability or research. `available: true`
includes a paid `read` pointer. `available: false` includes the exact authenticated
`POST /api/auth/forecast-requests` generation body when the native identity is known.

**Generation costs $1.00 (1,000 credits) and is the most expensive call on the surface.**
It commissions new research; reading an existing forecast is a cent. Always state the price
and get the user's confirmation before calling it, never issue it to satisfy your own
curiosity, and never loop it. It takes a Quotient API key only—there is no x402 path,
because an anonymous payer has no account to own the resulting job. A rejected request
(`422`, `429`) is refunded and settles no payment.

**Out-of-scope topics.** Quotient does not forecast sports markets or crypto up/down markets
on any venue. Those return a non-null `excluded` object
(`{"reason": "sports" | "crypto_up_down", "message": "..."}`) with `generation: null`, and
`POST /api/auth/forecast-requests` rejects them with `422 forecast_topic_excluded` before
they consume quota or settle payment.

`excluded` and `available` are independent. An excluded market that was forecast earlier
still returns `available: true` with a populated `read`—the stored forecast is readable, it
just will not be refreshed. Only `available: false` means there is nothing to report. Never
offer to request a refresh for an excluded market either way.

The crypto exclusion covers whole Kalshi series (`KXBTC*`, `KXETH*`, and siblings)
regardless of settlement horizon, so a year-end BTC level on those series is excluded too.

```bash
curl -sS "${QUOTIENT_BASE_URL:-https://quotient-api-gateway.onrender.com}/api/public/forecast-availability?market_key=kalshi%3AKXTEST"
```

### GET /api/v1/markets/{slug}/forecast

Latest forecast plus optional prior history for diffing — no drivers/citations/sentiment
joins. It carries Quotient's research output rather than catalog metadata and is priced
accordingly; read the current price from `contract-prices.json` and confirm the spend before
calling it in a loop. The path token may be the market's slug, nativeMarketId,
or marketKey within the explicit `venue`, so Kalshi and other nullable-slug rows are supported.
For an unresolved market, use the free availability endpoint first; otherwise call this
operation directly.

```bash
bankr x402 call "${QUOTIENT_BASE_URL:-https://quotient-api-gateway.onrender.com}/api/v1/markets/russia-x-ukraine-ceasefire-in-2026/forecast?history=1" \
  --max-payment "$MAX_PAYMENT_USD" --raw
```

| Param | Type | Default | Constraints |
|---|---|---|---|
| `history` | int | 0 | 0–10 prior forecasts returned in `history[]` |

`history[]` entries use the same shape as `forecast`, so each prior version carries its own
`delta_from_prior`, `delta_reasoning`, `prior_forecast_id`, and `refresh_reason`. One call
with `history=N` therefore answers both "what was the probability path" and "why did each
step move." There is no separate history endpoint. `scripts/quotient.sh` prints the path as a table and
the per-version `delta_reasoning` under `CHANGE LOG`.

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
    "thesis": "Negotiation preconditions have hardened; no credible path to a 2026 ceasefire.",
    "bluf": "Negotiation preconditions have hardened; no credible path to a 2026 ceasefire.",
    "crux": "Whether either side accepts territorial status quo as a talks baseline.",
    "resolution_pathway": {
      "criteria": "Resolves YES if a qualifying bilateral ceasefire begins in 2026.",
      "crux": "Whether either side accepts territorial status quo as a talks baseline.",
      "deadline": "2026-12-31T12:00:00Z",
      "source": "Polymarket resolution rules"
    },
    "delta_from_prior": -0.04,
    "delta_reasoning": "Down 4 points after the Kremlin ruled out talks before autumn.",
    "prior_forecast_id": "fc_8e11b0",
    "refresh_reason": "price_move",
    "refresh_triggered_by": "pm-odds-monitor",
    "conviction_tier": 3,
    "draw_std_log_odds": 0.18,
    "draw_count": 5,
    "band25": 0.24,
    "band75": 0.33,
    "drawdown_risk_72h": { "yes": false, "no": true },
    "crash_risk": { "yes": false, "no": true }
  },
  "history": [ { "id": "fc_8e11b0", "probability": 0.33, "created_at": "2026-07-31T10:02:44Z", "...": "same shape" } ]
}
```

Known market with no coverage → `404 forecast_not_available` plus an authenticated generation
request. Unknown identity → `404 invalid_market`. Neither is billable: API-key debits are
refunded and x402 settlement is skipped.

| Field | Notes |
|---|---|
| `probability` | canonical Q, 0–1 (YES) |
| `thesis` / `resolution_pathway` | compact review context: Q's thesis plus resolution criteria, crux, deadline, and source |
| `delta_from_prior` / `delta_reasoning` | precomputed diff vs `prior_forecast_id`; `delta_reasoning` is a deterministic sentence, safe to quote verbatim |
| `refresh_reason` / `refresh_triggered_by` | non-null = triggered rerun (price move, catalyst), not scheduled |
| `conviction_tier` | 1–3 from ensemble draw dispersion (`draw_std_log_odds` across `draw_count` independent draws) — NOT the Q-vs-market spread. 3 = tight self-agreement |
| `band25` / `band75` | interquartile band of the ensemble draws, 0–1 |
| `drawdown_risk_72h` | per-side deep-drawdown flags from Quotient's risk model: a side is `true` when the model puts ≥ 15% probability on a position on that side losing most of its remaining value within ~72h **of this forecast's `created_at`** (on older forecasts it's a historical reading, not current risk). The head is trained on matured 72-hour price paths — a side counts as a deep drawdown when its price printed twice within two hours at or below a quarter of the entry price, or when the market resolved against it. `null` = forecast predates the risk model (Aug 2026) — unknown, not safe. Path risk only; it never changes `probability` |
| `crash_risk` | deprecated former name for `drawdown_risk_72h`; same value, emitted for one release |

### GET /api/v1/markets/{slug}/intelligence

Full intelligence briefing for one market: forecast odds, BLUF, key drivers with citations, article evidence, sentiment.

```bash
bankr x402 call "${QUOTIENT_BASE_URL:-https://quotient-api-gateway.onrender.com}/api/v1/markets/russia-x-ukraine-ceasefire-in-2026/intelligence" \
  --max-payment "$MAX_PAYMENT_USD" --raw
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
    {
      "id": "https://example-news.com/kremlin-talks",
      "title": "Kremlin rules out talks before autumn",
      "comment": "The article directly addresses the negotiation timeline for this market.",
      "direction": null,
      "url": "https://example-news.com/kremlin-talks",
      "source": "Example News",
      "published_at": "2026-08-01T09:40:00Z",
      "correlated_at": "2026-08-01T10:10:00Z",
      "confidence": "high",
      "evidence_quote": "Talks will not begin before autumn."
    }
  ],
  "sentiment": { "pct_bullish": 22, "pct_bearish": 63, "pct_neutral": 15 }
}
```

### GET /api/v1/markets/{slug}/signals — article evidence

**Correlated article evidence** for one market (the pre-v5 "signals" path). Each row includes the article, correlation reasoning/confidence, evidence quote, and timestamps. `direction` is null when the correlation layer does not assess it; the API does not invent one. Not trade signals — those are at `/api/v1/signals`. If no articles exist, this route returns a non-billable `404 source_reads_not_available`.

```bash
bankr x402 call "${QUOTIENT_BASE_URL:-https://quotient-api-gateway.onrender.com}/api/v1/markets/russia-x-ukraine-ceasefire-in-2026/signals" \
  --max-payment "$MAX_PAYMENT_USD" --raw
```

| Param | Type | Default | Constraints |
|---|---|---|---|

```json
{
  "market_slug": "russia-x-ukraine-ceasefire-in-2026",
  "quotientUrl": "https://quotient.social/market/512345",
  "polymarketUrl": "https://polymarket.com/event/russia-x-ukraine-ceasefire-in-2026",
  "signals": [
    {
      "id": "https://example-news.com/kremlin-talks",
      "title": "Kremlin rules out talks before autumn",
      "comment": "The article directly addresses the negotiation timeline for this market.",
      "direction": null,
      "url": "https://example-news.com/kremlin-talks",
      "source": "Example News",
      "published_at": "2026-08-01T09:40:00Z",
      "correlated_at": "2026-08-01T10:10:00Z",
      "confidence": "high",
      "evidence_quote": "Talks will not begin before autumn."
    }
  ],
  "sentiment": { "pct_bullish": 22, "pct_bearish": 63, "pct_neutral": 15 },
  "total": 41,
  "last_updated": "2026-08-01T10:10:00Z"
}
```

### GET /api/v1/sources

Batch recent-source feed (articles + X posts) for up to 10 markets in one call. Prefer
`market_keys=` for cross-venue rows and whenever a market has no slug. Legacy `markets=`
accepts slugs and defaults to the Polymarket namespace unless `venue` is supplied.

```bash
bankr x402 call "${QUOTIENT_BASE_URL:-https://quotient-api-gateway.onrender.com}/api/v1/sources?markets=russia-x-ukraine-ceasefire-in-2026&window=48&types=article,x_post" \
  --max-payment "$MAX_PAYMENT_USD" --raw
```

| Param | Type | Default | Constraints |
|---|---|---|---|
| `market_keys` | csv string | — | preferred; 1–10 globally unique market keys; mutually exclusive with `markets` |
| `markets` | csv string | — | legacy; 1–10 market slugs; mutually exclusive with `market_keys` |
| `venue` | string | legacy PM default | namespace for `markets=`; ignored for globally unique `market_keys=` |
| `window` | int hours | 48 | 1–168 |
| `types` | csv string | both | subset of `article,x_post` |

```json
{
  "sources": [
    {
      "type": "article",
      "market_slug": "russia-x-ukraine-ceasefire-in-2026",
      "market": {
        "venue": "polymarket",
        "nativeMarketId": "512345",
        "nativeEventId": "event-123",
        "seriesTicker": null,
        "marketKey": "polymarket:512345",
        "slug": "russia-x-ukraine-ceasefire-in-2026",
        "marketUrl": "https://polymarket.com/event/russia-x-ukraine-ceasefire-in-2026",
        "sourceUrl": "https://gamma-api.polymarket.com/markets/512345"
      },
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
      "market": {
        "venue": "polymarket",
        "nativeMarketId": "512345",
        "nativeEventId": "event-123",
        "seriesTicker": null,
        "marketKey": "polymarket:512345",
        "slug": "russia-x-ukraine-ceasefire-in-2026",
        "marketUrl": "https://polymarket.com/event/russia-x-ukraine-ceasefire-in-2026",
        "sourceUrl": "https://gamma-api.polymarket.com/markets/512345"
      },
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
  ]
}
```

| Field | Notes |
|---|---|
| `feed_tier` | source tier: `primary` \| `specialist` \| `secondary` |
| `published_at` | ordering key (desc). X posts are **windowed** on when Quotient last saw them linked to the market but **ordered** on publish time — an older post recently re-linked can appear |
| `relevance` | why Quotient correlated the source to the market; for `x_post` rows it derives from the post's relevance annotation, and `confidence` is the edge's materiality defaulting to `"interesting"` — never null (null occurs only on `article` rows) |
| `is_expert` | X only: author is on Quotient's reviewed expert list |

### GET /api/v1/signals — trade signals

Active Quotient trade signals across Polymarket International, Polymarket US, Kalshi, and
Limitless whose latest market forecast was updated inside the requested window. The live
CLOB overlay currently applies only to Polymarket International; other venue rows use
graph-synced odds and disclose `live_priced: false`. Publication and forecast freshness
are separate, and the feed returns at most one signal per market.

```bash
bankr x402 call "${QUOTIENT_BASE_URL:-https://quotient-api-gateway.onrender.com}/api/v1/signals?window=24&status=actionable&min_conviction=2" \
  --max-payment "$MAX_PAYMENT_USD" --raw
```

| Param | Type | Default | Constraints |
|---|---|---|---|
| `window` | int hours | 24 | 1–168; latest-forecast update lookback, not signal age |
| `status` | csv string | `actionable,unconfirmed` | subset of `actionable,unconfirmed,paused,done,retired`; pass an explicit set for lifecycle/history reads |
| `side` | string | both | `YES` \| `NO` |
| `market` | string | — | single market slug |
| `venue` | string | all covered | `polymarket` \| `polymarket_us` \| `kalshi` \| `limitless` |
| `min_conviction` | int | — | 1–3; keeps `conviction_tier ≥` value |
| `min_capacity_usd` | float | — | ≥ 0; keeps `capacity_usd_at_2c ≥` value, or null-capacity rows with `capacity_basis: "volume-fallback"` |
| `exclude_drawdown_risk` | bool | false | `true` drops rows whose `drawdown_risk_elevated` is `true`; null-read rows (no risk-model coverage) are kept |
| `exclude_crash_risk` | bool | false | deprecated former name for `exclude_drawdown_risk`; accepted for one release |

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
      "drawdown_risk_elevated": false,
      "crash_risk_elevated": false,
      "market": {
        "venue": "polymarket",
        "nativeMarketId": "512345",
        "nativeEventId": "event-123",
        "seriesTicker": null,
        "marketKey": "polymarket:512345",
        "slug": "russia-x-ukraine-ceasefire-in-2026",
        "marketUrl": "https://polymarket.com/event/russia-x-ukraine-ceasefire-in-2026",
        "sourceUrl": "https://gamma-api.polymarket.com/markets/512345",
        "question": "Russia x Ukraine ceasefire in 2026?",
        "condition_id": "0x8a3f5b9c1e2d4f60718293a4b5c6d7e8f90123456789abcdef0123456789abcd",
        "end_date": "2026-12-31T12:00:00Z",
        "market_odds": 0.36,
        "volume_24h": 184233.5,
        "quotientUrl": "https://quotient.social/market/512345",
        "polymarketUrl": "https://polymarket.com/event/russia-x-ukraine-ceasefire-in-2026"
      }
    }
  ]
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
| `entry_q` / `entry_pm` | frozen at publish, 0–100 YES scale (Q's probability / source venue YES price). `entry_pm` is a legacy wire name, not a Polymarket-only value |
| `entry_spread_pp` | raw `abs(entry_q − entry_pm)` in percentage points — unsigned edge at publish |
| `conviction_tier` / `conviction` | 1–3 (`low`/`medium`/`high`) from **ensemble draw dispersion** — self-agreement of the forecaster's independent draws — NOT the Q-vs-market spread. `has_band` is `false` only when no conviction estimate could be computed at all (missing Q or price); pre-ensemble inferred estimates (fewer than 2 draws) still report `has_band: true` with tier capped at 2 — an inferred estimate, not a measured dispersion band |
| `latest_q` | Q's current probability, 0–1 (contrast with 0–100 entry fields) |
| `q_side` | side implied by Q's **latest** forecast vs current price — may differ from the signal's entry `side` |
| `q_value_cents` | Q's value: what the position is worth per share if the market converges to Q, in Q-side cents |
| `entry_cost_cents` / `current_cost_cents` | cost of the Q-side share at publish / now, cents |
| `distance_to_convergence_cents` | Q-side cents from current cost to the convergence goal (Q's value, or 100¢ when `resolves_in_window`); **≤ 0 means converged** |
| `converge_upside_pct` | % remaining on current cost to the goal; ≤ 0 → `status: "done"` |
| `resolves_in_window` | `window_days ≤ 7`: can be held to resolution, so the goal is a full 100¢ win |
| `live_priced` / `priced_at` | `true` = convergence fields priced from a live venue book at `priced_at`; the current implementation supports the Polymarket International CLOB. `false` = graph-odds fallback and `priced_at` is the market's last graph update—treat as stale |
| `capacity_usd_at_2c` | persisted notional observed within 2¢ of touch on the signal side, refreshed ~every 12h (`capacity_as_of`); `null` = no depth snapshot. It is not a guaranteed fill or exact price-impact estimate; re-read the live book before trading |
| `capacity_basis` | `depth-2c` (snapshot present) · `volume-fallback` (snapshot null but `market.volume_24h ≥ 5000`) · `null` (no basis — treat capacity as unknown-thin) |
| `drawdown_risk_elevated` | `true` when Quotient's risk model puts ≥ 15% probability on **this signal's side** losing most of its remaining value within ~72h of the latest forecast (`forecast_updated_at`) — a sharp-move warning on the position, not a change to any probability. `null` = no **current** read: the latest forecast predates the risk model (Aug 2026) or the read has aged past the ~72h horizon — unknown, not safe. Independent of this API's `conviction_tier` (draw dispersion only) — a row can read `high` conviction and `drawdown_risk_elevated: true` at once; Quotient's member product separately demotes its own displayed conviction on this same read. Near expiry expect elevated readings on both sides, because resolution itself takes the losing side down by more than 75% |
| `crash_risk_elevated` | deprecated former name for `drawdown_risk_elevated`; same value, emitted for one release |

### GET /api/v1/signals/featured

The single featured signal: an operator pin when set (and still healthy), else auto-picked from active actionable, live-priced signals whose latest forecast update is inside `window` and which clear volume/expiry floors. The server owns the pick — never re-implement it.

```bash
bankr x402 call "${QUOTIENT_BASE_URL:-https://quotient-api-gateway.onrender.com}/api/v1/signals/featured" \
  --max-payment "$MAX_PAYMENT_USD" --raw
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

The WTI crude signal: the latest frozen daily reading plus live venue marks (Polymarket perps `WTIOIL-USD`, Hyperliquid `xyz:CL`). The reading is not recomputed live — freshness is disclosed, check it.

```bash
bankr x402 call "${QUOTIENT_BASE_URL:-https://quotient-api-gateway.onrender.com}/api/v1/signals/oil?include_marks=true" \
  --max-payment "$MAX_PAYMENT_USD" --raw
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
    "formula_version": "crude-wti-v1"
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

### GET /api/v1/signals/perps — WTI signal list

This route returns zero or one daily WTI item in the standard signal-list format.
Use `/signals/oil` when episode context or live venue marks are needed.

```bash
bankr x402 call "${QUOTIENT_BASE_URL:-https://quotient-api-gateway.onrender.com}/api/v1/signals/perps?asset=wti&signal_type=daily" \
  --max-payment "$MAX_PAYMENT_USD" --raw
```

| Param | Type | Default | Constraints |
|---|---|---|---|
| `asset` | string | WTI | `wti` |
| `signal_type` | string | daily | `daily` |

The response declares `canonical_endpoint: "/api/v1/signals/oil"` and
`scope: "wti-only"`. `state` is `long`/`short` only for today's valid side, `flat` for a
stale long/short row, and `unavailable` when no side exists. A missing side never silently
becomes short. `relationships` contains the same bounded Asset/Market/Signal ref envelope.
See `perps-signals.md` for the complete field guide.

### GET /api/v1/portfolio

Wallet intelligence: open positions at live prices, joined server-side to Quotient
coverage—forecast, signal, and convergence per prediction-market position, in one call.

The route has two modes. **Omit `venues`** and it returns the legacy Polymarket-only shape
documented below, unchanged. **Pass `venues`** and it returns the multi-venue envelope
covering `polymarket`, `polymarket_perps`, `limitless`, and `hyperliquid`.

Kalshi and Polymarket US are absent here because neither exposes a keyless wallet-addressed
position read, so an address alone cannot produce a report. That is an integration limit and
says nothing about the venue scope of market discovery or forecasting.

Canonical generated agent-tool name: `get_portfolio_report`. It maps directly to this
read-only operation and does not add a separate portfolio data model.

```bash
bankr x402 call "${QUOTIENT_BASE_URL:-https://quotient-api-gateway.onrender.com}/api/v1/portfolio?venues=polymarket,limitless,hyperliquid&wallet=0xEE4E0EB3A626713F5Efa98DB422fA73FdD1e94b8" \
  --max-payment "$MAX_PAYMENT_USD" --raw
```

| Param | Type | Default | Constraints |
|---|---|---|---|
| `wallet` | string | — | `^0x[0-9a-fA-F]{40}$`; required unless every requested venue has its own override |
| `venues` | string | — | comma-separated `polymarket`, `polymarket_perps`, `limitless`, `hyperliquid`, or `all`; omit for the legacy shape |
| `<venue>_wallet` | string | — | per-venue override, e.g. `hyperliquid_wallet`; same address pattern |
| `size_threshold` | number | 1 | minimum position size (shares) to include |
| `include_perps` | bool | false | legacy mode only; appends the perps + oil annex |

**Multi-venue envelope.** `as_of`, `requested_venues`, `wallets` (venue → address used),
`totals`, `unavailable_venues`, and `venues` (venue → report).

`totals` carries `prediction_value_usd`, `perps_equity_usd` (null when no perps venue
answered), `positions_count`, `covered_count`, `venues_ok`, and `venues_unavailable`.
Prediction value and perps equity are separate figures; do not add them into one number.

Each venue report carries `venue`, `kind` (`prediction` or `perps`), `status`, and `wallet`.
A `prediction` report adds `value_usd`, `positions_count`, `covered_count`,
`unmatched_count`, `positions_capped`, `positions[]`, and `unmatched[]`. A `perps` report
adds `equity` and `positions[]` with `symbol`, signed `size`, `side`, `entry_price`, and
`position_value_usd`. Perps positions carry no forecast, signal, or convergence join—only
prediction-market positions do.

**Failure model differs by mode.** In legacy mode the whole call fails closed with `502
upstream_unavailable` when the Polymarket data-api is down. In multi-venue mode each venue
degrades on its own: an unreachable venue returns `status: "unavailable"` with
`error: "upstream_unavailable"` and is listed in `unavailable_venues`, while the venues that
answered still return their positions. Within a venue, positions still fail closed—never a
partial list. Report which venues were unavailable rather than presenting a short portfolio
as complete.

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
          "thesis": "Negotiation preconditions have hardened; no credible path to a 2026 ceasefire.",
          "resolution_pathway": {
            "criteria": "Resolves YES if a qualifying bilateral ceasefire begins in 2026.",
            "crux": "Whether either side accepts territorial status quo as a talks baseline.",
            "deadline": "2026-12-31T12:00:00Z",
            "source": "Polymarket resolution rules"
          },
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
| `quotient.forecast.thesis` | Q's own reasoning for this position, already included here. Quote it when asked what Q thinks; do not buy a per-position forecast read to recover it. `resolution_pathway.crux`, `delta_from_prior`, `refresh_reason`, and `conviction_tier` ship on the same object |
| `convergence.aligned` | your position side equals Q's current side (`q_side`). `false` = Q reads the other way — surface these first |
| `convergence.*_cents` | same semantics as `/v1/signals`: Q-side cents; `distance_to_convergence_cents ≤ 0` = converged |
| price basis | `cur_price`/values come live from the Polymarket data-api; `convergence.priced_at` stamps the pricing moment |
| `positions_capped` | `true` when the wallet exceeded the 1500-row fetch cap — the list is truncated |
| `perps` | present only with `include_perps=true`; degrades independently — on upstream failure the block carries `"error": "upstream_unavailable"` instead of failing the request |
| failure mode | if the Polymarket data-api itself is down the endpoint returns **`502 upstream_unavailable`** (fail-closed — never a partial position list) |

Advisory: all portfolio assessments are informational, derived from Quotient's forecasts — not trade instructions.

## Common Error Codes

- `401 gateway_required`
- `402 payment_required`
- `404 invalid_market` / `404 not_found`
- `422 invalid_request`
- `429 rate_limited`
- `409 payment_replay_mismatch` (settled x402 identifier reused with a different proof or request)
- `502 upstream_unavailable` (portfolio only; oil degrades instead)

Full contract and retry guidance: `error-handling.md`.
