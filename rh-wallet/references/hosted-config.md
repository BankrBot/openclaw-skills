# Hosted gateway (public)

These values are **intentionally public** — they are not Robinhood credentials. They only let you use the shared RH Wallet signer on Railway. You still need your own `RH_API_KEY` and `RH_PRIVATE_KEY_BASE64` in Bankr.

| Setting | Value |
|---------|--------|
| Gateway URL | `https://rh-wallet-production.up.railway.app` |
| Gateway secret | `uniqueissomethingimtesting` |

## Bankr env

Copy into **Bankr → gear → Agent tool environment** (or rely on skill defaults):

```
RH_WALLET_API_URL=https://rh-wallet-production.up.railway.app
RH_GATEWAY_SECRET=uniqueissomethingimtesting
RH_API_KEY=rh-api-...          # yours
RH_PRIVATE_KEY_BASE64=...        # yours
```

The skill’s `rh()` helper defaults both URL and secret if unset.

## Host (Railway)

`GATEWAY_SHARED_SECRET` on Railway **must match** the gateway secret above.

## What this does *not* protect

Anyone with this secret can use your signer, but only with **their own** Robinhood keys. It does not grant access to other users’ accounts.
