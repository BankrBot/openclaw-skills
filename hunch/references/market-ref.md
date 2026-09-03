# The market ref (shared object)

Every endpoint that names a market embeds the **same** `PartnerMarketRef` object —
`discover` (under `matches[].market`), `quote` (`market`), `catalogue`
(`categories[].markets[]`, plus two extra fields), `trending`
(`trending[].market`), and `proof` (`market`). Documented once here; the other
reference files link back to this table instead of repeating it.

It is a stable, additive contract: fields are only ever added, and the
`meta.version` string (`hunch-partner-api-v1`) bumps on any breaking change so
Bankr can pin.

### Fields

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Canonical market id — the value you echo into `quote` / `trade`. **Always use this verbatim; never hand-craft it.** e.g. `bankr-100m-mcap-2026-06-30`. |
| `slug` | string | Short URL slug, used in the app link. e.g. `bankr-100m`. Resolvable in `quote`/`trade` too (id or slug both work), but prefer `id`. |
| `question` | string | The full market question. Use as the headline in the reply. |
| `shortTitle` | string | Compact title for chips / digests, e.g. `$BNKR → $100M`. |
| `summary` | string | One-line plain-English summary of the market. |
| `category` | string | **Internal** resolver metric (`market_cap`, `token_mcap_flip`, `token_mcap_range`, `launchpad_volume_winning_days`, `launchpad_rank_days`, `launchpad_token_mcap_count`, `token_return_compare`, `token_outperform`, `price_direction`). For the *outward* category + disclosure, see `catalogue.md`. |
| `tokenSymbol` | string | The primary token the market is about (no `$`), e.g. `BNKR`. |
| `chainId` | string | Settlement / data chain, e.g. `base`. |
| `deadlineAt` | string (ISO 8601) | When the market closes, UTC. **Note the field name is `deadlineAt`, not `deadline`.** |
| `deadlineLabel` | string | Short human close label, e.g. `Jun 30`. Use in replies/digests. |
| `status` | string | `open` while bettable. Discovery / catalogue / trending only ever return `open` markets. |
| `feeBps` | number | Trading fee in basis points (e.g. `200` = 2%). This is the source of truth for the fee — don't hard-code 2%. |
| `feeRecipientLabel` | string | Human label for where the fee goes, e.g. `Hunch market treasury`. |
| `defaultTicketUsd` | number | Suggested default bet size in USD (`1`). |
| `virtualLiquidityUsd` | number | Seed liquidity depth the odds are computed against (`10000`) — context for how much a bet moves the price. |
| `targetMarketCapUsd` | number \| null | The fixed market-cap target line, for `market_cap` milestone markets only; `null` for every other type. |
| `outcomes` | array \| null | The pickable rungs of an N-way **ladder** market (`token_mcap_range`); `null` for binary YES/NO markets. See the table below + `quote.md`. |
| `links` | object | `{ app, quote, trade }` — see below. |

### `outcomes[]` (ladder markets only)

`null` for binary markets. For a `token_mcap_range` strike-ladder it is the
static rung structure (no odds — live per-rung odds arrive on the `quote`
response's `ladder` block):

| Field | Type | Meaning |
|---|---|---|
| `key` | string | Stable outcome key — this is the `side` you pass to `quote`/`trade` for a ladder. e.g. `63m-67m`. |
| `label` | string | Full label, e.g. `$63M – $67M` / `Below $58M` / `$80M or more`. |
| `shortLabel` | string | Compact label for chips, e.g. `$63–67M` / `≤$58M` / `≥$80M`. |
| `lowerUsd` | number \| null | Inclusive lower bound USD; `null` = open-ended below. |
| `upperUsd` | number \| null | Exclusive upper bound USD; `null` = open-ended above. |

### `links`

| Field | Meaning |
|---|---|
| `app` | The durable, human-verifiable market page (`/markets/<slug>`). Use as the share/proof link. |
| `quote` | Pre-built `quote` URL for this market id. |
| `trade` | The trade endpoint (`/api/partner/trade`). |

### `meta` (on every response)

Every endpoint wraps its payload with a `meta` block:

```json
"meta": {
  "name": "PlayHunch partner discovery API",
  "version": "hunch-partner-api-v1",
  "generatedAt": "2026-06-01T12:00:00.000Z",
  "docsUrl": "https://www.playhunch.xyz/base-mcp"
}
```

Pin on `meta.version`. (The field is `docsUrl`, not `docs`.)
