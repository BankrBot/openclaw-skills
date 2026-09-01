# Precheck checks & scoring

Each check returns `pass` / `warn` / `fail`. Some failures are **critical** and
force a `block` regardless of score. Otherwise the weighted score decides:

- `block` if any critical failure **or** score ≥ 60
- `warn` if score ≥ 20
- `allow` otherwise

Score is capped at 100. A payee on the operator's trusted list subtracts 25
(non-critical paths only).

| Check | Critical? | Fires when | Weight |
| --- | --- | --- | --- |
| `envelope_integrity` | yes | payTo, amount, or network missing from the challenge | block |
| `address_validity` | yes | payTo is not a valid EVM (or plausible Solana) address | block |
| `denylist_screen` | yes | payee on denylist | block |
| `reported_flag` | yes | payee has community abuse reports | block |
| `price_outlier` | no | amount > category `max` (fail) or > `p90` (warn) | 60 / 20 |
| `absolute_ceiling` | no | amount exceeds the absolute per-call ceiling (default $25) | 35 |
| `asset_check` | no | settlement asset is not a recognized stablecoin for the network | 20 |
| `network_check` | no | settlement network is unrecognized | 15 |
| `facilitator_check` | no | facilitator host not in the known set (informational) | 5 |
| `policy_blocklist` | yes | payee on caller's blocklist | block |
| `policy_allowlist` | yes | caller set an allowlist and payee isn't on it | block |
| `policy_max_per_call` | yes | amount exceeds caller's per-call USD limit | block |
| `policy_network` | yes | network not in caller's allowed networks | block |
| `policy_asset` | yes | asset not in caller's allowed assets | block |
| `policy maxRiskScore` | yes | final score exceeds caller's max | block |

## Price bands (seed, USD per call)

| Category | p50 | p90 | max |
| --- | --- | --- | --- |
| llm-compact | 0.0002 | 0.01 | 0.10 |
| llm | 0.002 | 0.05 | 0.20 |
| market-data | 0.001 | 0.02 | 0.10 |
| crypto-data | 0.001 | 0.02 | 0.10 |
| rpc | 0.0005 | 0.01 | 0.05 |
| scrape | 0.005 | 0.03 | 0.15 |
| web-search | 0.005 | 0.03 | 0.15 |
| social-data | 0.005 | 0.03 | 0.15 |
| data-enrichment | 0.01 | 0.05 | 0.25 |
| image-gen | 0.02 | 0.10 | 0.50 |
| video-gen | 0.10 | 0.50 | 3.00 |
| prediction | 0.01 | 0.10 | 1.00 |
| identity | 0.50 | 2.00 | 5.00 |
| generic | 0.005 | 0.05 | 0.50 |

Operators can override bands, denied/reported/trusted lists, and the ceiling
at runtime via the KV store (`precheck:*` keys on Bankr `ctx.appKV`, or the
`RISK_KV` namespace on Cloudflare).
