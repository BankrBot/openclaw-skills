# Holder drips API

Base: `https://gleaming-freedom-production-c89d.up.railway.app`

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` or `/` | Health + platform summary |
| GET | `/v1/platform` | Fee bps, treasury, cron, `factory`, `canAutoDeploy` |
| GET | `/v1/drips` | List registered drips |
| GET | `/v1/drips/:id` | One drip |
| POST | `/v1/drips` | Create/register drip — omit router/distributor for factory deploy |
| POST | `/v1/drips/:id/test` | Signal test drip (fund distributor first) |
| POST | `/v1/drips/:id/automate` | `{ "currentBeneficiary": "0x…" }` → Bankr retarget tx |

## Platform check

```bash
curl -s https://gleaming-freedom-production-c89d.up.railway.app/v1/platform
```

Live factory: `0x5B5ade0E3b38842f1758DE629F0Cd35AF647fC28` — expect `canAutoDeploy: true`.

## Create (factory auto-deploy — preferred)

Omit `router` / `distributor`. API calls `createDrip(meme, paired)` onchain.

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

Response: `drip.router`, `drip.distributor`, optional `deployed.txHash`.

## Register existing contracts

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

## Test vs automate

- **Test:** paired RWA → `distributor` → keeper pays holders. Fees can stay on user wallet.
- **Automate:** user signs retarget → fees → `router` → keeper every 30m.
