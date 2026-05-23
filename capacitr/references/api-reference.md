# Capacitr API reference (skill scope)

Two endpoints relevant to this skill — discovery (always free, used for
preflight) and the single paid call.

## Discovery

`GET /api/skill/discovery`

Returns current pricing, accepted assets per route, EIP-712 domain
hints, and the canonical `accepts[]` shape used in 402 envelopes. Hit
this once at session start; re-fetch when a later 402 carries a
different `prices_version`.

```bash
curl -sS https://app.capacitr.xyz/api/skill/discovery | jq .
```

Response (truncated):

```json
{
  "version": 1,
  "prices_version": "<sha256 fingerprint>",
  "payee": "0x6503fB61705EB6B3C57EE1ab88a1a75A6eE01869",
  "assets": [
    { "symbol": "usdc",     "address": "0x833589…", "settlement": "facilitated" },
    { "symbol": "capacitr", "address": "0x65F8152809…", "settlement": "facilitated" }
  ],
  "accepts": {
    "text_query": [ /* AcceptEntry[] */ ],
    "url_scan":   [ /* AcceptEntry[] */ ]
  },
  "endpoints": [ /* … */ ]
}
```

## Analyze link (paid)

`POST /api/analyze-link`

The only x402-paid endpoint. Inputs:

```
{ "url":   "https://…" }      # one of these is required
{ "query": "free text" }
```

Optional: `mode` (`"discover"` default, or `"hedge"`), `maxMarkets`.

### 402 envelope

The 402 response carries the v2 payload in BOTH:

1. A base64-encoded `PAYMENT-REQUIRED` response header — the canonical
   x402 v2 transport. CDP Bazaar reads from here.
2. The JSON body (same shape) for v1 clients still reading
   `body.x402.accepts`.

```json
{
  "x402Version": 2,
  "error": "Payment Required",
  "resource": { "url": "https://app.capacitr.xyz/api/analyze-link",
                "mimeType": "application/json" },
  "accepts": [
    {
      "scheme": "exact",
      "network": "eip155:8453",
      "amount": "50000",
      "maxAmountRequired": "50000",
      "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "payTo": "0x6503fB61705EB6B3C57EE1ab88a1a75A6eE01869",
      "maxTimeoutSeconds": 300,
      "extra": { "assetTransferMethod": "eip3009", "symbol": "usdc",
                 "name": "USD Coin", "version": "2", "product": "Capacitr" }
    },
    {
      "scheme": "exact",
      "network": "eip155:8453",
      "amount": "1000000000000000",
      "maxAmountRequired": "1000000000000000",
      "asset": "0x65F8152809Dd1fC0D5d8A345c9008d37B95f9ba3",
      "payTo": "0x6503fB61705EB6B3C57EE1ab88a1a75A6eE01869",
      "maxTimeoutSeconds": 300,
      "extra": { "assetTransferMethod": "permit2", "symbol": "capacitr",
                 "name": "CAPACITR", "version": "1", "product": "Capacitr" }
    }
  ],
  "extensions": {
    "bazaar": { "info": { "input": {}, "output": {} }, "schema": {} }
  }
}
```

### 200 success

```json
{
  "mode": "discover",
  "content": {
    "summary": "…",
    "keywords": ["…"],
    "entities": ["…"],
    "tickers":  ["…"]
  },
  "predictions": [
    {
      "question":         "Will Crude Oil hit $200 by June?",
      "slug":             "cl-hit-jun-2026",
      "yesPrice":         0.0145,
      "noPrice":          0.9855,
      "volume":           3841735,
      "quotientOdds":     0.085,
      "spread":           0.07,
      "spreadDirection":  "q_higher",
      "bluf":             "…"
    }
  ],
  "perps":   [{ "asset": "OIL-PERP", "markPrice": 64.20, "recommendation": "…" }],
  "options": [],
  "recommendedTrades": [{ "marketType": "polymarket", "venue": "…", "recommendation": "…" }],
  "searchId": "<uuid>"
}
```

Per-prediction `spreadDirection`: `"q_higher"` = YES is underpriced
(BUY YES); `"q_lower"` = YES is overpriced (BUY NO).

### Status codes

| Status | When |
|---|---|
| 200 | Settlement verified, response delivered. |
| 400 | URL or query missing from body. |
| 402 | No payment / wrong asset / underpaid / wrong payee / signature mismatch. |
| 502 | Facilitator unreachable (verify timeout, 5xx, or operator misconfig). |
| 500 | Downstream pipeline error (Quotient, Jina, etc.). |

### Snapshot URL

The `searchId` from a successful response unlocks a public snapshot:

```
https://app.capacitr.xyz/markets/search/<searchId>
```

Share with a human reviewer.
