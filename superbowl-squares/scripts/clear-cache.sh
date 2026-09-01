#!/bin/bash
# Clear cache for Super Bowl Squares after claiming boxes or fulfilling OpenSea orders
# Usage: ./clear-cache.sh <contest_id> [tx_hash_or_order_hash] [chain_id]
#
# Examples:
#   ./clear-cache.sh 77                           # Just refresh contest cache
#   ./clear-cache.sh 77 0xabc123...               # Clear with tx/order hash
#   ./clear-cache.sh 77 0xabc123... 8453          # Explicit chain ID

set -e

CONTEST_ID="$1"
TX_HASH="${2:-}"
CHAIN_ID="${3:-8453}"
BASE_URL="https://superbowlsquares.app"

if [ -z "$CONTEST_ID" ]; then
  echo "Usage: $0 <contest_id> [tx_hash_or_order_hash] [chain_id]"
  exit 1
fi

echo "Clearing cache for contest $CONTEST_ID..."

# Method 1: Clear listings cache
echo "  → Clearing listings cache..."
LISTINGS_RESP=$(curl -sL -X POST "$BASE_URL/api/opensea/listings/$CONTEST_ID/refresh" \
  -H "Content-Type: application/json" \
  -d "{\"chainId\": $CHAIN_ID}")
echo "     $LISTINGS_RESP"

# Method 2: If tx hash provided, also mark as fulfilled (clears contest cache too)
if [ -n "$TX_HASH" ]; then
  echo "  → Marking order fulfilled and clearing contest cache..."
  FULFILLED_RESP=$(curl -sL -X POST "$BASE_URL/api/opensea/orders/fulfilled" \
    -H "Content-Type: application/json" \
    -d "{\"orderHash\": \"$TX_HASH\", \"contestId\": \"$CONTEST_ID\", \"chainId\": $CHAIN_ID}")
  echo "     $FULFILLED_RESP"
fi

# Method 3: Force refresh contest data
echo "  → Force refreshing contest data..."
CONTEST_RESP=$(curl -sL "$BASE_URL/api/contest/$CONTEST_ID?forceRefresh=true" | head -c 200)
echo "     Contest data refreshed (${#CONTEST_RESP} bytes)"

echo "✓ Cache cleared for contest $CONTEST_ID"
