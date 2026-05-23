#!/usr/bin/env bash
# Paid call to /api/analyze-link with x402 challenge handling.
#
# Strategy:
#   1. POST without payment. Expect 402.
#   2. Parse the 402.accepts[] entry whose `extra.symbol` matches
#      CAPACITR_PAY_ASSET (default "usdc"). USDC is index 0 when
#      configured, so a naive fallback to accepts[0] also works.
#   3. The script does NOT sign — it prints the accept entry so your
#      signing layer (Bankr platform, viem, ethers, etc.) can produce
#      the X-Payment header. Re-run with `X_PAYMENT=<base64>` set to
#      finish the call.
#
# Env:
#   CAPACITR_BASE_URL  (default https://app.capacitr.xyz)
#   CAPACITR_PAY_ASSET ("usdc", default — only "usdc" is facilitator-settled today)
#   CAPACITR_INPUT     URL or text to analyze (required)
#   X_PAYMENT          pre-signed base64 X-Payment header (optional;
#                      when set, script POSTs immediately with it)
#
# Usage:
#   # Step 1 — discover the accept entry to sign:
#   CAPACITR_INPUT="https://x.com/example/status/123" ./analyze.sh
#
#   # Step 2 — your signer produces an X-Payment header from that entry.
#   # Step 3 — re-run with the signed header:
#   X_PAYMENT="eyJ4..." CAPACITR_INPUT="https://x.com/example/status/123" ./analyze.sh

set -euo pipefail
: "${CAPACITR_BASE_URL:=https://app.capacitr.xyz}"
: "${CAPACITR_PAY_ASSET:=usdc}"
: "${CAPACITR_INPUT:?Set CAPACITR_INPUT to a URL or text}"

ENDPOINT="$CAPACITR_BASE_URL/api/analyze-link"

if [[ "$CAPACITR_INPUT" == http* ]]; then
  BODY=$(jq -n --arg url "$CAPACITR_INPUT" '{url:$url}')
else
  BODY=$(jq -n --arg q "$CAPACITR_INPUT" '{query:$q}')
fi

# Fast path: if X_PAYMENT is already set, POST with it immediately.
if [[ -n "${X_PAYMENT:-}" ]]; then
  curl -sS -X POST \
    -H "Content-Type: application/json" \
    -H "X-Payment: $X_PAYMENT" \
    -d "$BODY" "$ENDPOINT" | jq .
  exit 0
fi

# Step 1: unpaid call → expect 402.
CHALLENGE_RAW=$(curl -sS -w '\n%{http_code}' -X POST \
  -H "Content-Type: application/json" -d "$BODY" "$ENDPOINT")
HTTP_CODE=$(printf '%s' "$CHALLENGE_RAW" | tail -n1)
CHALLENGE_BODY=$(printf '%s' "$CHALLENGE_RAW" | sed '$d')

if [[ "$HTTP_CODE" == "200" ]]; then
  # Same-origin browser bypass, dev mode w/ X402_DISABLED=true, etc.
  echo "$CHALLENGE_BODY"
  exit 0
fi

if [[ "$HTTP_CODE" != "402" ]]; then
  echo "[analyze.sh] unexpected status $HTTP_CODE" >&2
  echo "$CHALLENGE_BODY" >&2
  exit 1
fi

# Step 2: surface the accept entry the caller should sign against.
ACCEPT=$(printf '%s' "$CHALLENGE_BODY" |
  jq --arg sym "$CAPACITR_PAY_ASSET" \
     '.x402.accepts[] | select(.extra.symbol == $sym)' |
  jq -s '.[0]')

if [[ "$ACCEPT" == "null" || -z "$ACCEPT" ]]; then
  echo "[analyze.sh] asset '$CAPACITR_PAY_ASSET' not in accepts[]" >&2
  printf '%s' "$CHALLENGE_BODY" | jq '.x402.accepts[].extra.symbol' >&2
  exit 1
fi

echo "[analyze.sh] sign this accept entry, then re-run with X_PAYMENT=<base64>:" >&2
printf '%s' "$ACCEPT" | jq . >&2
exit 2
