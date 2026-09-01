#!/bin/bash
# Claim one-time $NEWSWORTHY incentive on Base via Boost Protocol
# Usage: ./claim-incentive.sh [address]
#
# Checks eligibility, fetches claim signature from Boost API,
# and submits claimIncentiveFor() on Base via bankr.

set -euo pipefail

for cmd in bankr cast curl jq; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "$cmd not found. Install bankr: bun install -g @bankr/cli | Install cast: curl -L https://foundry.paradigm.xyz | bash" >&2
    exit 1
  fi
done

BOOST_CORE="0xea11A7937809B8585e63B12Cc86bf91a72a5b08A"
BOOST_ID="8453:0xea11a7937809b8585e63b12cc86bf91a72a5b08a:1657"
BOOST_INDEX=1657
INCENTIVE_INDEX=0
REFERRER="0x0000000000000000000000000000000000000000"
CHAIN_ID=8453

# Get wallet address
ADDRESS="${1:-}"
if [[ -z "$ADDRESS" ]]; then
  ADDRESS=$(bankr prompt "What is my wallet address? Reply with just the 0x address, nothing else." 2>&1 | grep -oE '0x[a-fA-F0-9]{40}' | head -1)
  if [[ -z "$ADDRESS" ]]; then
    echo "❌ Could not determine wallet address." >&2
    exit 1
  fi
fi

echo "📰 Newsworthy — Claim \$NEWSWORTHY Incentive"
echo "   Address: $ADDRESS"
echo "   Chain: Base (8453)"
echo ""

# Fetch claimable signatures from Boost API
echo "Checking eligibility..."
CLAIMABLE=$(curl -sf "https://api-v2.boost.xyz/signatures/claimable/$ADDRESS" 2>/dev/null || echo "[]")

MATCH=$(echo "$CLAIMABLE" | jq -r "[.[] | select(.boostId == \"$BOOST_ID\")] | first // empty" 2>/dev/null || echo "")

if [[ -z "$MATCH" ]] || [[ "$MATCH" == "null" ]]; then
  # Check if already claimed
  TRANSACTIONS=$(curl -sf "https://api-v2.boost.xyz/transactions?address=$ADDRESS&boostId=$BOOST_ID" 2>/dev/null || echo "[]")
  CLAIMED=$(echo "$TRANSACTIONS" | jq '[.[] | select(.type == "CLAIM")] | length' 2>/dev/null || echo "0")

  if [[ "$CLAIMED" -gt 0 ]]; then
    echo "Already claimed! You've already received your \$NEWSWORTHY tokens."
    exit 0
  fi

  echo "❌ Not eligible yet."
  echo ""
  echo "   You need to vote on Newsworthy first:"
  echo "   1. ./register.sh   — register via World ID"
  echo "   2. ./approve.sh    — approve USDC"
  echo "   3. ./vote.sh <id> keep  — vote on a pending item"
  echo "   4. Wait ~2 min, then re-run this script"
  exit 1
fi

# Extract claim signature
SIGNATURE=$(echo "$MATCH" | jq -r '.signature')
CLAIM_AMOUNT=$(echo "$MATCH" | jq -r '.claimAmount // empty')

if [[ -z "$SIGNATURE" ]] || [[ "$SIGNATURE" == "null" ]]; then
  echo "❌ No claim signature available. Try again in a few minutes."
  exit 1
fi

AMOUNT_HUMAN=$(echo "scale=0; ${CLAIM_AMOUNT:-6500000000000000000000000} / 1000000000000000000" | bc 2>/dev/null || echo "6,500,000")
echo "✅ Eligible for $AMOUNT_HUMAN \$NEWSWORTHY"
echo ""
echo "Submitting claim on Base..."

# Encode claimIncentiveFor(uint256 boostId, uint256 incentiveId, address referrer, bytes data, address claimant)
CALLDATA=$(cast calldata "claimIncentiveFor(uint256,uint256,address,bytes,address)" \
  "$BOOST_INDEX" "$INCENTIVE_INDEX" "$REFERRER" "$SIGNATURE" "$ADDRESS" 2>/dev/null)

if [[ -z "$CALLDATA" ]]; then
  echo "❌ Failed to encode claim calldata."
  exit 1
fi

CLAIM_TX="{\"to\": \"$BOOST_CORE\", \"data\": \"$CALLDATA\", \"value\": \"0\", \"chainId\": $CHAIN_ID}"

RESULT=$(bankr prompt "Submit this claim transaction on Base to receive \$NEWSWORTHY tokens from Boost Protocol. Gas is sponsored on Base: $CLAIM_TX" 2>&1)

if echo "$RESULT" | grep -qi "tx\|hash\|success\|0x"; then
  echo "✅ Claimed $AMOUNT_HUMAN \$NEWSWORTHY!"
  echo "   Tokens sent to $ADDRESS on Base."
  echo ""
  echo "   View on BaseScan:"
  echo "   https://basescan.org/address/$ADDRESS"
else
  echo "❌ Claim failed: $RESULT"
  echo ""
  echo "Common issues:"
  echo "  - Already claimed (one-time only)"
  echo "  - Signature expired — re-run ./check-incentive.sh"
  exit 1
fi
