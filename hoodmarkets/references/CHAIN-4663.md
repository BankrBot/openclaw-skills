# Robinhood Chain (4663) — mandatory support check

hood.markets runs on **Robinhood Chain, chain ID 4663**. This is not Ethereum mainnet, Base, or Arbitrum.

## Before any hood.markets wallet action

1. Confirm Bankr wallet / provider **explicitly supports chain 4663**
2. If support is unknown or missing → **abort** — explain Robinhood Chain is required
3. **Do not** fall back to another chain, bridge, or "try mainnet instead"

## Applies to

| Flow | chainId |
|------|---------|
| Pro buy/sell via `/wallet/submit` | **4663** required on every tx |
| Deploy / claim | Server broadcasts on 4663 — user wallet need not sign, but replies must reference Robinhood Chain |
| Simple (V3) swap links | Uniswap URL must include `chain=robinhood` — informational only, not a Bankr submit |

## Validation

Every item in `prepare-buy` / `prepare-sell` `transactions[]` must have `chainId: 4663`.

If Bankr returns an error that chain 4663 is unsupported → **stop**. Do not suggest alternate execution venues. See `references/BANKR-SUBMIT.md`.

## Health check

```http
GET https://api.hood.markets/health
```

Expect `{ "ok": true, "chainId": 4663 }`.
