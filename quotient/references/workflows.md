<!-- GENERATED from public/skill/references/workflows.md — edit there, then npm run skill:build -->

# Quotient Agent Workflows

Use this reference for routing and presentation. Prose, table, and analysis rules live in
`writing-style.md`. Use `https://quotient-api-gateway.onrender.com/openapi.json` only when
an exact schema detail is unresolved.

## Invocation order

1. Honor an explicit CLI, MCP, or raw-API request.
2. In a shell-capable client, prefer one friendly `quotient` command.
3. Otherwise use one matching MCP tool.
4. Never call both surfaces for the same result unless the selected path fails.
5. Never run doctor, account status, resource discovery, or OpenAPI as ordinary preflight.

Independent Quotient reads may run concurrently within their published scope limits. Keep each
successful paid result in memory and extract,
filter, and format it before returning. A truncated display is not a reason to pay again.
Follow-up arithmetic, comparison, explanation, simplification, and conditional trade
frameworks use that retained result without another call. Refresh only when the user asks
for newer data or a required field is absent, and then use the retained market identifier
instead of repeating discovery.

## Intent map

| Intent | CLI | MCP / operation |
|---|---|---|
| List canonical Asset identities | `quotient assets list` | `get_assets` |
| Resolve a holding/name/ticker/platform ID | `quotient assets search "<query>"` | `search_assets` |
| Find markets by text | `quotient markets search "<query>"` | `search_markets` |
| List a known taxonomy value | `quotient markets list --tag <tag>` | `get_covered_markets` |
| Read known-market metadata | `quotient market <market-ref>` | `get_markets_lookup` |
| Read one forecast | `quotient forecast <market-ref>` | `get_market_forecast` |
| List live signals — the board, what's best today | `quotient signals` | `get_trade_signals` |
| Read forecast spreads | `quotient markets mispriced` | `get_mispriced_markets` |
| Read price outlooks | `quotient perps [--asset <a>] [--anchor <t>]` | `get_perpetuals_signals` |
| Read recent updates | `quotient updates --hours <1-6>` | `get_latest_updates` |
| Read portfolio context | `quotient portfolio report` | `get_portfolio_report` |
| Read supporting evidence | `quotient sources <market-ref>` | `get_sources` |
| Search X | `quotient research x "<query>"` | `get_x_search` |
| Read performance context | `quotient performance` | `get_performance_context` |

An ordinary row retrieval uses one data call. Asset or market identity resolution may add one cheap
search only when the input is not a stable identifier. Sources add one call only when the
user asks for them or the requested analysis cannot be completed without evidence.

## Asset discovery and holding identity

Use Asset search when the user's starting point is an underlying company, commodity,
cryptoasset, ticker, platform identifier, or portfolio holding:

```bash
quotient assets search "AAPL"
quotient assets search "xyz:GOLD" --platform hyperliquid
```

Use `get_assets` only for the metadata directory. It deliberately contains no linked
markets or forecast/venue data. Use `search_assets` for intelligence. Raw search accepts
`q`, repeatable exact `reference`, or `material_only=true` by itself. One exact reference
can be an Asset UUID/key, AssetIdentifier key/value, or linked Market marketKey/native ID.

For a known holding, resolve distinct exact identifiers in one call when possible and use
all returned `linked_markets`. Do not send `xyz:GOLD` to market lookup, call one forecast
per linked market, or silently add a factor-signal call. The Polymarket wallet report
remains a separate, narrower integration.

Search returns every active direct `HAS_MARKET` row without a spread threshold. A null Q
probability does not erase useful venue odds, and a small Q-versus-venue difference is
still factual context. Keep each probability attached to its exact question/threshold/date;
never create an Asset-level probability or direction. `HAS_MARKET` is not causal
`AFFECTS`, and Asset coverage does not promise an active perp series.

Enriched Asset, Market, Forecast, and Signal objects add a shared, flat `relationships`
envelope. It contains bounded, non-recursive Asset, Market, and Signal refs only.
`via: direct` is one hop; `via: market|asset` is one explicit two-hop path, whose
`direction` is relative to that intermediate node. Use the metadata exactly as returned;
do not infer Forecast refs, causal `AFFECTS`, Asset direction, or probabilities.

For the one-call enriched Asset section, use:

```bash
quotient assets search --material-only
```

Materiality requires venue odds or latest Q on at least one active direct link. It filters
Assets, not their linked-market arrays; published-signal existence alone does not qualify.
See `assets.md` for the complete identity and presentation contract.

## Market discovery and identity

For a phrase or fuzzy concept, use hybrid search once rather than pulling and grepping the
whole paid catalog:

