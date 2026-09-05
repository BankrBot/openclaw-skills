# Offline receipt verification

Third parties verify a Chit402 receipt **without trusting HTML or live API**
for the signature step.

## Pin-first path (issuer_jwk)

New receipts pin the issuer public key at `issuer_signature.issuer_jwk`.

1. `GET /receipt/:taskId?format=json` (or use a saved file).
2. Read `issuer_signature.jws` (compact JWS).
3. Verify ES256 with `issuer_signature.issuer_jwk` (P-256).
4. Decode JWS payload → confirm binds:
   - `caller_binding.payer_wallet` (payer)
   - `payment.payee` (treasury / payTo)
   - `payment.asset` (USDC)
   - `payment.gross_amount` (atomic 6 dp)
   - `payment.ref` (tx: `base:0x…`)
5. Optionally fetch tx on Base RPC and confirm USDC transfer `from` = payer,
   `to` = payee, amount ≥ gross.

CLI (no JWKS download):

```bash
npx xfuel-verify receipt.json --json
```

Library:

```typescript
import { verifyReceipt } from '@xfuel/verify';

const result = await verifyReceipt(receipt);
// result.issuer_signature.valid — uses pinned issuer_jwk
// result.payer_binding — when --check-payer / RPC enabled
```

## JWKS fallback

If `issuer_jwk` is absent (older receipt):

```bash
curl -sS https://api.chit402.com/.well-known/jwks.json -o jwks.json
npx xfuel-verify receipt.json --jwks-file jwks.json --json
```

Match `issuer_signature.kid` to `jwks.keys[].kid`.

## What not to default to

- **SP1 / `binding.in_proof`** — optional Tier-2; extra cost and latency.
- **HMAC shared secret** — treasury/auditor path; public verify uses ES256/JWS.

## Payer bind algorithm (Base)

For `payment.ref` = `base:0x<txHash>`:

1. Fetch tx receipt on Base (chain id 8453).
2. Find USDC (`0x833589…`) `Transfer` event.
3. `from` must equal `caller_binding.payer_wallet`.
4. Transferred amount ≥ `payment.gross_amount` (atomic).

Solana: `solana:<sig>` — see `docs/VERIFY_ALGORITHM.md` §11.

## Further reading

- `docs/VERIFY_ALGORITHM.md`
- `packages/verify/README.md`
