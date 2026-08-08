# Launch catalogue

`GET https://www.playhunch.xyz/api/partner/catalogue`

The vetted "what can the bot offer" surface — every launch-ready market grouped
by outward category, each with a disclosure line. Brand-safe by construction:
only live, open, future-deadline markets that map to a known category appear (a
market with no resolution source can never surface here). Read-only, CORS-open,
cacheable — **no live odds** (call `quote` for pricing). 404 when the partner API
is off.

### Categories (all five)

| key | label | asks | maps from (internal metric) |
|---|---|---|---|
| `token-milestone` | Token milestone | a token reaches a market-cap target, or one token flips another | `market_cap`, `token_mcap_flip` |
| `mcap-ladder` | Market-cap range | which mcap range a token closes inside (a strike ladder) | `token_mcap_range` |
| `launchpad-race` | Launchpad race | which launchpad wins on volume / #1-days / launches over a cap | `launchpad_volume_winning_days`, `launchpad_rank_days`, `launchpad_token_mcap_count` |
| `head-to-head` | Head-to-head | which token outperforms over a window | `token_return_compare`, `token_outperform` |
| `price-direction` | Up or down | a token closes a round above/below its open | `price_direction` |

Categories appear in this order, and an empty category is omitted.

### Disclosures (verbatim — surface before any bet)

| key | disclosure |
|---|---|
| `token-milestone` | Resolves from DexScreener market cap on Base. Outcome locks YES the instant the target is reached. Not financial advice. |
| `mcap-ladder` | Resolves to the single range containing the token's DexScreener market cap on Base at the close. Winners split the pool pro-rata (parimutuel). Not financial advice. |
| `launchpad-race` | Resolves from on-chain launchpad volume (Dune) and DexScreener caps. Not financial advice. |
| `head-to-head` | Resolves from DexScreener window-edge prices at the deadline. Not financial advice. |
| `price-direction` | Resolves from the round's open vs close price on Base. Not financial advice. |

The API returns the live disclosure on each category, so prefer the value from
the response; this table is the reference copy.

### Response

```json
{
  "meta": { "name": "…", "version": "hunch-partner-api-v1", "generatedAt": "…", "docsUrl": "…" },
  "count": 18,
  "categories": [
    {
      "key": "token-milestone",
      "label": "Token milestone",
      "description": "Will a token reach a market-cap target (or flip another token) before a deadline?",
      "disclosure": "Resolves from DexScreener market cap on Base. Outcome locks YES the instant the target is reached. Not financial advice.",
      "count": 11,
      "markets": [
        {
          "id": "bankr-100m-mcap-2026-06-30",
          "slug": "bankr-100m",
          "question": "Will $BNKR reach $100M market cap by June 30, 2026 at 11:59 PM UTC?",
          "shortTitle": "$BNKR → $100M",
          "category": "market_cap",
          "tokenSymbol": "BNKR",
          "deadlineAt": "2026-06-30T23:59:00.000Z",
          "deadlineLabel": "Jun 30",
          "feeBps": 200,
          "targetMarketCapUsd": 100000000,
          "outcomes": null,
          "links": { "app": "…", "quote": "…", "trade": "…" },

          "categoryKey": "token-milestone",
          "tokenSymbols": ["bnkr"]
        }
      ]
    }
  ]
}
```

Each entry in `markets[]` is the full shared [market ref](./market-ref.md)
(abbreviated above) **plus two catalogue-only fields**:

| Field | Meaning |
|---|---|
| `categoryKey` | The outward category this market is grouped under. |
| `tokenSymbols` | Every token symbol the market is "about" (lower-cased, no `$`) — both sides of a flip / head-to-head. |

`count` (top level) is the total market count across all categories.

Always surface the category `disclosure` before confirming a bet.
