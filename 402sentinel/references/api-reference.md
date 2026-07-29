# 402Sentinel API Reference

Base URL `https://402sentinel.com`. Pre-payment counterparty risk + compliance gate. Prices are USDC per call. Most endpoints are POST with a JSON body. Canonical machine spec: `/openapi.json`. Scores are probabilistic estimates from limited public on-chain data + heuristics — informational, NOT advice, NOT an endorsement or accusation.

## Seller risk
| Endpoint | Price | Body | Returns |
|---|---|---|---|
| `POST /api/assess` | $0.002 | `{ target:{ payto_address }, payment_context?:{ amount, asset }, policy?:{ block_at_score, review_at_score, min_confidence } }` | `risk_score` (0-100), `decision` (allow/review/block), `confidence`, `coverage` (incl. `network`), per-dimension signals, `key_factors` (the signals that drove the score), `recommended_policy`, `assessment_id`. `payto_address` = 0x EVM (Base) OR base58 Solana. OFAC covers EVM lists (stated honestly for Solana). |
| `POST /api/assess/deep` | $0.02 | same as `/api/assess` | same shape; scans more on-chain settlement history → higher confidence. |
| `POST /api/policy` | $0.002 | `{ target:{ payto_address }, payment_context? }` | allow/limit/deny + wallet-ready policy: `max_payment_usdc`, `daily_cap_usdc`, `add_to_denylist`, `require_human_approval`. |

## Buyer-side payment firewall
| Endpoint | Price | Body | Returns |
|---|---|---|---|
| `POST /api/firewall` | $0.002 | `{ agent_id, payment:{payto_address,amount,resource_url}, context?:{source,untrusted_text,intended:{payto,max_amount}}, policy? }` | allow/hold/block + signals: `routing_anomaly`, `velocity_anomaly`, `amount_anomaly`, `provenance_flag`, `counterparty_risk`, **`injection_destination`** (pass the page/tool output as `untrusted_text`; if the payTo appears in it → hard block — catches prompt-injection payments), **`intent_mismatch`** (pass `intended`; any deviation → hard block), `new_counterparty_burst`, `recurring_flagged`. Stateful per `agent_id`. |
| `POST /api/firewall/record` | FREE | seed routing history | — |
| `POST /api/firewall/outcome` | FREE | `{assessment_id, outcome, owner_sig, owner_ts}` | trains per-signal precision. |

ANTI-POISON: to build TRUSTED history / train via outcomes, sign `402sentinel:<action>:<agent_id-lowercased>:<unix_ts>` with the agent_id wallet and pass `owner_sig` + `owner_ts` (action = `firewall` | `firewall_record` | `firewall_outcome`). Unsigned writes are accepted but never establish trusted history (so nobody can poison another agent's baseline).

## Compliance + tokenized-RWA
| Endpoint | Price | Body | Returns |
|---|---|---|---|
| `POST /api/compliance` | $0.02 | `{ target:{ payto_address, agent_id? }, payment_context?:{ amount, asset } }` | `compliance_decision` (pass/flag/block) + `diligence_tier` + `obligations` + checks: OFAC sanctions (hit = block), due-diligence tier, structuring/smurfing (needs `agent_id`), FATF Travel-Rule threshold (informational). |
| `POST /api/assess/rwa` | $0.02 | `{ target:{ payto_address:<token contract 0x…>, network:"eip155:8453"\|"eip155:1" } }` | `risk_score` + `decision` + `is_permissioned_security` + signals: proxy-aware transfer-restriction (ERC-1404/ERC-3643/allowlist/freeze/pause), behavioral transfer simulation (reverts = trapped funds), live pause state, token identity, issuer/admin identity + issuer OFAC. `not_checked` stated honestly. |

## Verification (opt-in trust credential)
| Endpoint | Price | Body / Query | Returns |
|---|---|---|---|
| `POST /api/verify` | $0.02 | `{ payto, resource_url?, claimed_buyers? }` | deep ecosystem-graph audit; IF it passes, a signed time-boxed credential + public allow-list entry. Positive-only (failures never published). |
| `GET /api/verified` | FREE | — | public allow-list of currently-verified services + the `issuer` address. |
| `GET /api/verification` | FREE | `payto=0x…` | is this service Verified? Returns the signed credential (recover signer == `issuer` to verify independently). |

## Free
| Endpoint | Query/Body | Returns |
|---|---|---|
| `GET /api/assess/preview` | `payto=0x…` | rate-limited: `{ decision, risk_score }` only — confirm the gate before paying. |
| `POST /api/report_outcome` | `{ assessment_id, outcome, tx_hash? }` | trains the settlement-reliability signal. |

Terms: `https://402sentinel.com/terms`.
