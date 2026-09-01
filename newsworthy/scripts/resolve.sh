#!/bin/bash
# Resolve a Newsworthy item after its voting period ends
# Usage: ./resolve.sh <itemId>
#
# This is permissionless — anyone can resolve any expired item.
# Resolving triggers payout calculation for all voters.

set -euo pipefail

for cmd in bankr cast; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "$cmd not found. Install bankr: bun install -g @bankr/cli | Install cast: curl -L https://foundry.paradigm.xyz | bash" >&2
    exit 1
  fi
done

ITEM_ID="${1:-}"

if [[ -z "$ITEM_ID" ]]; then
  echo "Usage: $0 <itemId>"
  echo ""
  echo "Resolves a pending item after its 6-hour voting window."
  echo "This is permissionless — anyone can call it."
  exit 1
fi

REGISTRY="0xb2d538D2BD69a657A5240c446F0565a7F5d52BBF"
CHAIN_ID=480

echo "📰 Newsworthy — Resolve Item #$ITEM_ID"
echo ""

CALLDATA=$(cast calldata "resolve(uint256)" "$ITEM_ID" 2>/dev/null)

if [[ -z "$CALLDATA" ]]; then
  echo "❌ Failed to encode calldata."
  exit 1
fi

RESOLVE_TX="{\"to\": \"$REGISTRY\", \"data\": \"$CALLDATA\", \"value\": \"0\", \"chainId\": $CHAIN_ID}"

RESULT=$(bankr prompt "Submit this resolve transaction on Newsworthy (World Chain): $RESOLVE_TX" 2>&1)

if echo "$RESULT" | grep -qi "tx\|hash\|success\|0x"; then
  echo "✅ Item #$ITEM_ID resolved!"
  echo "   Run ./withdraw.sh to collect any rewards."
else
  echo "❌ Resolve failed: $RESULT"
  echo "   (Voting period may not be over yet — check submittedAt + 6 hours)"
  exit 1
fi
