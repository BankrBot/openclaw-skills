# Capacitr API reference

Canonical endpoint shapes. The discovery preflight at
`/api/skill/discovery` is authoritative for which endpoints are live
and their current prices; this file documents the steady-state contract.

## Discovery

`GET /api/skill/discovery`

Public, no auth, cached 30 seconds.

Response:
```json
{
  "version": 1,
  "prices_version": "<short hex>",
  "base_url": "https://app.capacitr.xyz",
  "auth_methods": {
    "privy_jwt": { "header": "Authorization", "scheme": "Bearer" },
    "skill_key": { "header": "x-capacitr-skill-key", "prefix": "csk_live_" },
    "x402":      { "header": "X-Payment", "spec": "x402/v1" }
  },
  "assets": [
    {
      "symbol": "usdc",
      "address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "settlement": "facilitated",
      "prices": { "url_scan": 100000, "text_query": 50000 }
    }
  ],
  "accepts": {
    "url_scan":   [ /* x402 accepts entries */ ],
    "text_query": [ /* x402 accepts entries */ ]
  },
  "endpoints": [ /* method+path+description+auth */ ]
}
```

## Analyze link (paid)

`POST /api/analyze-link`

Body:
```json
{ "url": "https://x.com/example/status/123" }
```

or

```json
{ "query": "Iran oil sanctions" }
```

Headers when paid:
- `X-Payment: <base64 EIP-3009 authorization>`

Response on success:
```json
{
  "predictions":       [/* Polymarket */],
  "perps":             [/* Hyperliquid */],
  "options":           [/* Deribit */],
  "recommendedTrades": [/* short list */],
  "extracted": {
    "summary":     "…",
    "keywords":    ["…"],
    "entities":    ["…"],
    "tickers":     ["NVDA","BTC"],
    "categories":  ["ai","crypto"]
  },
  "searchId": "uuid"
}
```

Response on payment required:
```json
{
  "error": "Payment Required",
  "prices_version": "<short hex>",
  "x402": { "version": 1, "accepts": [ /* assets */ ] }
}
```

## Feed

`GET /api/feed?interests=crypto,ai,tech`

Auth required (skill key or Privy JWT). Default interests if omitted:
`crypto,ai,tech`.

Response:
```json
{
  "items": [
    {
      "title":   "…",
      "source":  "REDDIT" | "HACKER NEWS" | "GOOGLE NEWS",
      "url":     "https://…",
      "summary": "…",
      "publishedAt": "ISO-8601",
      "predictions": [/* with Quotient fields */],
      "perps":       [/* matched HL perps */],
      "options":     [/* matched Deribit */]
    }
  ]
}
```

Quotient fields on predictions when present: `quotientOdds` (fair
probability), `spread` (Q − market price), `spreadDirection`
(`"q_higher"` or `"q_lower"`), `bluf` (one-sentence thesis),
`signalCount` (analyst signals), `isQuotientSource`.

## Interests

`GET /api/interests` — `{ interests: string[] }`

`POST /api/interests` — body `{ interests: string[] (≤100, each ≤64 chars) }`. Returns `{ ok: true, count: number }`.

## Risk profile

`GET /api/risk-profile` — `{ profile: { tier, scores, completed_at } | null }`

`POST /api/risk-profile` — body `{ tier: string (≤32), scores: number[] }`. Returns `{ ok: true, tier }`.

## User

`GET /api/user` — `{ user: { id, privy_id, display_name, twitter_handle, farcaster_fid, created_at, interests: string[] } }`

## Chat (streaming)

`POST /api/chat`

Body:
```json
{
  "messages": [
    { "role": "user", "content": "What's mispriced on Polymarket today?" }
  ]
}
```

Validation: 1 ≤ `messages.length` ≤ 50, content ≤ 20k chars per message.

Returns a Vercel AI SDK SSE stream. Read line-by-line; tool calls
(`searchMarkets`, `getIntelligence`, `refreshFeed`) appear as JSON
deltas in the stream.

## Skill key management (JWT only)

`POST /api/skill-keys` — body `{ label?: string }`. Returns:
```json
{
  "key":        "csk_live_<48 hex>",
  "id":         "uuid",
  "prefix":     "csk_live_<8 hex>",
  "label":      "optional label",
  "created_at": "ISO-8601",
  "warning":    "Plaintext key shown once. Store it now; we cannot recover it."
}
```

`GET /api/skill-keys` — `{ keys: [{ id, prefix, label, last_used_at, created_at, revoked_at }] }`

`DELETE /api/skill-keys` — body `{ id: "<uuid>" }`. Soft-deletes by
setting `revoked_at`.

Every skill-key endpoint rejects requests that present an
`X-Capacitr-Skill-Key` header with `403` — skill keys cannot manage
other skill keys.
