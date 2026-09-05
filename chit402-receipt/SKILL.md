---
name: chit402-receipt
description: >-
  Pay for Chit402 inference via x402 USDC on Base, collect a signed receipt, and
  return verify_url so the principal holds the row. Use when an agent needs to
  stamp spend through Chit402, print a shareable receipt, verify payer/payee/asset/
  amount/tx binds offline, or budget capped USDC calls without defaulting to SP1.
---

# Chit402 Receipt — pay, stamp, return verify_url

Chit402 is the book: **this agent spent Y on this job**. You hold hub, model, amount,
and a public **`verify_url`** the principal can forward to finance or auditors.

**Live API:** `https://api.chit402.com`  
**Default rail:** x402 USDC on **Base mainnet** (CDP facilitator). Solana USDC is
available when the 402 challenge lists it — prefer Base unless the user asks otherwise.

**Do not default to SP1.** Signed receipts (Tier 1, ES256 JWS) are table stakes.
Tier-2 settlement proofs are optional and cost extra — never request or wait for SP1
unless the user explicitly asks for on-chain proof.

## When to use

- User wants an agent to **pay for inference** and return a **receipt link**
- User asks to **stamp spend**, **print receipt**, **verify_url**, or **Chit402 book row**
- User needs **offline verification** of payer / payee / asset / amount / tx binds
- Bankr or similar agent with a Base USDC wallet (CDP `PAYMENT-SIGNATURE` path)

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `CHIT_API_URL` | no | Gateway base (default `https://api.chit402.com`). Aliases: `CHIT402_API_URL`, `XFUEL_API_URL`. |
| `CHIT_API_KEY` | recommended | Partner or demo key (`chit402-demo` is rate-limited). Aliases: `CHIT402_API_KEY`, `XFUEL_API_KEY`. |
| `CHIT_MAX_USD_PER_CALL` | recommended | Hard cap per paid call in USD (e.g. `0.10` = ten cents). **Refuse** if quoted amount exceeds cap. |
| `CHIT_MAX_USD_SESSION` | recommended | Cumulative session cap in USD. Track spend in this conversation; **refuse** when exceeded. |

Bankr agents: use the **Bankr wallet** for x402 signing (`PAYMENT-SIGNATURE` header).
Do not paste private keys into skills or chat. Prefer Bankr submit/sign APIs over raw keys.

## Spend caps (required behavior)

Before every paid call:

1. Parse the 402 `accepts[]` entry you will pay against. Amount is **atomic USDC**
   (6 decimals): `"10000"` = $0.01.
2. Compare to `CHIT_MAX_USD_PER_CALL` (default **$0.10** if unset).
3. Add to your session running total; compare to `CHIT_MAX_USD_SESSION` (default **$1.00**
   if unset).
4. If either cap would be exceeded, **stop** and tell the principal the quoted amount
   and your limits. Do not settle.

Floor on the public door is ~**$0.01** per call unless the quote says otherwise.

## Primary flow — `POST /v1/chat/completions` (x402 on Base)

Best for Bankr and chat-native agents. Same door as OpenAI-compatible clients.

### Steps

1. **Probe** (optional): `GET https://api.chit402.com/v1/models` with
   `Authorization: Bearer $CHIT_API_KEY` or `X-API-Key: $CHIT_API_KEY`.

