# Quote contract

`GET https://www.playhunch.xyz/api/partner/quote`

Live YES/NO (or per-rung) odds **and** a full cost breakdown for a chosen market —
the pricing call between `discover` and `trade`. Read-only, CORS-open, cached
~20s. 404 when the partner API is off.

### Params

| Param | Required | Meaning |
|---|---|---|
| `marketId` | **yes** | The market `id` (or `slug`) from `discover` / `catalogue`. Resolves recurring up/down round ids too. Missing → `422 market_id_required`; unknown → `404 market_not_found`. |
| `side` | no | `yes` / `no` for binary markets (default `yes`). For a **ladder** it's the bucket `key` — but use `outcome` for that. |
| `sizeUsd` | no | Bet size to price. Clamped to **$0.50–$10** for the quote (note: a real **bet settles $1–$10**). Default `1`. |
| `outcome` | no | **Ladder only** — the bucket `key` to price (e.g. `63m-67m`). Defaults to the rung the live cap currently sits in, then the first rung. |

### Response — binary (YES/NO) market

```json
{
  "meta": { … },
  "market": { … shared market ref … },
  "side": "yes",
  "sizeUsd": 5,
  "odds": { "yesPriceCents": 12, "noPriceCents": 88 },
  "stats": { "totalBets": 142, "totalPoolUsd": 1240, "yesPoolUsd": 150, "noPoolUsd": 1090, "feeUsd": 24.8 },
  "tokenSnapshot": {
    "tokenSymbol": "BNKR",
    "currentMarketCapUsd": 52000000,
    "currentPriceUsd": 0.052,
    "targetMarketCapUsd": 100000000,
    "distanceToTargetPct": 92.31,
    "reachedTarget": false,
    "source": "dexscreener",
    "sourceUrl": "https://dexscreener.com/base/0x…",
    "observedAt": "2026-06-01T12:00:00.000Z"
  },
  "quote": {
    "side": "yes",
    "priceCents": 12,
    "grossUsd": 5,
    "feeUsd": 0.1,
    "netUsd": 4.9,
    "shares": 40.83,
    "feeRecipient": "Hunch market treasury"
  },
  "tags": "@playhunchxyz"
}
```

- `market` — the shared [market ref](./market-ref.md).
- `odds` — live `{ yesPriceCents, noPriceCents }` (50/50 fallback if unreadable).
- `stats` — bet activity (same shape as discover; see `discovery.md`).
- `tags` — **project attribution**, `@playhunchxyz` + the token project when
  verified (e.g. a `$LFI` quote returns `"@playhunchxyz @lienfiapp"`). Always
  present. **Render attribution exactly once.** If the reply leads with the discover
  `headline`, that string **already ends with these same tags** (identical builder) —
  render the headline verbatim and **do NOT also append this line.** Use `tags` as
  the last line only when the reply has **no** headline (a bare quote). Treat it like
  the disclosure — never strip it, never duplicate it (SKILL.md *Project attribution*).
- `quote` — the cost breakdown for `side` at `sizeUsd`:

| Field | Meaning |
|---|---|
| `side` | The side priced. |
| `priceCents` | Entry price, ¢ per share (the YES or NO price). |
| `grossUsd` | The amount staked (= `sizeUsd`). |
| `feeUsd` | Trading fee taken (`feeBps` of gross). |
| `netUsd` | Amount that actually buys shares (`grossUsd − feeUsd`). |
| `shares` | Shares received; each pays **$1** if this side wins. |
| `feeRecipient` | Where the fee goes (label). |

### `tokenSnapshot` (market-cap milestone markets only)

A live DexScreener reading with distance-to-target — the hook that turns a
TA-style answer into a concrete market ("$BNKR at $52M, needs $100M → +92%").
**`null`** for every non-`market_cap` market (flip, ladder, launchpad,
head-to-head, up/down) and `null` on any read error (fail-soft, never throws).

