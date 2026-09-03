# Mint on demand (advanced · flag-gated)

`POST https://www.playhunch.xyz/api/partner/mint`

Mints a **token market-cap milestone** market ("Will $TOKEN reach $X before
&lt;deadline&gt;?") on demand for a **curated, pinned** token, and persists it so it
is immediately discoverable / quotable / tradeable through the partner API and
auto-resolved by Hunch's resolution cron.

> **Advanced + dark by default.** Double-gated: returns `404` unless **both**
> `HUNCH_PARTNER_API` **and** `HUNCH_MARKET_FACTORY` are enabled. It mints **only**
> for symbols in Hunch's vetted allow-list (`FACTORY_PINNED_TOKENS`) — never a
> bare cashtag — so a wrong/collided address can't settle off the wrong token.
> Until the factory is enabled, the skill should rely on the existing catalogue
> and discovery; treat mint as an operator capability, not a default action.

### Request body

```json
{ "symbol": "BNKR", "horizonDays": 30, "multiplier": 2 }
```

| Field | Required | Meaning |
|---|---|---|
| `symbol` | yes | Token ticker (no `$`), 1–32 chars. **Must be in the pinned allow-list.** |
| `horizonDays` | no | Days until the deadline (integer 1–365). The deadline snaps to end-of-UTC-day. |
| `multiplier` | no | Target = current cap × this (number >1, ≤100), snapped to a clean `{1,2,5}×10^k` milestone. |

The market id is deterministic — `factory-<sym>-<target>-<YYYY-MM-DD>` — so the
same token+target+day always mints the same id (the dedupe key).

### Responses

| Status | Body | Meaning |
|---|---|---|
| `201` | `{ status: "minted", market }` | New market created; `market` is the shared [market ref](./market-ref.md). Now discoverable/quotable/tradeable. |
| `200` | `{ status: "exists", marketId, market }` | Idempotent — that token+target+day already exists. Use the returned `market`. |
| `422` | `{ error: "token_not_pinned" }` | `symbol` isn't in the vetted allow-list. |
| `422` | `{ error: "mint_rejected", reason }` | Failed the quality gate (no address / non-positive cap / thin liquidity / degenerate target). |
| `429` | `{ error: "rate_limited" }` | Too many mints in the window; retry shortly. |
| `503` | `{ error: "token_unavailable", reason }` | The DexScreener read for the token failed (transient). |
| `503` | `{ error: "persist_failed", reason }` | Storage write failed. |
| `404` | `{ error: "market_factory_disabled" }` | One/both flags are off. |

### Flow once minted

A minted market behaves exactly like a static one: it appears in `discover`
(by cashtag), prices via `quote`, settles via `trade` (x402), and reports via
`positions` / `result`. No special handling — it is a real market-cap milestone
market on the audited rail.
