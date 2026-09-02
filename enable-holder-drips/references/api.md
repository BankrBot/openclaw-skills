# Holder drips API

Base: `https://gleaming-freedom-production-c89d.up.railway.app`

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` or `/` | Health + platform summary |
| GET | `/v1/platform` | Fee bps, treasury, cron, factory |
| GET | `/v1/drips` | List registered drips |
| GET | `/v1/drips/:id` | One drip |
| POST | `/v1/drips` | Register drip (`memeToken`, `pairedToken`, `router`, `distributor`, symbols) |
| POST | `/v1/drips/:id/test` | Signal test drip (fund distributor first) |
| POST | `/v1/drips/:id/automate` | `{ "currentBeneficiary": "0x…" }` → Bankr retarget tx |

## Test vs automate

- **Test:** paired RWA → `distributor` → keeper pays holders. Fees can stay on user wallet.
- **Automate:** user signs retarget → fees → `router` → keeper every 30m.

## Example create (factory auto-deploy)

```bash
curl -X POST https://gleaming-freedom-production-c89d.up.railway.app/v1/drips \
  -H 'content-type: application/json' \
  -d '{
    "memeToken": "0x…",
    "pairedToken": "0x…",
    "symbol": "TOKEN",
    "pairedSymbol": "MSFT"
  }'
```

Omit `router` / `distributor` when `DRIP_FACTORY` is set — API deploys both and returns them.

## Example register (existing contracts)

```bash
curl -X POST https://gleaming-freedom-production-c89d.up.railway.app/v1/drips \
  -H 'content-type: application/json' \
  -d '{
    "memeToken": "0x…",
    "pairedToken": "0x…",
    "router": "0x…",
    "distributor": "0x…",
    "symbol": "TOKEN",
    "pairedSymbol": "MSFT"
  }'
```