| Field | Meaning |
|---|---|
| `tokenSymbol` | Token (no `$`). |
| `currentMarketCapUsd` | Live cap from DexScreener (Base, stable-pair selected). |
| `currentPriceUsd` | Live token price, or `null`. |
| `targetMarketCapUsd` | The fixed target line (same as the ref's `targetMarketCapUsd`). |
| `distanceToTargetPct` | % the cap must still move to hit target. **Negative = already past it.** |
| `reachedTarget` | `true` once the cap ≥ target. |
| `source` / `sourceUrl` | Always `dexscreener` + the specific pair link. |
| `observedAt` | ISO timestamp of the reading. |

### Response — ladder (`token_mcap_range`) market

A strike-ladder prices a **chosen rung** off the parimutuel book, not a flat
YES/NO. `odds` becomes a **map keyed by bucket** (implied % per rung), `side` is
the priced bucket key, `tokenSnapshot` is `null`, and a live `ladder` block is
added:

```json
{
  "meta": { … },
  "market": { … ref; its "outcomes" lists the rungs … },
  "side": "63m-67m",
  "sizeUsd": 5,
  "odds": { "below-58m": 8, "58m-63m": 22, "63m-67m": 35, "67m-72m": 20, "80m-or-more": 15 },
  "stats": { "totalBets": 60, "totalPoolUsd": 300, "yesPoolUsd": 0, "noPoolUsd": 0, "feeUsd": 6 },
  "ladder": {
    "outcomes": [
      { "key": "63m-67m", "label": "$63M – $67M", "shortLabel": "$63–67M",
        "lowerUsd": 63000000, "upperUsd": 67000000,
        "impliedPct": 35, "backedUsd": 105, "isCurrent": true }
    ],
    "currentBucketKey": "63m-67m",
    "currentMarketCapUsd": 64200000,
    "totalBackedUsd": 300
  },
  "tokenSnapshot": null,
  "quote": { "side": "63m-67m", "priceCents": 35, "grossUsd": 5, "feeUsd": 0.1,
             "netUsd": 4.9, "shares": 14, "feeRecipient": "Hunch market treasury" },
  "tags": "@playhunchxyz"
}
```

- The pickable rungs are static on every `discover`/`catalogue` result
  (`market.outcomes` — see [market ref](./market-ref.md)), so you can render
  "pick the closing range" with no extra call; live odds + backing arrive here.
- `ladder.outcomes[]` adds, per rung: `impliedPct` (whole-percent implied chance,
  sums ~100), `backedUsd` (USD on that rung), `isCurrent` (the token's live cap
  sits in this rung right now).
- `ladder.currentBucketKey` / `currentMarketCapUsd` — where the cap is now.
- `ladder.totalBackedUsd` — total across all rungs.
- To price a specific rung, pass `?outcome=<key>`; omitted → the current rung,
  then the first.

### Reply shape

By quote time you have the discover `headline` **and** the live `tokenSnapshot`,
so add the distance hook and sized actions:

> **{discover `headline`}**
> {distance hook}
> _{category disclosure}_
> [Take YES] [Take NO] · size [$1] [$5] [$10]

- **Distance hook** (market-cap markets): `"📈 $52M now · +92% to $100M"`, from
  `tokenSnapshot.currentMarketCapUsd` / `distanceToTargetPct` /
  `targetMarketCapUsd` (`reachedTarget: true` → "already past $100M ✅"). It turns
  a price answer into a reason to bet. `tokenSnapshot` is `null` for every
  non-market-cap market — just omit the line.
- **Size chips** — `[$1] [$5] [$10]` (band $1–$10) with `defaultTicketUsd`
  pre-selected; accept any custom $1–$10. Don't make the user type a number.
- **Ladder** — list rungs with their `impliedPct`, mark the `isCurrent` rung, and
  let the user pick one + a size (no YES/NO on an N-way market).
- **Attribution (tag once)** — the reply above leads with the discover `headline`,
  which already ends with the project tags, so it carries the attribution — **don't
  also append the `tags` line** (that double-tags). The separate `tags` field is for
  a quote reply that does *not* render the headline.

### Errors

| Status | Body | Meaning |
|---|---|---|
| `422` | `{ error: "market_id_required" }` | No `marketId` given. |
| `404` | `{ error: "market_not_found", marketId }` | No live market with that id/slug. Re-run `discover`. |
| `404` | `{ error: "partner_api_disabled" }` | Endpoint is off. |
