# Trending feed + daily post — `GET /api/partner/trending`

The hottest LIVE Hunch markets right now, ranked by betting action, plus a
**post-ready digest** the bot can drop into a thread verbatim. Read-only — no
payment, no money path. Two uses:

- **Surface a market unprompted** — "markets heating up on Hunch" in a reply.
- **Run a daily post** — drop `digest.text` as-is into a scheduled Bankr post.

## Request

```
GET /api/partner/trending?limit=<1..25>      # default 6
```

Feature-flagged behind `HUNCH_PARTNER_API` (404 when off); CORS-open; cached ~60s.

## Response

```json
{
  "meta": { "name": "…", "version": "hunch-partner-api-v1", "generatedAt": "…", "docsUrl": "…" },
  "generatedAt": "2026-06-01T12:00:00.000Z",
  "count": 6,
  "trending": [
    {
      "rank": 1,
      "heat": 1240,
      "closesInHours": 18,
      "market": {
        "id": "bankr-100m-mcap-2026-06-30",
        "question": "Will $BNKR reach $100M market cap by June 30, 2026 at 11:59 PM UTC?",
        "shortTitle": "$BNKR → $100M",
        "deadlineLabel": "Jun 30",
        "links": { "app": "…", "quote": "…", "trade": "…" }
      },
      "odds": { "yesPriceCents": 62, "noPriceCents": 38 },
      "stats": { "totalBets": 142, "totalPoolUsd": 1240, "yesPoolUsd": 150, "noPoolUsd": 1090, "feeUsd": 24.8 },
      "headline": "$BNKR → $100M · YES 62¢ / NO 38¢ · 142 bets · $1.2k pool · closes Jun 30 · @playhunchxyz"
    }
  ],
  "digest": {
    "title": "🔮 Trending on Hunch",
    "lines": ["1. $BNKR → $100M — YES 62¢ · 142 bets · closes Jun 30"],
    "text": "🔮 Trending on Hunch\n1. $BNKR → $100M — YES 62¢ · 142 bets · closes Jun 30\n\nTag @bankrbot to bet in-thread — settles in USDC on Base. @playhunchxyz"
  }
}
```

Each `trending[]` entry: `rank` (1-based), `heat` (score), `closesInHours`,
`market` (the full shared [market ref](./market-ref.md), abbreviated above),
`odds`, `stats` (same shapes as `discovery.md`), and a **`headline`** — the same
screenshot-ready one-liner a discover match carries (`title · odds · social proof
· close`), so surfacing a trending market unprompted reads identically to a
discovered one. `count` is the number of entries; the top-level `generatedAt`
mirrors `meta.generatedAt`.

## Ranking

`heat = pooled USD + bet count`, over **discoverable** markets only (status
`open`, deadline in the future). Ties break to the soonest deadline, then the
market id — fully deterministic. When activity is low the feed falls back to
closing-soonest, so a daily post is always populated with live, actionable
markets. The id comes from the deterministic ranker; the model never picks it.

## Using it

- **Daily post:** post `digest.text` verbatim (it already names `@bankrbot`, the
  Base USDC settlement, and tags `@playhunchxyz`). Each entry's `headline` also
  ends with the project @tags — keep them when rendering a single entry.
- **Custom card:** iterate `trending[]` and render each entry's `market` + `odds`
  with the standard `Take YES / Take NO` reply shape.
- Always include the market's category disclosure line (from `catalogue`) before
  confirming any bet.
