# Social Enrichment — Opt-In Two-Step Flow

Pass `?social=true` to enable checkr social signal enrichment. Adds +$0.45 USDC billed to the caller. Without it, `observed.social` reads `{ "status": "unavailable" }`.

## Step 1 — Fetch checkr signal for the CA

```
GET https://api.checkr.social/v1/token/{ca}
```

Use `call_x402_endpoint` (or equivalent) with the CA directly — no symbol lookup needed.

## Step 2 — POST to oracle with checkr_meta body

```json
{
  "social_score": <ais normalized to 0-1>,
  "checkr_meta": {
    "sentiment_score": <ais>,
    "momentum": <velocity>,
    "mention_velocity": <velocity>,
    "influencer_hits": <Math.round(cascade_multiplier)>
  }
}
```

## Field mapping

| checkr field | oracle POST field |
|---|---|
| `ais` | `sentiment_score` + `social_score` (already 0–1) |
| `velocity` | `momentum` + `mention_velocity` |
| `cascade_multiplier` | `influencer_hits` (round to int) |

The oracle blends `social_score` into the fused score at 15% weight (25% when no quant prior is present).

## Fallback

If the checkr fetch fails for any reason, silently fall back to a plain GET (quant-only, no social). Do not halt or surface the error to the user.
