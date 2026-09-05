# Chit402 API — receipt door

Live host: **https://api.chit402.com**

## Auth

- `Authorization: Bearer <CHIT_API_KEY>`
- or `X-API-Key: <CHIT_API_KEY>`

Demo key `chit402-demo`: unmetered `POST /v1/chat/completions` (signed receipt, no USDC).
Partner keys + wallet: collected USDC row with `payment.ref`.

## Public paid door — chat completions

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/v1/models` | Catalog |
| `POST` | `/v1/chat/completions` | **Primary x402 door.** Unauth POST → 402. Bankr: `PAYMENT-SIGNATURE`. |

### 402 challenge (excerpt)

```json
{
  "x402Version": 2,
  "accepts": [{
    "scheme": "exact",
    "network": "eip155:8453",
    "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "amount": "10000",
    "payTo": "0x…",
    "maxTimeoutSeconds": 300,
    "extra": { "name": "USD Coin", "version": "2" }
  }]
}
```

`amount` is atomic USDC (6 dp). `10000` = $0.01.

### 200 response (receipt fields)

Headers:

- `x-xfuel-task-id`
- `x-xfuel-verify-url`

Body (`xfuel` extension):

```json
{
  "choices": [{ "message": { "role": "assistant", "content": "…" } }],
  "xfuel": {
    "task_id": "openai-abc123",
    "verify_url": "https://api.chit402.com/receipt/openai-abc123",
    "payment": { "rail": "usdc", "ref": "base:0x…", "gross_amount": "10000" }
  }
}
```

## M2M paid door — task request

| Method | Path | Notes |
|--------|------|-------|
| `POST` | `/task-request` | Agent M2M; poll `GET /task-status` |
| `POST` | `/task-quote` | Read-only price preview |
| `GET` | `/task-status?task_id=` | Status + `verify_url` |

Payment object:

```json
{
  "payment": {
    "rail": "usdc",
    "network": "base",
    "maxAmount": "50000"
  }
}
```

Retry headers after 402: `X-PAYMENT` + nonce, or `PAYMENT-SIGNATURE` (CDP v2).

## Receipt endpoints (public, no auth)

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/receipt/:taskId` | HTML receipt page |
| `GET` | `/receipt/:taskId?format=json` | JSON envelope + `issuer_signature` |
| `GET` | `/receipt/by-tx?tx=<hash>` | Lookup by settlement tx |
| `GET` | `/.well-known/jwks.json` | ES256 issuer keys (JWKS fallback) |

## Issuer signature envelope (v3)

```json
{
  "task_id": "openai-abc123",
  "verify_url": "https://api.chit402.com/receipt/openai-abc123",
  "verification": {
    "source_of_truth": "issuer_signature.jws",
    "jwks_uri": "https://api.chit402.com/.well-known/jwks.json",
    "issuer_jwk_pin": "<kid>",
    "offline_key_source": "issuer_signature.issuer_jwk"
  },
  "issuer_signature": {
    "alg": "ES256",
    "kid": "<kid>",
    "jws": "<header>.<payload>.<sig>",
    "issuer_jwk": { "kty": "EC", "crv": "P-256", "x": "…", "y": "…", "kid": "…" }
  }
}
```

Signed JWS payload (decode middle segment) includes:

- `payment.ref`, `payment.gross_amount`, `payment.asset`, `payment.payee`
- `caller_binding.payer_wallet`
- `route.model`, `route.provider`
- `binding.expected_commitment`

## Related

- `docs/CHAT_COMPLETIONS_GATEWAY.md`
- `docs/M2M_API.md`
- `docs/X402_ADAPTER.md`