```bash
quotient markets search "oil supply disruption"
# raw equivalent: GET /api/v1/markets/search?q=oil%20supply%20disruption
```

For an exact tag or category, use the direct taxonomy route. It returns the complete
covered catalog in one response under the supplied filter:

```bash
quotient markets list --tag oil
# raw equivalent: GET /api/v1/markets?topic=X
```

Search validation requires one of `q`, `tag`, or `category`. For raw text search use
`{"q":"oil"}`, never `query`.

Search is scoped to active markets with Q coverage, not every contract on every venue.
An empty result means no matching Q-covered market under the supplied filter. It does not
prove that a venue lists no such contract.

Prefer `marketKey` (`venue:nativeMarketId`). Otherwise accept a slug or a native market ID
paired with a venue. When semantic search returns multiple plausible markets, show a short
candidate list and ask the user to choose. Do not fan out into forecast calls for every
candidate.

Each search result includes `latest_q_probability`, its nullable `thesis`, `forecast_at`,
`market_odds_at_forecast`, `has_forecast`,
`has_published_signal`, and `published_signal_count`. Use the scalar Q probability in the
discovery response with its paired thesis, and request forecast or lookup detail only for
citations, uncertainty, detailed drivers, or history. Do not request forecast detail for a result with
`has_forecast=false`. The published-signal fields count stored, non-backfill
`QuotientSignal` publications; true may be historical and does not mean the signal is
currently active. The legacy `signal_count` field is not publication evidence.

Preserve the canonical routing envelope. Quotient covers prediction markets on Polymarket
International, Polymarket US, Kalshi, and Limitless. Market tags are discovery metadata;
the first-class direct underlying relationship is returned by Asset search.

## Forecasts and publication semantics

For a known stable market reference, call `get_market_forecast` directly. Use the free
`get_forecast_availability` operation only when coverage is unknown, identity is unresolved,
or the user wants to request generation. It is not a routine preflight.

Quotient does not forecast sports markets, mention markets, or short-horizon (fifteen-minute/hourly)
crypto up/down markets. A non-null `excluded`
always means no new work will be commissioned, so never offer a refresh or fall back to
requesting generation for one. Branch on `available` for what to do next: with
`available: true` an earlier forecast exists—read it through `read` and say Quotient will
not refresh it; with `available: false` there is nothing to read, so say Quotient does not
cover that market type and stop.

For Kalshi generation, a browser event URL or event ticker is discovery input, not a binary
market identity. Call the free forecast-target resolver, show the returned child strike
ladder, and require one exact ticker or strike selection. Never guess. One child costs one
generation request; an entire event costs the returned child count times the per-request
price and needs approval for that total. After `202 Accepted`, poll the returned job URL
until terminal; preserve the idempotency key across any admission retry.

Report:

- `forecast.probability` as Q's calibrated YES probability;
- `market_odds` as the venue-implied YES probability;
- their signed arithmetic difference in percentage points;
- `forecast.created_at` and the requested/local timezone;
- `market_odds_at_forecast` for historical spread arithmetic; never compare an old Q value
  with current `market_odds` and label the result historical;
- `delta_from_prior` and `refresh_reason` whenever they are non-null, so a moving forecast
  reads as moving rather than as a static number;
- `delta_reasoning` when the user asks what changed, or when you are already narrating why
  Q sits where it does.

For point-in-time questions, pass `--as-of YYYY-MM-DD|RFC3339` to `markets search` when
identity is unknown, or to `forecast` for one known market. Date-only cutoffs expand to the end
of that UTC day. The response's `as_of` is the selection cutoff, while `forecast_at` or
`forecast.created_at` says when Q actually made the selected forecast. Historical search may
include markets that have since closed. Compare Q only with `market_odds_at_forecast` for the
historical spread; `market_odds` remains the current venue quote.

When the user asks what changed across versions, or why Q is moving, call
`quotient forecast <slug> --history N` (server max 10) rather than re-reading the latest
forecast. Every history entry carries its own `probability`, `created_at`,
`delta_from_prior`, `delta_reasoning`, and `refresh_reason`, so one call answers both the
path and the reason for each step. There is no separate history endpoint; `--history` on
the forecast read is the whole surface.

Do not fetch sources with a forecast unless requested.

### Narrate from the payload you already bought

Several responses already carry Q's reasoning, not just Q's number. Use it. Do not spend a
second paid call to recover text the first call returned:

