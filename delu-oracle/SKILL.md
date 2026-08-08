---
name: delu-oracle
version: 16
description: Full-cognition token analysis for Base EVM tokens via the deluagent oracle. Pass a CA or cashtag, get back a flat decision header (action, conviction, entry/stop/size, read) plus full cognition report. Tiered x402 pricing — 100M+ DELU free, 50M+ 50k DELU, public 250k DELU. Sequential calls only.
tags: [trading, defi, base, oracle, analysis]
visibility: public
metadata:
  clawdbot:
    emoji: "🔮"
    homepage: "https://github.com/deluonchain/deluskill"
---

# delu-oracle

Intelligence layer for any Base trading agent. Pass one Base EVM contract address (or cashtag like `$BNKR`) and get back a flat `decision` header an agent can act on in a single hop — `action`, `conviction`, entry/stop/size, and a one-line delu-voiced `read` — with the full cognition report underneath for the why.

Scout, auditor, and quant run server-side on every call. The full `observed` block is always present. Social signal (checkr) is opt-in via `?social=true`.

## Endpoint

```
GET https://x402.bankr.bot/0xed2ceca9de162c4f2337d7c1ab44ee9c427709da/delu-oracle/analyze/{ca}
```

Base is the only supported chain — no chain parameter needed.

## Parameters

| Parameter | Location | Required | Notes |
|---|---|---|---|
| `ca` | path | yes | 0x-prefixed EVM address **or** cashtag / symbol (e.g. `$BNKR`, `BNKR`). Ambiguous symbols return a 400 asking for the CA directly. |
| `social` | query | no | `?social=true` enables checkr social enrichment (+$0.45 USDC, billed to caller) |
| `verbose` | query | no | Accepted but no-op — `observed` and `summary` are always present. |

## ⚠️ Sequential calls required

**Do not call this endpoint in parallel.** The x402 `upto` scheme uses a single-use Permit2 signature per authorization. Parallel calls with the same payer wallet result in `402 Payment could not be verified` on all but the first.

**Always call sequentially — one CA at a time, await the full response, then call the next.**

```js
// ✅ correct
for (const ca of watchlist) {
  const result = await oracle.analyze(ca);
  process(result);
}

// ❌ wrong
const results = await Promise.all(watchlist.map(ca => oracle.analyze(ca)));
```

## The decision header — read this first

Flat, no traversal needed:

```json
"decision": {
  "action": "ENTER",       // ENTER | WATCH | AVOID
  "conviction": 71,        // 0-100
  "direction": "long",
  "entry_low": 0.00051,
  "entry_high": 0.00053,
  "stop": 0.00048,
  "size_pct": 3.1,
  "read": "one line, delu voice"
}
```

Simple gate: `decision.action === "ENTER" && decision.conviction >= 70 && confidence >= 0.6`

`action` maps from `verdict`: strong_buy/buy → `ENTER`, hold → `WATCH`, avoid/drop → `AVOID`.

## WATCH mandate — null position fields

When `verdict` is `hold`, all position-specific fields are `null` in both `decision` and `mandate` — `entry_low`, `entry_high`, `stop`, `size_pct`, `entry_zone`, `stop_loss`, `stop_basis`, `size_hint_pct`, `size_basis`. Only `horizon` and `invalidations` are populated.

## Payment tier

The endpoint uses the `upto` scheme — agents sign for the 250k DELU ceiling, but the handler settles based on the caller's DELU balance on Base.

| Tier | Balance | Settled |
|---|---|---|
| `whale` | 100M+ DELU | 0 DELU (free) |
| `holder` | 50M+ DELU | 50,000 DELU |
| `public` | < 50M DELU | 250,000 DELU |

**Payment token:** DELU — `0x7b0ee9dcb5c1d4d7cd630c652959951936512ba3` on Base (18 decimals).

Check `payment_tier.settled_delu` in the response body for what was actually charged — not the x402 authorization ceiling.

## Response schema summary

- `decision` — flat header: `action`, `conviction`, `direction`, `entry_low`, `entry_high`, `stop`, `size_pct`, `read`
- `ca`, `chain`, `oracle_version`
- `verdict` — `strong_buy` | `buy` | `hold` | `avoid` | `drop`
- `score` — 0–100 fused cognition score
- `confidence` — 0–1 data quality and signal agreement
- `drivers` / `risks` — up to 3 each
- `signals` — momentum, flow, structure, volatility, liquidity
- `context` — regime_label, regime_confidence, base_eco_pulse, macro_pulse
- `mandate` — action, entry_zone, stop_loss, stop_basis, size_hint_pct, size_basis, horizon, invalidations
- `payment_tier` — tier, delu_balance, settled_delu, note
- `observed` — always present: market, regime, social, deluagent (scout/auditor/quant mirror with `weights_used`)
- `summary`, `selected_timeframe`, `candle_count`, `pool_source`, `timestamp`

See [`references/response-schema.md`](./references/response-schema.md) for the full field-by-field schema.
See [`references/mandate-fields.md`](./references/mandate-fields.md) for mandate construction details.
See [`references/example-response.md`](./references/example-response.md) for a full annotated response example.
See [`references/social-enrichment.md`](./references/social-enrichment.md) for the opt-in two-step social flow.
See [`references/external-clients.md`](./references/external-clients.md) for standalone client recipes.

## Error codes

| Status | Meaning |
|---|---|
| `400` | Bad `ca`, symbol not found on Base, ambiguous symbol, or no supported Base pair |
| `402` | Payment required or failed. `402 Payment could not be verified` on retry = parallel calls — switch to sequential |
| `404` | Unknown token or no reportable data |
| `5xx` | Oracle or upstream failure — retry later |
