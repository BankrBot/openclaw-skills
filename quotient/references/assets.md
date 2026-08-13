<!-- GENERATED from public/skill/references/assets.md — edit there, then npm run skill:build -->

# Asset identity and linked-market intelligence

The forecasting intelligence platform for agentic traders.

Use this reference when a request starts from an underlying company, commodity,
cryptoasset, ticker, platform identifier, or portfolio holding rather than from one known
prediction-market question.

## Product model

An Asset is the canonical underlying `:Asset:Entity` graph node. It has:

- UUID `id` and globally unique namespaced `assetKey`;
- `name`, optional `ticker`, `asset_type`, and `aliases`;
- exact `identifiers[{platform, kind, value}]`;
- active prediction markets connected directly by `HAS_MARKET`.

The Asset itself has no Q probability. Each linked market has its own question, threshold,
date, venue odds, and optional `latest_q_probability`. Do not average, union, or otherwise
turn those values into “the probability Gold rises” or another Asset-level direction.

`HAS_MARKET` means the contract is directly about the underlying. It is intentionally
separate from broader causal `AFFECTS` relationships. Asset search returns only direct
links.

Seeded platform identifiers include Oil `xyz:CL`, Gold `xyz:GOLD`, Silver `xyz:SILVER`,
Platinum `xyz:PLATINUM`, Natural Gas `xyz:NATGAS`, Bitcoin `BTC`, and Ether `ETH`.
These are searchable Asset identities and linked-market coverage, not claims that a
directional signal is published for each instrument.

Enriched Asset and linked Market rows also carry a bounded, flat `relationships` envelope
with lightweight Asset, Market, and Signal refs. It is non-recursive, capped at 50 refs per
category, and has explicit truncation flags. `via: direct` is one hop; `via: market|asset`
is one explicit two-hop path, whose `direction` is relative to that intermediate node.
Preserve exact edge provenance; the envelope does not create an Asset-level probability
or infer `AFFECTS`.

## Choose list or search

Use the directory when only identity metadata is needed:

```bash
quotient assets list
quotient assets list --platform hyperliquid --asset-type commodity
# raw: GET /api/v1/assets?platform=hyperliquid&asset_type=commodity
```

The list is complete under its filters and contains no linked markets, Q probability,
venue odds, forecasts, or signals. `linked_market_count` is metadata only.

Use search for intelligence:

```bash
quotient assets search "Apple"
quotient assets search "AAPL"
quotient assets search "xyz:GOLD" --platform hyperliquid
quotient assets search "*" --material-only
```

Raw search accepts exactly one selector family:

- `q=<text>` searches UUID, assetKey, name, ticker, aliases, and identifier values. `q=*`
  returns the enriched filtered directory.
- repeatable `reference=<exact>` accepts up to 50 Asset UUID/key values, AssetIdentifier
  key/value values, or linked Market `marketKey`/native IDs.

Optional `platform` and `asset_type` filters apply to either mode. `material_only=true`
keeps Assets having at least one active direct linked market with non-null `market_odds`
or `latest_q_probability`. It does not prune the qualifying Asset's other active direct
markets. A published signal alone is not the materiality rule.

Search costs the same as plain market search. It returns every active direct linked market,
including small or zero Q-versus-venue spreads and markets whose Q probability is null.
Those markets may come from Polymarket International (`polymarket`), Polymarket US
(`polymarket_us`), Kalshi, or Limitless. `market_odds` is the venue-neutral current YES
probability across all four venues.

For a targeted brief such as `quotient digest daily gold`, resolve `gold` with the single
Asset-search call, collect the returned linked `marketKey` values, and filter the already
returned signal and spread payloads locally to those exact keys. Do not add calls or invent
a server-side digest route.

## Identifier boundaries

Preserve `AssetIdentifier.value` exactly, including punctuation and case such as
`xyz:GOLD`. `platform + kind + value` defines its namespace; ticker alone is not globally
unique.

Prediction-market identifiers stay on the Market routing envelope:

- `marketKey`
- `nativeMarketId`
- `nativeEventId`
- `seriesTicker`
- legacy condition IDs where applicable

An exact Market reference may traverse to an Asset, but it does not become an Asset
identifier.

## Portfolio and holding lookup

`quotient portfolio report` reads wallet-addressed positions on Polymarket, Polymarket
perps, Limitless, and Hyperliquid. Pass a Hyperliquid wallet with
`--venue hyperliquid --hyperliquid-wallet 0x...`, and use `--venue` to name any subset.

Kalshi, Polymarket US, equity brokers, and other integrations have no wallet-addressed read
here. For those holdings, resolve the ticker or exact platform identifier through Asset
search instead of passing it to the portfolio endpoint.

When another integration or the user supplies holdings:

1. Take each distinct canonical ticker or exact platform identifier.
2. Resolve up to 50 exact values in one Asset search when possible.
3. Reuse all returned `linked_markets`; do not make one forecast call per market.
4. Present each exact market question with venue odds, Q probability when present, and
   timestamp.
5. Call `/signals/perps` only when the user asks for the WTI oil signal in signal-list
   format. Other Assets should use Asset search and their linked prediction markets.

Example: a Hyperliquid holding in `xyz:GOLD` should resolve the Gold Asset. Its linked
Polymarket, Kalshi, or other prediction-market contracts provide context even when Q and
the venue broadly agree. That does not mean Quotient publishes a Gold directional signal.

## Neutral output

Apply `writing-style.md` to every Asset section. Report the identity line, then one block
or row per linked market. A table stays inside five columns and six rows; a market carrying
more fields uses the block form.

```text
Gold (GOLD) · commodity:gold
Identifier        hyperliquid coin xyz:GOLD

Gold above $2,400 in August
Q forecast        86.0%
Venue YES         87.0%
Difference        Q -1.0 pp
Forecast time     Aug 8, 11:11 PM PDT
Published signal  None
Market            https://...
```

Small differences are still factual Asset intelligence. Never label them actionable,
attractive, safe, or immaterial, and never infer spot/perp direction from one binary
threshold contract.

Group linked markets under the Asset that returned them. Comparing two Assets requires a
shared returned field — the same parent event, tag, or linked market. Shared sector,
country, or resolution month supports no comparison.
