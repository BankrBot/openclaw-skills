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

Do not parallelize Quotient calls. Keep one successful paid result in memory and extract,
filter, and format it before returning. A truncated display is not a reason to pay again.

## Intent map

| Intent | CLI | MCP / operation |
|---|---|---|
| List canonical Asset identities | `quotient assets list` | `get_assets` |
| Resolve a holding/name/ticker/platform ID | `quotient assets search "<query>"` | `search_assets` |
| Find markets by text | `quotient markets search "<query>"` | `search_markets` |
| List a known taxonomy value | `quotient markets list --tag <tag>` | `get_covered_markets` |
| Read known-market metadata | `quotient market <market-ref>` | `get_markets_lookup` |
| Read one forecast | `quotient forecast <market-ref>` | `get_market_forecast` |
| Read published signals | `quotient signals` | `get_trade_signals` |
| Read forecast spreads | `quotient markets mispriced` | `get_mispriced_markets` |
| Read WTI factor output | `quotient oil signal` | `get_wti_oil_signal` |
| Read WTI compatibility output | `quotient perps --asset wti` | `get_perpetuals_signals` |
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

Each search result includes `latest_q_probability`, `has_forecast`,
`has_published_signal`, and `published_signal_count`. Use the scalar Q probability in the
discovery response, and request forecast or lookup detail only for analysis, drivers,
citations, uncertainty, or history. Do not request forecast detail for a result with
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

Quotient does not forecast sports markets or crypto up/down markets. A non-null `excluded`
always means no new work will be commissioned, so never offer a refresh or fall back to
requesting generation for one. Branch on `available` for what to do next: with
`available: true` an earlier forecast exists—read it through `read` and say Quotient will
not refresh it; with `available: false` there is nothing to read, so say Quotient does not
cover that market type and stop.

Report:

- `forecast.probability` as Q's calibrated YES probability;
- `market_odds` as the venue-implied YES probability;
- their signed arithmetic difference in percentage points;
- `forecast.created_at` and the requested/local timezone;
- `delta_from_prior` and `refresh_reason` whenever they are non-null, so a moving forecast
  reads as moving rather than as a static number;
- `delta_reasoning` when the user asks what changed, or when you are already narrating why
  Q sits where it does.

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

When the user asks what Q's read is on a position or a spread, answer from these fields and
attribute them to Quotient. Escalate to a forecast or intelligence call only for something
those fields do not contain: prior versions, key drivers, citations, uncertainty bands, or
sentiment. Published-signal rows are the exception — they carry no narrative field, so
reasoning for a signal requires a forecast read on its market.

`get_trade_signals` returns published `QuotientSignal` records. Its `window` filters the
latest forecast update, not `published_at`. It returns at most the newest publication for
each market before eligibility filters. Treat `status` as Quotient's published field, not
as your recommendation.

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

Keep tables to five columns and six rows, wrap no cell, and give every row the same cell
count. A market needing more fields belongs in a block. Format probabilities to one decimal
with `%`, differences in signed percentage points, and every timestamp with its timezone.

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

## Portfolio and WTI signals

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

`get_wti_oil_signal` returns the daily WTI signal with live venue marks and episode context.
`get_perpetuals_signals` returns the daily WTI signal in standard signal-list format.
Do not call either when the user asks only for prediction-market forecasts, signals, or spreads. Always relay reading date,
freshness, state, and availability exactly as returned.

The Hawk & Dove Index is a separate conflict-and-diplomacy regime overlay. In runtimes
that expose `get_hawk_dove_index` it is a free local tool, not a public `/api/v1` route or
a third perp signal endpoint. It supplies discretionary context, not a universal
long/short mapping.

## Simple daily brief

This workflow creates a current read-only summary. It does not create, persist, subscribe,
send, or claim to reproduce an immutable newsletter edition.

