<!-- GENERATED from public/skill/references/error-handling.md — edit there, then npm run skill:build -->

# Error Handling (API Key and x402)

This file documents both access paths used by the skill. When `QUOTIENT_API_KEY` is set,
the clients use prepaid credits; otherwise they use x402.

## Status Codes

- `200` - Success.
- `401 invalid_api_key` - API key invalid, revoked, or expired; replace it securely.
- `401 gateway_required` - Gateway auth requirement not satisfied.
- `402 payment_required` - Payment challenge issued; read `PAYMENT-REQUIRED`, sign, retry with `PAYMENT-SIGNATURE`.
- `403 insufficient_credits` - The key balance cannot cover the route; top it up or switch to x402.
- `409 payment_replay_mismatch` - A settled x402 payment identifier was reused with a different payment proof, method, URL/query, or body. Create a new challenge/payment; do not mutate an idempotent retry.
- `404 forecast_not_available` - The market is known but has no committed forecast. Use the
  returned authenticated generation request. The API-key debit is refunded and x402 is not settled.
- `404 invalid_market` - Market identity not found; no charge is retained.
- `422` - Invalid request parameters.
- `422 forecast_topic_excluded` - The subject is a sports market, mention market, or short-horizon crypto
  up/down market (15-minute or hourly settle). Quotient does not forecast these; do not retry or reword
  the request. Daily-close and longer crypto horizons are in scope and are not rejected with this error.
- `422 venue_event_requires_market` - A Kalshi parent event was supplied where one exact
  binary child ticker is required. Resolve the event's strike ladder and ask the user to select one.
- `422 venue_market_not_found` - The exact venue market does not exist. Correct the stable
  identifier; do not retry the same value.
- `429 rate_limited` - A per-second, per-minute, daily, or concurrent-request limit was reached. No credits are debited and no x402 payment is settled for this response.
- `502 upstream_unavailable` - A required upstream (Polymarket data-api) is down; see below.
- `5xx` - Upstream or gateway transient failure; retry with bounded backoff.

API-key debits are refunded for upstream error responses. x402 settlement is skipped for the
same errors. Use free `/api/public/forecast-availability` when coverage or identity is
unresolved or generation may be needed; do not make it routine preflight for a known stable
market reference.

## 502 upstream_unavailable and Degraded Modes

- `GET /api/v1/portfolio` is **fail-closed**: if the Polymarket data-api is unavailable it returns `502 upstream_unavailable` rather than a partial position list. Retry with backoff; never treat a 502 as "no positions".
- The optional `perps` annex inside a portfolio response degrades **independently**: on perps-upstream failure the response is still `200` and the `perps` block carries `"error": "upstream_unavailable"`.
- `GET /api/v1/signals/perps` reads source-aware graph heads: a filter with no matching
  series returns `200` with `series: []`. `basis_groups: []` means no resolved source group
  and prohibits fallback. An empty group-level `price_signals` list is normal.
- `GET /api/v1/signals` uses live adapters for Polymarket International and Kalshi. A
  missing quote sets `live_priced: false`, returns a missing `venue_quote`, and fails the
  row closed. The API does not promote graph odds to a fresh quote. Polymarket US and
  Limitless remain unavailable for live signal arithmetic in this release.

## x402-Specific Failure Cases

- Missing `PAYMENT-REQUIRED` on `402`: treat as gateway/proxy error and stop.
- Missing `PAYMENT-RESPONSE` after paid success: treat response as incomplete; log request id.
- Payment signature rejected: request a new challenge and sign again.
- An exact retry with the same settled payment identifier and payment proof returns the cached
  original response; changing the proof or request returns `409 payment_replay_mismatch`.

## Script Exit Codes

The skill's helper scripts (`quotient.sh`, `pm.sh`, `signal-strategy.mjs`, `converge-monitor.sh`) use a shared exit-code contract:

- `0` - Success.
- `1` - API/HTTP error (non-2xx from Quotient or an external venue after retries; also `pm.sh --expect-condition` mismatch).
- `2` - Config/usage error (invalid `QUOTIENT_API_KEY`, missing Bankr CLI/login in x402 mode, bad arguments, disallowed `QUOTIENT_BASE_URL`, invalid/expired approval token, non-binary market without `--outcome`); fix inputs, do not retry.
- `3` - Partial data (some sub-reads degraded or unavailable — e.g. `live_priced: false` rows or a degraded venue block); output is usable but flagged. For `signal-strategy.mjs --confirm` it also means the batch stopped on a failed/cancelled/timed-out job.
- `10` - Payment approval required. A `payment_preview` JSON object was printed on stdout (human summary on stderr); **nothing was paid**. Relay the preview's costs to the user; on approval re-run with `--approve <token>`.
- `11` - Autopay policy present but a cap/budget would be exceeded. Same `payment_preview` output; nothing was paid. Relay to the user; an explicit `--approve` overrides for one run, or the user raises caps via `quotient.sh autopay init --force`.
- `12` - Execution confirmation required (`signal-strategy.mjs`): the trade plan was written and previewed, **nothing was submitted**. Also used when a confirm-time re-quote fails tolerance. Relay the plan + risk disclosure; on approval re-run with `--execute --confirm <hash>`.
- `13` - Submitted-unverified (`signal-strategy.mjs --confirm`): a Bankr job completed but no mined receipt + position change could be verified. **An order may be live** — check the wallet and Bankr job manually before re-running. Batch stopped.

Exit codes 10–13 are user-interaction states, not errors: relay them, never auto-retry them, and never fabricate an approval token or plan hash.

## Retry Guidance

- On `429`, pause new parallel work and wait for the integer `Retry-After` value plus small jitter;
  `Retry-After` takes precedence over `RateLimit` reset hints. Retry the failed request once.
- Read `RateLimit-Policy` for the active second/minute/day quotas and `RateLimit` for remaining
  capacity (`r`) and reset time (`t`). Keep in-flight work at or below
  `X-Quotient-Max-Concurrent` for the operation's scope.
- Use exponential backoff with jitter for `502` and other `5xx`.
- Do not retry `422` without correcting inputs.
- Keep retries idempotent and bounded.

## Paid-Call Retry Rules

- API-key requests are not automatically retried: credits are debited before the upstream
  response, so a network failure is ambiguous and an automatic retry could debit twice.
  Check the balance/request result first.
- Scripts pay the live 402-challenge price under a pinned ceiling (2× the published price), so ordinary price changes never fail. A refusal names the cause: a price above the ceiling or a pinned-tuple mismatch (wrong payee/asset/network). Relay it to the user — a legitimate raise is accepted via a `route_overrides` entry, a tuple mismatch never is. Never blindly raise a cap.
- Within one run each URL is paid at most once (responses are memoized); a failed paid call is retried once, each attempt is recorded in the spend ledger, and retries never exceed the run's approved worst-case total.
- If the same URL was paid within the last 10 minutes, the scripts warn before paying again — the previous response may still be usable.
