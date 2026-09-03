#!/usr/bin/env bash
#
# Hunch partner API — end-to-end walkthrough: discover → quote → trade(402).
#
# Exercises the read path fully and shows the x402 payment challenge for the
# trade (the only step that needs a wallet signature, which the hosted Bankr
# agent supplies). Safe to run against prod: no funds move without a signed
# X-PAYMENT header, so this stops at the 402 challenge.
#
# Requires: curl, jq.
# Usage:
#   ./walkthrough.sh                 # defaults: token=$BNKR, side=yes, size=5
#   TOKEN='$LFI' SIDE=no SIZE=3 ./walkthrough.sh
#   BASE=https://staging.example.xyz ./walkthrough.sh
#
set -euo pipefail

BASE="${BASE:-https://www.playhunch.xyz}"
TOKEN="${TOKEN:-\$BNKR}"
SIDE="${SIDE:-yes}"
SIZE="${SIZE:-5}"
WALLET="${WALLET:-0x0000000000000000000000000000000000000000}"

say() { printf '\n\033[1;35m== %s ==\033[0m\n' "$1"; }

say "1. discover ${TOKEN}"
# URL-encode the token ($ → %24) for the query string.
Q=$(printf '%s' "$TOKEN" | jq -sRr @uri)
# Each match nests the market under .market; odds/stats/headline are siblings.
# `headline` is the screenshot-ready line (title · odds · social proof · close)
# the bot renders verbatim.
DISCOVER=$(curl -fsS "${BASE}/api/partner/discover?q=${Q}")
echo "$DISCOVER" | jq '{count, matches: [.matches[] | {id: .market.id, headline, matchKind}]}'

MARKET_ID=$(echo "$DISCOVER" | jq -r '.matches[0].market.id // empty')
if [ -z "$MARKET_ID" ]; then
  echo "No live market for ${TOKEN} — nothing to bet on (this is the silence case)."
  exit 0
fi
say "Top match: ${MARKET_ID}"

say "2. quote ${MARKET_ID} (${SIDE}, \$${SIZE})"
curl -fsS "${BASE}/api/partner/quote?marketId=${MARKET_ID}&side=${SIDE}&sizeUsd=${SIZE}" \
  | jq '{market: .market.question, odds, quote, tokenSnapshot}'

say "3. trade — POST without X-PAYMENT → expect a 402 x402 challenge"
IDEM=$(uuidgen 2>/dev/null || echo "demo-$(date +%s)")
HTTP=$(curl -sS -o /tmp/hunch_trade_body.json -w '%{http_code}' -X POST \
  "${BASE}/api/partner/trade" \
  -H 'content-type: application/json' \
  -d "{\"marketId\":\"${MARKET_ID}\",\"side\":\"${SIDE}\",\"sizeUsd\":${SIZE},\"idemKey\":\"${IDEM}\",\"ref\":\"bankr\",\"walletAddress\":\"${WALLET}\"}")
echo "HTTP ${HTTP}"
jq '{scheme: .accepts[0].scheme, network: .accepts[0].network, payTo: .accepts[0].payTo, maxAmountRequired: .accepts[0].maxAmountRequired} // .' /tmp/hunch_trade_body.json 2>/dev/null \
  || cat /tmp/hunch_trade_body.json

say "Done"
echo "To settle: sign the EIP-3009 authorization from the 402, base64 it into the"
echo "X-PAYMENT header, and resubmit the SAME body (idemKey=${IDEM})."
