#!/bin/bash
# Notify the Super Bowl Squares app that an OpenSea order was fulfilled
# This clears the cache so other users see updated listings
# Usage: ./notify-order-fulfilled.sh <order_hash> <contest_id> [chain_id]

set -e

ORDER_HASH="${1:?Usage: notify-order-fulfilled.sh <order_hash> <contest_id> [chain_id]}"
CONTEST_ID="${2:?Usage: notify-order-fulfilled.sh <order_hash> <contest_id> [chain_id]}"
CHAIN_ID="${3:-8453}"  # Default to Base

API_URL="https://www.superbowlsquares.app/api/opensea/orders/fulfilled"

echo "Notifying app of fulfilled order..." >&2
echo "  Order: $ORDER_HASH" >&2
echo "  Contest: $CONTEST_ID" >&2
echo "  Chain: $CHAIN_ID" >&2

RESPONSE=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d "{\"orderHash\": \"$ORDER_HASH\", \"contestId\": $CONTEST_ID, \"chainId\": $CHAIN_ID}")

if echo "$RESPONSE" | grep -q '"success":true'; then
  echo "✅ App cache cleared successfully" >&2
  echo "$RESPONSE"
else
  echo "⚠️ Failed to notify app: $RESPONSE" >&2
  echo "$RESPONSE"
  exit 1
fi