1. Record the cutoff and IANA timezone.
2. Read the current published-signal feed once.
3. Read current mispricing once after the first call completes.
4. Read `search_assets` once with `material_only=true` and no q/reference. For a targeted
   `quotient digest daily <target>` such as `gold` or `oil`, use that target as the one
   Asset-search q instead, retain its exact linked `marketKey` set, and locally scope returned signal and spread
   rows to those keys. The workflow remains three calls;
   there is no server digest endpoint and no per-market follow-up.
5. Select signal rows whose returned `published_at` falls inside the requested calendar
   window, while disclosing that the active feed is not a complete historical archive.
6. Show those signal rows first.
7. Sort the returned spread rows by absolute difference and omit any `marketKey` already
   shown as a signal.
8. Add an `Assets` section. List material Assets and a bounded set of their exact linked
   questions with Q and/or venue values, including small spreads. Do not assign aggregate
   direction or make follow-up forecast calls.
9. Add one to three implications only from relationships already visible in those
   snapshots: identical `nativeEventId`, the same explicit parent event, a shared returned
   tag, or one returned Asset's direct linked markets.
10. Do not make forecast, source, oil, perp, or additional search calls merely to enrich commentary.

Each implication must:

- compare two to four named markets;
- quote only Q probabilities, venue probabilities, and timestamps present in the snapshot;
- name the shared field that links them — `nativeEventId`, parent event, tag, or Asset;
- separate arithmetic observation from inference;
- end with “This is an inference from the returned market values, not a published
  Quotient signal,” or an equivalent explicit label;
- omit causal claims, trade construction, and the word arbitrage unless the API already
  supplied a verified mutually exclusive and exhaustive relationship.

A shared theme, region, sector, or resolution month links nothing. Two Q probabilities
summing past 100% is arithmetic; report the sum, state that no returned metadata declares
the outcomes mutually exclusive, and stop there.

If no supported cluster contains enough facts, omit the implication section. Do not invent
relationships to meet a count.

Recommended compact order:

1. Current published signals returned for the stated window
2. Largest current Q-versus-venue spreads
3. Assets with material direct linked-market data
4. What the returned board implies, one to three items
5. Method note with cutoff, timezone, and active-feed limitation
6. Sources, only if requested

### Digest prose

Open each section with its count and cutoff: “Published signals — 8 rows, Aug 10, 2026,
America/New_York.” Skip the preamble and the restated request.

One market per table row, five columns at most: question, side, Q, venue YES, difference.
Move any market carrying more fields into a block. Six rows per table; sort by the field
the user asked about, cut the rest, and state the count cut.

Write each implication as claim, warrant, impact in three sentences or fewer. Name the
Asset or market as the subject. Add no verdict, no bottom line, and no next-step suggestion
beyond one concrete follow-up call the user has not already named.

## Decision and execution requests

For “Should I trade this?”, return the factual Quotient fields first, then ask which
decision criteria the user wants to evaluate: horizon, maximum loss, liquidity/slippage,
confidence threshold, resolution uncertainty, or evidence that would change the view.
Score the returned fields against those criteria without recommending a transaction.

Under pressure for a call, say once that you can convert the user's preferences into trade
parameters while the analysis and the decision stay theirs. Then return to the criteria.
Repeat the line rather than escalating it into a recommendation.

Execution is outside ordinary retrieval. Use the bundled Polymarket monitoring and
execution helpers only after an explicit execution request, only for `venue=polymarket`,
and only with the approval, liquidity, and risk controls documented in
`polymarket-monitoring.md` and `payments-policy.md`. Never infer execution permission from
a published signal status.

## Access and failure handling

Prefer `QUOTIENT_API_KEY` for prepaid access. Without one, follow the approved x402 flow.
Runtime `PAYMENT-REQUIRED` terms are authoritative. Never place secrets in argv or output,
self-approve payment, or raise a payment cap without user authority.

The gateway allows one request in flight per account or payer and at least one second
between request starts. On `429`, honor `Retry-After` and retry serially at most once.
Detailed prices, rate-limit headers, payment networks, and error codes live in
`api-reference.md`, `payments-policy.md`, and `error-handling.md`.