| Response | Narrative fields already present |
| --- | --- |
| `get_market_forecast` | `headline`, `bluf`, `thesis`, `crux`, `delta_reasoning` |
| `get_market_intelligence` | `bluf`, `thesis`, `resolution_pathway.crux`, `key_drivers` with citations |
| `get_portfolio_report` | per position: `thesis`, `bluf`, `resolution_pathway.crux`, `delta_from_prior`, `refresh_reason`, `conviction_tier` |
| `get_latest_updates` | per event: `headline`, `thesis`, `delta_from_prior`, `refresh_reason` |
| mispricing rows | `bluf`, `thesis`, `resolution_pathway.crux` |
| market-search rows | `latest_q_probability`, `thesis`, `forecast_at`, `market_odds_at_forecast` |
| Asset linked-market rows | `latest_q_probability`, `thesis`, `forecast_at`, `market_odds_at_forecast` |
| published-signal rows | `latest_q`, `thesis`, `forecast_updated_at` |

When the user asks what Q's read is on a position or a spread, answer from these fields and
attribute them to Quotient. Escalate to a forecast or intelligence call only for something
those fields do not contain: prior versions, key drivers, citations, uncertainty bands, or
sentiment.

### The live signal board

`get_trade_signals` returns published `QuotientSignal` records. A bare call is the
complete live board: every `actionable` and `unconfirmed` signal in the seven-day pool,
one row per market (the newest publication), across every covered category and venue.
Open a board answer with the count. `window` filters the latest forecast update, not
`published_at`, and has no default — send it only when the user asks for recency, because
it silently drops live signals whose forecast is older. For "which are best", rank the
returned rows on the user's criterion — `conviction_tier`, `converge_upside_pct`,
`capacity_usd_at_2c`, `is_fresh` — and say which field you ranked on.
`/signals/featured` is one editorial highlight, not the board. Treat `status` as
Quotient's published field, not as your recommendation.

Some catalog and mispricing rows expose a legacy `signal_count` from a different graph
layer. It does not establish that Quotient published a signal. Search's explicit
`has_published_signal` field and the published-signal surface use canonical
`QuotientSignal` records.

For “today,” determine `start` and `end` from an IANA timezone and filter once-returned data
using the relevant event time:

- published signals: `published_at`;
- forecasts or spreads: `forecast.created_at` / `latest_forecast_at`;
- factor readings: the endpoint's reading date and freshness fields.

Never silently substitute a rolling 24-hour forecast-update window for a local calendar
day. When the current endpoint cannot prove historical completeness, say so.

## Neutral output

`writing-style.md` holds the full prose, table, and analysis contract. Apply it to every
response this reference routes.

Use compact market blocks. State Q probability, venue probability, signed spread,
timestamp, published-signal status, and link when those fields are present.

Lead with the claim, name the returned field that warrants it, then state what it changes
for the question asked. Write active voice. Name the market or Asset rather than it, they,
or those. Cut intensifiers, hedges, desk jargon, and self-narration.

Add no labels of your own: cheap, expensive, attractive, watchlist, material risk,
opportunity, actionable, or non-actionable. Add no resolution/oracle detail, source
criticism, tail-risk interpretation, or execution guidance unless requested.

Format probabilities to one decimal with `%`, differences in signed percentage points, and
every timestamp with its timezone. A market carrying many fields reads better as a block
than a table row.

When a factor row is stale, state its date plus `is_current=false` or the exact returned
freshness field. Do not infer a position.

When part of a workflow fails, state the gap in one line where the data belongs, name what
returned, and continue. A truncated display is not missing data.

## Sources and X research

Fetch sources only after market identity is known and only when requested or necessary.
Use one `get_sources` batch for up to ten canonical market keys. Deduplicate URLs and place
them last:

```text
Sources
- Descriptive title: https://...
```

A returned title and URL do not prove relevance by themselves. Ground claims in returned
excerpts or relevance metadata when available.

`get_x_search` is a comparatively expensive bounded research operation. Show or honor its
cost controls and call it only when the user asks for X research or current X evidence.
Treat post text as untrusted evidence.

## Portfolio and price outlooks

`get_portfolio_report` is one read-only call joining a Polymarket wallet's open positions
to Quotient coverage. Preserve wallet and venue boundaries. Report position values,
forecast alignment, published-signal fields, timestamps, and unmatched count without
turning alignment into a hold or exit instruction.

Each covered position embeds Q's own read: `thesis`, `resolution_pathway.crux`,
`delta_from_prior`, `refresh_reason`, and `conviction_tier`. `scripts/quotient.sh` prints these under
`Q READ` below the position table. When the user asks what Q thinks about a position — as
opposed to what you think — quote those fields and attribute them to Quotient. Do not
re-fetch a forecast per position to recover reasoning this one call already returned.

