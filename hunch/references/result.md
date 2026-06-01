# Result / resolution read

`GET https://www.playhunch.xyz/api/partner/result?marketId=<id>`

Read-only. How a market resolved (or that it hasn't yet). Fails soft to `pending`
when the market is still open or storage is unavailable — never throws. 404 when
the partner API is off; `422 market_id_required` with no `marketId`;
`404 market_not_found` for an unknown id.

Use for: "did my market resolve", "who won the $BNKR market", "what was the payout".

> **Shape note:** the resolution lives **nested under `result`**, with `meta` as
> its sibling — `{ meta, result: { … } }`. It is not flat on the response.

### Response — pending (still open)

```json
{
  "meta": { "name": "…", "version": "hunch-partner-api-v1", "generatedAt": "…", "docsUrl": "…" },
  "result": {
    "marketId": "bankr-100m-mcap-2026-06-30",
    "status": "pending",
    "resolvedOutcome": null,
    "resolvedOutcomeLabel": null,
    "resolvedAt": null,
    "source": "dexscreener",
    "sourceUrl": null,
    "observedMarketCapUsd": null,
    "payoutPerShareUsd": null,
    "poolUsd": 0,
    "winningShares": 0,
    "proofUrl": null
  }
}
```

### Response — resolved

```json
{
  "meta": { … },
  "result": {
    "marketId": "hunch-10m-mcap-2026-05-31",
    "status": "resolved",
    "resolvedOutcome": "no",
    "resolvedOutcomeLabel": "NO",
    "resolvedAt": "2026-06-01T00:00:00.000Z",
    "source": "dexscreener",
    "sourceUrl": "https://dexscreener.com/base/0x…",
    "observedMarketCapUsd": 142000,
    "payoutPerShareUsd": 1.0,
    "poolUsd": 590.53,
    "winningShares": 590.53,
    "proofUrl": "https://www.playhunch.xyz/markets/hunch-10m"
  }
}
```

### Fields (`result`)

| Field | Meaning |
|---|---|
| `marketId` | The market id. |
| `status` | `pending` until settled, then `resolved`. |
| `resolvedOutcome` | Raw winning side key (`yes`/`no`, or a bucket key for ladders). `null` while pending. |
| `resolvedOutcomeLabel` | Display label — `UP`/`DOWN` (price-direction), a bucket label (ladder), or `YES`/`NO`. `null` while pending. |
| `resolvedAt` | ISO timestamp of resolution; `null` while pending. |
| `source` | Resolution data source (the market's `resolutionSource`, e.g. `dexscreener` / `dune`). |
| `sourceUrl` | Link to the specific reading, when captured; `null` while pending. |
| `observedMarketCapUsd` | The cap observed at resolution (mcap markets); `null` otherwise / while pending. |
| `payoutPerShareUsd` | Parimutuel payout per **winning** share, computed from the full settled book. `null` while pending or if no winning shares. |
| `poolUsd` | Total pool, USD. |
| `winningShares` | Total winning shares across the book. |
| `proofUrl` | The durable, human-verifiable market page. `null` while pending. |

### Reply shape

> **Resolved: NO.** $HUNCH didn't reach $10M (closed ~$142K). Winning shares paid
> $1.00 each from a $590.53 pool. Proof → playhunch.xyz/markets/hunch-10m

While pending:

> **Still open** — resolves at the deadline. Want a position? [Take YES] [Take NO]