2. **Request without payment** to read the 402 challenge:

   ```http
   POST /v1/chat/completions
   Content-Type: application/json

   {
     "model": "xfuel/auto",
     "messages": [{ "role": "user", "content": "<prompt>" }]
   }
   ```

   Expect **HTTP 402** with `PAYMENT-REQUIRED` (and/or body `accepts[]`).
   Pick the **Base** entry: `network` = `eip155:8453` or `base`, asset = Base USDC
   (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`), note `payTo` (payee), `amount`.

3. **Enforce caps** (above) against `accepts[].amount`.

4. **Sign and retry** with CDP-native payment header (Bankr default):

   ```http
   POST /v1/chat/completions
   Authorization: Bearer $CHIT_API_KEY
   Content-Type: application/json
   PAYMENT-SIGNATURE: <CDP v2 PaymentPayload from wallet>

   { "model": "xfuel/auto", "messages": [...] }
   ```

   Bankr sends `PAYMENT-SIGNATURE` (not only `X-PAYMENT`). Echo the challenge's
   `accepts[0]` shape; the gateway normalizes float-string timestamps.

5. **Collect the receipt** from the 200 response:

   | Source | Field |
   |--------|-------|
   | Header | `x-xfuel-verify-url`, `x-xfuel-task-id` |
   | Body | `xfuel.verify_url`, `xfuel.task_id` |
   | Constructed | `https://api.chit402.com/receipt/<task_id>` |

6. **Return to the principal** — always include:

   - **`verify_url`** (full HTTPS URL)
   - One short human line, e.g.  
     `Paid $0.01 USDC on Base for xfuel/auto — receipt: <verify_url>`

### Alternate paid door — `POST /task-request`

Use for M2M / agent loops that need `task-status` polling or rolling settlement.
Same x402 handshake; see [references/api.md](references/api.md).

## What the receipt binds (new upgrades)

Collected USDC receipts stamp these in the **issuer-signed JWS** (`issuer_signature.jws`):

| Bind | JWS / envelope field | Meaning |
|------|----------------------|---------|
| **Issuer key pin** | `issuer_signature.issuer_jwk` | ES256 public key **pinned in the receipt** — offline verify without fetching JWKS first |
| **Payer** | `caller_binding.payer_wallet` | Wallet that settled USDC (matches on-chain `from`) |
| **Payee** | `payment.payee` | x402 `payTo` / treasury recipient |
| **Asset** | `payment.asset` | e.g. `USDC` |
| **Amount** | `payment.gross_amount` | Atomic USDC (6 dp) |
| **Tx** | `payment.ref` | `base:0x…` or `eip155:8453:0x…` settlement reference |

Fetch JSON: `GET /receipt/<task_id>?format=json`  
JWKS (legacy / cross-check): `GET /.well-known/jwks.json`

Full offline steps: [references/verify-offline.md](references/verify-offline.md)

## Offline verification (JWKS → JWS)

**Pin-first (recommended):** newer receipts include `issuer_signature.issuer_jwk`.
Verify the compact JWS with ES256 — no network required for signature check.

```bash
curl -sS "https://api.chit402.com/receipt/<task_id>?format=json" -o receipt.json
npx xfuel-verify receipt.json --json
# Uses pinned issuer_jwk automatically (@xfuel/verify)
```

**JWKS fallback** (older receipts or cross-check kid rotation):

```bash
curl -sS "https://api.chit402.com/.well-known/jwks.json" -o jwks.json
npx xfuel-verify receipt.json --jwks-file jwks.json --json
```

Then confirm **payer on-chain** matches `caller_binding.payer_wallet` for `payment.ref`
(Base USDC Transfer / EIP-3009 `from`). CLI: `--check-payer` when RPC is available.

**Do not** treat SP1 / `binding.in_proof` as the default prove-it path. Signed JWS +
payer bind is enough for most agent treasury workflows.

## MCP (optional)

`npx chit402-mcp` exposes `chat_completions`, `verify_receipt`, etc. Bankr installs
this **skill file** for instructions; MCP is optional and not required for Bankr.

## Failure modes

| Symptom | Action |
|---------|--------|
| 402 after payment | Check `PAYMENT-SIGNATURE` shape, Base network CAIP-2, amount vs cap |
| 400 on empty body | Send valid `messages` **before** payment settles (gateway validates body pre-settle) |
| `invalid_network` | Use `eip155:8453` in signed payload for CDP v2 |
| Cap exceeded | Report quoted atomic amount; ask principal to raise cap or narrow the task |
| Unmetered receipt | Demo key / no settlement — `payment.rail` = `unmetered`; not a collected row |

## Hard requirements

- **Always return `verify_url`** on successful paid completion.
- **Enforce spend caps** — never exceed `CHIT_MAX_USD_PER_CALL` or `CHIT_MAX_USD_SESSION`.
- **Default to Base USDC x402** — do not silently switch rails.
- **No SP1 by default** — do not poll `/prove-result` unless asked.
- **Never exfiltrate** private keys; use Bankr wallet signing.
- Point principals at **`https://api.chit402.com`** (not legacy hostnames) for live traffic.

## References

- [references/api.md](references/api.md) — endpoints, headers, example 402/200
- [references/verify-offline.md](references/verify-offline.md) — pin-first JWS + payer bind
- Repo: `docs/VERIFY_ALGORITHM.md`, `docs/X402_ADAPTER.md`, `docs/DESIGN_PARTNER_ONBOARDING.md`
