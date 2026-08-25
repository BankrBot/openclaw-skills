# Walcert public API

Host: `https://walcert.globalscoreagent.com`

## Types

| Type | Preview | Paid | Data |
|------|---------|------|------|
| `origins` | yes | yes | Alchemy inflows |
| `activity` | yes | yes | Alchemy 15d window |
| `multichain` | 403 | yes | GoldRush footprint + intensity |
| `portfolio` | 403 | yes | Zerion |

## Preview

`POST /v1/preview/{type}`

```json
{ "wallet_address": "0x…" }
```

**200** (typical): `preview: true`, `grade`, `grade_label` `{eng,esp}`, `analyzed_at`.
No EIP-712 signature, no `giveFeedback`, no `provider` brand block.

| Status | When |
|--------|------|
| 403 | `multichain` or `portfolio` |
| 429 | >8 calls / 15 min / IP (`Retry-After`) |
| 503 | provider quota / not configured |

## Paid certificate

`POST /v1/certificates/{type}`

Same JSON body. Without payment → **402** (`PAYMENT-REQUIRED`). After settle → **200**
with bilingual certificate, `signature`, `onchain` (Celo). BNB settle also includes
`certificate.receipt` (see `x402-rails.md`).

## Verify

`POST /v1/verify`

```json
{ "tx_hash": "0x…" }
```

Optional `data_hash`, `certificate_id`. Facade over Edge: DB + Celo `NewFeedback` + EIP-712.

## Other

- `GET /` — agent card JSON
- `GET /health` — liveness
- `GET /v1/quota` — provider quota snapshot

Do not call Summit (`/v1/summit/...`) from this skill.