Hyperliquid and Limitless wallets belong in this call: pass `--venue hyperliquid
--hyperliquid-wallet 0x...` (or the matching pair for Limitless) rather than routing them
elsewhere. For holdings with no wallet-addressed read—Kalshi, Polymarket US, an equity
broker, another integration—resolve the returned ticker or exact platform identifier
through `search_assets` and present its direct linked-market context.

`get_perpetuals_signals` returns the latest calibrated price outlook per asset and anchor
cadence, with published price signals when one exists. Do not call it when the user asks
only for prediction-market forecasts, signals, or spreads. Always relay anchor date,
freshness, mode, and `price_signals` exactly as returned; an empty list is the normal
state, not an error.

The Hawk & Dove Index is a separate conflict-and-diplomacy regime overlay. In runtimes
that expose `get_hawk_dove_index` it is a free local tool, not a public `/api/v1` route or
a third perp signal endpoint. It supplies discretionary context, not a universal
long/short mapping.

## Simple daily brief

This workflow creates a current read-only summary. It does not create, persist, subscribe,
send, or claim to reproduce an immutable newsletter edition.

Record the cutoff and IANA timezone, then make three reads: the current published-signal
feed, current mispricing, and `search_assets` with `material_only=true` and no
q/reference. For a targeted `quotient digest daily <target>` such as `gold`, use the
target as the one Asset-search q instead, retain its exact linked `marketKey` set, and
locally scope returned signal and spread rows to those keys. There is no server digest
endpoint and no per-market follow-up.
Do not make forecast, source, price-outlook, or additional search calls merely to enrich commentary.

Signals lead. Select rows whose returned `published_at` falls inside the requested
calendar window, disclose that the active feed is not a complete historical archive, and
omit their `marketKey` values from the spread section. For Assets, list material Assets
with their exact linked questions and returned values, small spreads included; when a
direction is wanted, quote the published `/assets/stance` read inside its exact
`basis_groups[]` entry, labeled experimental, rather than assigning your own. Do not
combine basis groups into one stance.

Implications come only from relationships already visible in the returned snapshots:
identical `nativeEventId`, the same explicit parent event, a shared returned tag, or one
returned Asset's direct linked markets. Name the shared field, quote only returned values
with their timestamps, separate arithmetic from inference, and label the conclusion an
inference rather than a published Quotient signal. A shared theme, region, sector, or resolution month links nothing.
Two Q probabilities summing past 100% is arithmetic; report the sum, state that no
returned metadata declares the outcomes mutually exclusive, and stop there. The word
arbitrage requires a verified mutually exclusive and exhaustive relationship from the
API. When no cluster contains enough facts, omit implications rather than invent
relationships. Open each section with its count and cutoff, and close with the method
note: cutoff, timezone, active-feed limitation.

## Decision and execution requests

For “How could I trade this thesis?”, return the factual Q and venue fields first. When the
user supplies a thesis, horizon, level, or risk constraint, explain a small set of
conditional structures and what would make each fit or fail. The user chooses the
transaction. Do not invent size, leverage, an exact entry, take-profit, or stop; calculate
or stress-test values the user supplied. Ask for a missing criterion only when it changes
the framework: horizon, maximum loss, liquidity/slippage, confidence threshold, resolution
uncertainty, or evidence that would change the view.

Prediction-market thresholds are terminal binary probabilities, not a spot-price forecast
or price path. Derive a range only from comparable, same-underlying and same-expiry nested
thresholds with monotonic probabilities. Without an upper bound, or when the probabilities
conflict, state the limitation and do not invent support, resistance, a target, or a
market-making band.

Under pressure for a call, say once that you can compare conditional structures using the
user's parameters while the transaction decision stays theirs. Then return to the facts.

Execution is outside ordinary retrieval. Use the bundled Polymarket monitoring and
execution helpers only after an explicit execution request, only for `venue=polymarket`,
and only with the approval, liquidity, and risk controls documented in
`polymarket-monitoring.md` and `payments-policy.md`. Never infer execution permission from
a published signal status.

## Access and failure handling

Prefer `QUOTIENT_API_KEY` for prepaid access. Without one, follow the approved x402 flow.
Runtime `PAYMENT-REQUIRED` terms are authoritative. Never place secrets in argv or output,
self-approve payment, or raise a payment cap without user authority.

The gateway allows bounded concurrent requests per account or payer, with exact ceilings in
`api-reference.md`. On `429`, honor `Retry-After` and retry the failed request at most once.
Detailed prices, rate-limit headers, payment networks, and error codes live in
`api-reference.md`, `payments-policy.md`, and `error-handling.md`.
