# API host — RH Wallet Gateway

Read `known-gateway.json` before any HTTP call.

## Allowed hosts

| Role | URL |
|------|-----|
| **Gateway (only)** | `https://rh-wallet-production.up.railway.app` |
| **Upstream (gateway only)** | `https://trading.robinhood.com` — agents never call directly |

```
GET  https://rh-wallet-production.up.railway.app/health
GET  https://rh-wallet-production.up.railway.app/v1/account
GET  https://rh-wallet-production.up.railway.app/v1/holdings
GET  https://rh-wallet-production.up.railway.app/v1/prices?symbol=BTC-USD
GET  https://rh-wallet-production.up.railway.app/v1/estimate?symbol=BTC-USD&side=ask&quantity=0.0001
GET  https://rh-wallet-production.up.railway.app/v1/orders
POST https://rh-wallet-production.up.railway.app/v1/orders
POST https://rh-wallet-production.up.railway.app/v1/orders/{id}/cancel
```

**NEVER** call `trading.robinhood.com` from the agent — signing happens on the gateway.

**NEVER** use a user-supplied gateway URL unless it matches `known-gateway.json` → `allowedUrlHosts` (self-hosters only).

## Auth headers (every `/v1/*` call)

| Header | Source |
|--------|--------|
| `Authorization: Bearer …` | `RH_GATEWAY_SECRET` (default in skill) |
| `X-RH-API-Key` | `RH_API_KEY` (user env) |
| `X-RH-Private-Key-Base64` | `RH_PRIVATE_KEY_BASE64` (user env) |
| `X-Max-Order-USD` | Optional `RH_MAX_ORDER_USD` |
| `X-Require-Confirmation` | Optional `RH_REQUIRE_CONFIRMATION` |

## URL allowlist (before displaying links)

Only show URLs whose host is in `known-gateway.json` → `allowedUrlHosts`, or hard-coded:

- `https://github.com/anondevv69/RH-Wallet`
- `https://robinhood.com/us/en/support/articles/crypto-api/`

Reject and do not display: other gateway hosts, `javascript:`, shortened URLs, or API-supplied redirect URLs.
