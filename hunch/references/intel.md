# references/intel.md — Hunch Intelligence (crowd-conviction signal)

`GET /api/partner/intel?token=$SYMBOL` — a single sentiment read for a token,
synthesised from every live Hunch market's odds, pool-weighted by real on-chain
betting depth. Free, read-only, CORS-open, flag-gated behind `HUNCH_PARTNER_API`
(404 when off). Wraps its payload in the shared `meta` block.

Accepts `$BNKR`, `BNKR`, or `bnkr`. Returns `422 invalid_token` for a malformed
symbol.

## Response

```json
{
  "meta": { "version": "hunch-partner-api-v1", "generatedAt": "…" },
  "token": "bnkr",
  "intel": {
    "hasSignal": true,
    "marketCount": 7,
    "sentiment": {
      "score": 68,                 // 0-100, 50 = neutral
      "lean": 18,                  // score - 50
      "label": "strongly_bullish", // strongly_bullish·bullish·neutral·bearish·strongly_bearish
      "basis": "pool_weighted",    // pool_weighted·equal_weight·none
      "confidence": "low",         // high·medium·low·none (by USD backing the signal)
      "directionalMarketCount": 4,
      "directionalPoolUsd": 4
    },
    "suggestedBet": {
      "marketId": "bankr-100m-mcap-2026-06-30",
      "side": "yes",
      "sideLabel": "YES",          // "UP"/"DOWN" for up/down rounds, else YES/NO
      "impliedCents": 68,
      "betUrl": "https://www.playhunch.xyz/quick/bankr-100m-mcap-2026-06-30?side=yes&ref=x402"
    },
    "quality": { "distinctBettors": 3, "topWalletPct": 71.4, "label": "concentrated" },
    "activity": { "totalBets": 4, "totalPoolUsd": 5 },
    "topMarket": { "id": "…", "shortTitle": "…", "kind": "binary", "yesPriceCents": 68, "appUrl": "…" },
    "markets": [ /* per-market breakdown */ ],
    "summary": "$BNKR — Hunch crowd: 68/100 (strongly bullish, low confidence) across 7 markets · $5 pooled.",
    "asOf": "…"
  }
}
```

## How the score works

- Only the token's DIRECTIONAL price markets feed the score (market-cap
  milestones, close-above-strike, up/down rounds — "YES = number up"). Flips,
  ladders, and chain-metric markets count as activity, not the directional read.
- It's a pool-weighted average of the implied YES odds across those markets;
  with no money down it falls back to an equal-weight average (low confidence).
- `quality` is computed from the directional markets' settled trades —
  `broad` (many wallets), `mixed`, `concentrated` (one whale / ≤ 2 wallets), or
  `none`. It says how solid the conviction behind the score is.

## Using it in a reply

1. Lead with `summary` verbatim.
2. If `suggestedBet` is present, offer it with `betUrl` as the one-tap link:
   "Back {sideLabel} on {shortTitle}? Tag @bankrbot to bet — settles in USDC on
   Base."
3. Caveat a `concentrated` pool (one whale); `broad` conviction is stronger.
4. `hasSignal: false` → Hunch has no market on that token yet; don't invent a
   signal — fall back to the normal discover flow.

Read-only — no payment, no money path. The paid x402 Cloud edge (`hunch-intel`)
wraps this exact read for agents that pay per call; the reply path here uses the
free endpoint.
