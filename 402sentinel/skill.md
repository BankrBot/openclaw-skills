---
name: 402sentinel-api
description: Pre-payment counterparty risk + compliance gate for agents over x402. Use BEFORE paying an x402 counterparty to score the seller (0-100 risk + allow/review/block), run a buyer-side payment firewall (routing/amount/velocity + prompt-injection + intent-mismatch checks), screen OFAC/FATF compliance, and gate tokenized-RWA tokens (transfer-restriction / pause / issuer screening). Independent and audited.
---

# 402Sentinel API Skill

Use this skill when an agent is about to **pay an x402 counterparty** and should check it first — or needs OFAC/FATF compliance screening or a tokenized-RWA token safety check. 402Sentinel scores the seller, vets the specific payment against the agent's own behaviour, and screens compliance — all pre-pay.

Every paid endpoint is **x402 pay-per-call** — no signup, no API key. The skill's job is to pick the right endpoint and execute the x402 flow correctly.

## Base URL

- `SENTINEL_BASE_URL`: `https://402sentinel.com`
- Single origin for runtime requests AND discovery docs (`/.well-known/x402`, `/openapi.json`, `/llms.txt`).

## Access Model

- **x402 only** — no API-key path. Unpaid requests return HTTP `402`.
- The 402 challenge offers **two rails — Base (`eip155:8453`) and Solana (`solana:…`)**; pay on either, asset is USDC, scheme is standard x402 `exact`, settled via the Coinbase/CDP facilitator.
- Prefer **Bankr wallet signing** (`/agent/sign`) when available (`X-API-Key`, Agent API + signing, not read-only); otherwise any vanilla x402 client with a USDC-funded wallet.
- Most endpoints are **POST** with a JSON body. Use your payer wallet address as `agent_id` so the buyer-side firewall keeps per-agent state.

## x402 API Call Checklist

1. Send the request (usually POST with a JSON body) without payment headers.
2. If the response is `402`, parse the base64 `PAYMENT-REQUIRED` header (scheme, both networks, USDC asset, amount, payTo).
3. Sign the payment and retry with the `PAYMENT-SIGNATURE` header.
4. On success, read the verdict and the `PAYMENT-RESPONSE` settle receipt.
5. A `4xx` from the handler means you were NOT charged (settlement only on status < 400); apply retry/backoff on `402` re-challenge and transient `5xx`.

## Required Preflight (Deterministic)

Before the first call in a session, fetch the discovery docs (free, no payment): `GET /.well-known/x402`, `GET /openapi.json` (canonical routes + body schema — authoritative), `GET /llms.txt`. Treat the runtime `402` challenge as authoritative for price/network/payTo.

## Core Endpoints (price = USDC per call)

Seller risk:
- `POST /api/assess` — $0.002 — assess a counterparty before paying. Body `{ target:{ payto_address }, payment_context?:{ amount, asset }, policy?:{ block_at_score, review_at_score, min_confidence } }`. `payto_address` may be a 0x EVM (Base) OR a base58 Solana seller. Returns `risk_score` (0-100), `decision` (allow/review/block), `confidence`, `coverage`, per-dimension signals, `key_factors` (the signals that drove the score), `recommended_policy`, and an `assessment_id`. (OFAC screening here covers EVM lists; stated honestly in the output for Solana.)
- `POST /api/assess/deep` — $0.02 — same shape, scans more on-chain settlement history for higher confidence.
- `POST /api/policy` — $0.002 — risk → enforceable wallet policy: `max_payment_usdc`, `daily_cap_usdc`, `add_to_denylist`, `require_human_approval`. Apply directly to the agent wallet's spending limits.

Buyer-side payment firewall (vets THIS payment in the context of YOUR agent's behaviour):
- `POST /api/firewall` — $0.002 — Body `{ agent_id, payment:{payto_address,amount,resource_url}, context?:{source,untrusted_text,intended:{payto,max_amount}}, policy? }` → allow/hold/block + signals: `routing_anomaly` (payTo swapped vs history), `velocity_anomaly` (drain), `amount_anomaly` (overcharge), `provenance_flag` (untrusted source), `counterparty_risk` (folds assess), `injection_destination` (pass the page/tool output as `untrusted_text`; if the payTo appears in it → hard block — catches prompt-injection payments), `intent_mismatch` (pass `intended:{payto,max_amount}`; any deviation → hard block), `new_counterparty_burst`, `recurring_flagged`. Stateful per `agent_id`. Seed history free at `POST /api/firewall/record`; report what happened free at `POST /api/firewall/outcome` to train per-signal precision. ANTI-POISON: to build TRUSTED history, sign `402sentinel:<action>:<agent_id-lowercased>:<unix_ts>` with the agent_id wallet and pass `owner_sig`+`owner_ts`.

Compliance + tokenized-RWA:
- `POST /api/compliance` — $0.02 — pre-pay compliance screen. Body `{ target:{ payto_address, agent_id? }, payment_context?:{ amount, asset } }` → `compliance_decision` (pass/flag/block) + `diligence_tier` + `obligations` + checks: OFAC sanctions (hit = hard block), due-diligence tier, structuring/smurfing detection (needs `agent_id`), FATF Travel-Rule threshold (informational). Screening support — not legal advice.
- `POST /api/assess/rwa` — $0.02 — "is this TOKEN what it claims?" Body `{ target:{ payto_address:<token contract 0x…>, network:"eip155:8453"|"eip155:1" } }` → `risk_score` + `decision` + `is_permissioned_security` + signals: proxy-aware transfer-restriction detection (ERC-1404/ERC-3643/allowlist/freeze/pause), behavioral transfer simulation (reverts = trapped funds), live pause state, token identity, issuer/admin identity + issuer OFAC. `not_checked` stated honestly (backing/PoR, peg/NAV, holder concentration). Diligence support — not investment advice.

Verification (opt-in trust credential):
- `POST /api/verify` — $0.02 — a service submits its own payTo; a deep ecosystem-graph audit, and IF it passes, a signed time-boxed credential + public allow-list entry. Positive-only (failing audits never published). Body `{ payto, resource_url?, claimed_buyers? }`.

Free (no payment):
- `GET /api/assess/preview?payto=0x…` — FREE (rate-limited) — just `{ decision, risk_score }` for one address, to confirm the gate before paying.
- `GET /api/verified` — FREE — the public allow-list of currently-verified services + the `issuer` address.
- `GET /api/verification?payto=0x…` — FREE — is this service 402Sentinel-Verified? Returns the signed credential (recover the signer == `issuer` to verify independently).
- `POST /api/report_outcome` — FREE — after paying, report delivery (`delivered|partial|not_delivered|overcharged`, `tx_hash?`) to train the settlement-reliability signal.

## Notes

- Scores are probabilistic estimates from limited public on-chain data + heuristics — informational, NOT advice, NOT an endorsement or accusation. Do your own due diligence. Terms: `https://402sentinel.com/terms`.

## References
- API reference (all endpoints, params, response fields): `/skill/references/api-reference.md`
- x402 payment flow (Bankr signing + verified vanilla recipe): `/skill/references/x402-flow.md`
- Error handling (402 / 429 / 4xx / 5xx, retry rules): `/skill/references/error-handling.md`
