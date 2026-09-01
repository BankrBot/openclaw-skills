#!/bin/bash
# Check $NEWSWORTHY incentive eligibility on Base via Boost Protocol
# Usage: ./check-incentive.sh [address]
#
# If no address provided, queries bankr for your wallet address.
# Returns claimable $NEWSWORTHY balance and claim status.

set -euo pipefail

for cmd in curl jq; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "$cmd not found." >&2
    exit 1
  fi
done

BOOST_ID="8453:0xea11a7937809b8585e63b12cc86bf91a72a5b08a:1657"
NEWSWORTHY_TOKEN="0x0BB65e58E178C82B9148072632DE329655fa0Ba3"

# Get wallet address
ADDRESS="${1:-}"
if [[ -z "$ADDRESS" ]]; then
  if ! command -v bankr >/dev/null 2>&1; then
    echo "Usage: $0 <address>" >&2
    echo "  or install bankr CLI to auto-detect wallet" >&2
    exit 1
  fi
  ADDRESS=$(bankr prompt "What is my wallet address? Reply with just the 0x address, nothing else." 2>&1 | grep -oE '0x[a-fA-F0-9]{40}' | head -1)
  if [[ -z "$ADDRESS" ]]; then
    echo "❌ Could not determine wallet address." >&2
    exit 1
  fi
fi

echo "📰 Newsworthy — Check $NEWSWORTHY Incentive"
echo "   Address: $ADDRESS"
echo "   Boost: $BOOST_ID"
echo ""

# Check claimable incentives via Boost API
CLAIMABLE=$(curl -sf "https://api-v2.boost.xyz/signatures/claimable/$ADDRESS" 2>/dev/null || echo "[]")

# Filter for our boost
MATCH=$(echo "$CLAIMABLE" | jq -r "[.[] | select(.boostId == \"$BOOST_ID\")] | first // empty" 2>/dev/null || echo "")

if [[ -n "$MATCH" ]] && [[ "$MATCH" != "null" ]]; then
  AMOUNT=$(echo "$MATCH" | jq -r '.claimAmount // "6500000000000000000000000"')
  AMOUNT_HUMAN=$(echo "scale=0; $AMOUNT / 1000000000000000000" | bc 2>/dev/null || echo "6,500,000")

  echo "✅ ELIGIBLE — You have a claimable $NEWSWORTHY incentive!"
  echo ""
  echo "   Reward: $AMOUNT_HUMAN \$NEWSWORTHY"
  echo "   Chain: Base (8453)"
  echo "   Token: $NEWSWORTHY_TOKEN"
  echo ""
  echo "   Run ./claim-incentive.sh to claim your tokens."
  exit 0
fi

# Check if already claimed by looking at transaction history
TRANSACTIONS=$(curl -sf "https://api-v2.boost.xyz/transactions?address=$ADDRESS&boostId=$BOOST_ID" 2>/dev/null || echo "[]")
CLAIMED=$(echo "$TRANSACTIONS" | jq '[.[] | select(.type == "CLAIM")] | length' 2>/dev/null || echo "0")

if [[ "$CLAIMED" -gt 0 ]]; then
  echo "Already claimed! You've already received your one-time $NEWSWORTHY incentive."
  echo ""
  echo "   Check your balance:"
  echo "   bankr prompt 'check my $NEWSWORTHY balance on Base (token: $NEWSWORTHY_TOKEN)'"
  exit 0
fi

# Check if they've voted (prerequisite)
echo "Not yet eligible."
echo ""
echo "   To earn the $NEWSWORTHY incentive:"
echo "   1. Register in AgentBook: ./register.sh"
echo "   2. Vote on a pending item: ./vote.sh <itemId> keep"
echo "   3. Wait ~2 min for Boost indexer to detect your vote"
echo "   4. Re-run this script to check eligibility"
echo ""
echo "   Find pending items:"
echo "   curl -s https://api.newsworthycli.com/public/pending | jq '.items[] | {id, url}'"
