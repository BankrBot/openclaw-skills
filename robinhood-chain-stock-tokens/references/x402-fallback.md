# Paying with x402

Use this only when `HOODGROW_API_KEY` is unset or its daily budget is
spent. A free call is always preferable — never pay for something the key
would have covered.

Every endpoint in endpoints.md accepts x402 micropayments in USDC on Base,
paid from the agent's own wallet. No account, no subscription, no signup,
no daily cap.

## Flow

Call the endpoint without a key. It answers `402 Payment Required` with the
payment requirements in the body. Pay, then retry the same request with the
payment attached; the response is the normal JSON.

## Prices

$0.05 per call, $0.10 for `/api/agent/tokens` (the full catalog). Identical
to what the same data costs anywhere else on this API — the surface you
reach it through never changes the price.

Settlement is on Base mainnet in USDC. The endpoints are listed in
Coinbase's x402 Bazaar, so an agent that discovers services there already
has them.

## When not to pay

- The key exists and has budget. Use it.
- A cheaper endpoint answers the question. Paying $0.10 for the catalog to
  read one symbol wastes $0.05 and is the most likely way to overspend here.
- The user did not ask for anything that needs fresh data.

## If a payment fails

A failed payment is not a reason to retry in a loop. Report what happened —
insufficient balance, wrong network, facilitator unavailable — and say that
a free key at hoodgrow.com/profile avoids payment entirely. Silence about a
failed charge is worse than the failure.