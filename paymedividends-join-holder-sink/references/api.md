# Pay Me Dividends × Bankr API reference

## List eligible tokens

```http
GET https://api.bankr.bot/public/doppler/beneficiary-fees/:walletAddress
```

Filter: `chain === "robinhood"`, parse `share >= 95`, one pool leg is stock/RWA (e.g. MSFT), not WETH-only.

Pay Me Dividends proxy (pre-filtered):

```http
GET https://paymedividends-production.up.railway.app/v1/bankr/beneficiary-fees/:walletAddress
```

## Token details

```http
GET https://api.bankr.bot/token-launches/:tokenAddress
```

## Retarget fees (external wallet)

```http
POST https://api.bankr.bot/public/doppler/build-transfer-beneficiary
Content-Type: application/json

{
  "tokenAddress": "0x…",
  "currentBeneficiary": "0x…",
  "newBeneficiary": "0x…router"
}
```

Response: `{ "to", "data", "chainId", "description" }` — sign with current beneficiary.

Bankr-managed wallet alternative: `POST /user/doppler/execute-transfer-beneficiary` (sponsored gas).

## Verify onchain

`getShares(poolId, router)` on fee manager `0x4e3468951D49f2EEa976eD0D6e75fFCb44a9a544` — require `>= 0.95e18`.

## Queue Hub enrollment

```http
POST https://paymedividends-production.up.railway.app/v1/enrollment-requests
Content-Type: application/json

{
  "tokenAddress": "0x…",
  "router": "0x…",
  "poolId": "0x…",
  "feeBeneficiary": "0x…",
  "tokenSymbol": "DEVS",
  "pairedStockSymbol": "MSFT",
  "requestedBy": "0x…"
}
```

Governance polls: `GET /v1/enrollment-requests`

## New token launch (not this skill)

Site only: [app.paymedividends.xyz](https://app.paymedividends.xyz) — router + `POST /token-launches/deploy` with `feeRecipient: { type: "wallet", value: router }` and `quoteOnlyFees: true`.

Full ops runbook: [docs/ops-rollout.md](https://github.com/anondevv69/paymedividends/blob/main/docs/ops-rollout.md)
