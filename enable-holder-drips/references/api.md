# Holder drips API

Base: `https://gleaming-freedom-production-c89d.up.railway.app`

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` or `/` | Health + platform summary |
| GET | `/v1/platform` | Fee bps, treasury, factory, **sources** |
| GET | `/v1/drips` | List registered drips |
| GET | `/v1/drips/:id` | One drip |
| POST | `/v1/drips` | Create — omit router/distributor for factory; pass `source` |
| POST | `/v1/drips/:id/test` | Signal test drip (fund distributor first) |
| POST | `/v1/drips/:id/automate` | Source-specific fee routing instructions / Bankr retarget |

## Sources

| `source` | Launchpad |
|---|---|
| `bankr` | Bankr Doppler (default) |
| `pools_fun` | pools.fun (Sushi × Bankr) |
| `pools_trade` | pools.trade (Uniswap Labs) |

## Create examples

```bash
# Bankr
curl -X POST https://gleaming-freedom-production-c89d.up.railway.app/v1/drips \
  -H 'content-type: application/json' \
  -d '{"memeToken":"0x…","pairedToken":"0x…","symbol":"T","pairedSymbol":"MSFT","source":"bankr"}'

# pools.fun
curl -X POST https://gleaming-freedom-production-c89d.up.railway.app/v1/drips \
  -H 'content-type: application/json' \
  -d '{"memeToken":"0x…","pairedToken":"0x…","symbol":"T","pairedSymbol":"NVDA","source":"pools_fun"}'

# pools.trade
curl -X POST https://gleaming-freedom-production-c89d.up.railway.app/v1/drips \
  -H 'content-type: application/json' \
  -d '{"memeToken":"0x…","pairedToken":"0x…","symbol":"T","pairedSymbol":"AAPL","source":"pools_trade"}'
```

## Automate

- **bankr:** `{ "currentBeneficiary": "0x…" }` → Bankr `build-transfer-beneficiary` tx to sign
- **pools_fun / pools_trade:** returns step instructions; marks `automated: true` so keeper will `route()` when balances sit on the router

## Test vs automate

- **Test:** paired RWA → `distributor` → keeper pays holders
- **Automate:** fees → `router` → keeper `route()` (10% treasury) → distributor → holders
