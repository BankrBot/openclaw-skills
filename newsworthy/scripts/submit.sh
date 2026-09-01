#!/bin/bash
# Submit a tweet to Newsworthy on World Chain via Bankr
# Usage: ./submit.sh <tweet_url> [category]
#
# Examples:
#   ./submit.sh "https://x.com/VitalikButerin/status/1234567890" "crypto"
#   ./submit.sh "https://x.com/OpenAI/status/9876543210" "ai"

set -euo pipefail

for cmd in bankr cast; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "$cmd not found. Install bankr: bun install -g @bankr/cli | Install cast: curl -L https://foundry.paradigm.xyz | bash" >&2
    exit 1
  fi
done

TWEET_URL="${1:-}"
CATEGORY="${2:-crypto}"

if [[ -z "$TWEET_URL" ]]; then
  echo "Usage: $0 <tweet_url> [category]"
  echo ""
  echo "  tweet_url   Must be https://x.com/<user>/status/<id>"
  echo "              or https://twitter.com/<user>/status/<id>"
  echo "  category    Optional tag: 'crypto', 'ai', etc. (default: crypto)"
  echo ""
  echo "Examples:"
  echo "  $0 \"https://x.com/VitalikButerin/status/1234567890\" crypto"
  echo "  $0 \"https://x.com/OpenAI/status/9876543210\" ai"
  exit 1
fi

# Validate URL format locally before wasting gas
if ! echo "$TWEET_URL" | grep -qE '^https://(x\.com|twitter\.com)/[^/]+/status/[0-9]+'; then
  echo "❌ Invalid URL. Must be a tweet: https://x.com/<user>/status/<id>"
  exit 1
fi

REGISTRY="0xb2d538D2BD69a657A5240c446F0565a7F5d52BBF"
CHAIN_ID=480
RPC_URL="https://worldchain-mainnet.g.alchemy.com/public"

# Check if URL was already submitted (keccak256 of URL bytes)
URL_HASH=$(echo -n "$TWEET_URL" | cast keccak 2>/dev/null || true)
if [[ -n "$URL_HASH" ]]; then
  IS_SUBMITTED=$(cast call "$REGISTRY" "urlSubmitted(bytes32)(bool)" "$URL_HASH" --rpc-url "$RPC_URL" 2>/dev/null || echo "false")
  if [[ "$IS_SUBMITTED" == "true" ]]; then
    echo "❌ This tweet has already been submitted."
    exit 1
  fi
fi

echo "📰 Newsworthy — Submit Tweet"
echo "   URL: $TWEET_URL"
echo "   Category: $CATEGORY"
echo "   Bond: 1 USDC"
echo ""

# Encode submitItem(string,string) calldata
# Using cast to ABI-encode the call
CALLDATA=$(cast calldata "submitItem(string,string)" "$TWEET_URL" "$CATEGORY" 2>/dev/null)

if [[ -z "$CALLDATA" ]]; then
  echo "❌ Failed to encode calldata. Ensure 'cast' (foundry) is installed."
  exit 1
fi

SUBMIT_TX="{\"to\": \"$REGISTRY\", \"data\": \"$CALLDATA\", \"value\": \"0\", \"chainId\": $CHAIN_ID}"

RESULT=$(bankr prompt "Submit this transaction to post a tweet on Newsworthy (World Chain). It will bond 1 USDC: $SUBMIT_TX" 2>&1)

if echo "$RESULT" | grep -qi "tx\|hash\|success\|0x"; then
  echo "✅ Tweet submitted to Newsworthy!"
  echo "   Now entering 6-hour voting period."
  echo "   Check status: curl https://api.newsworthycli.com/public/pending"
else
  echo "❌ Submission failed: $RESULT"
  echo ""
  echo "Common issues:"
  echo "  - NotRegistered: Need World ID registration first"
  echo "  - TransferFailed: Run ./approve.sh and check USDC balance"
  echo "  - DuplicateUrl: Tweet already submitted"
  echo "  - DailyLimitReached: 50/day cap hit"
  exit 1
fi
