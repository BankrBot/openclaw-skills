#!/bin/bash
# Vote on a Newsworthy submission via Bankr
# Usage: ./vote.sh <itemId> <keep|remove>
#
# Examples:
#   ./vote.sh 42 keep      # vote to keep item #42
#   ./vote.sh 42 remove    # vote to remove item #42

set -euo pipefail

for cmd in bankr cast; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "$cmd not found. Install bankr: bun install -g @bankr/cli | Install cast: curl -L https://foundry.paradigm.xyz | bash" >&2
    exit 1
  fi
done

ITEM_ID="${1:-}"
DIRECTION="${2:-}"

if [[ -z "$ITEM_ID" ]] || [[ -z "$DIRECTION" ]]; then
  echo "Usage: $0 <itemId> <keep|remove>"
  echo ""
  echo "  itemId     The item number to vote on"
  echo "  direction  'keep' (support) or 'remove' (against)"
  echo ""
  echo "Find pending items:"
  echo "  curl -s https://api.newsworthycli.com/public/pending | jq '.items[] | {id, url}'"
  exit 1
fi

# Parse direction to bool
case "$DIRECTION" in
  keep|yes|true|1|support)
    SUPPORT=true
    SUPPORT_LABEL="KEEP"
    ;;
  remove|no|false|0|against)
    SUPPORT=false
    SUPPORT_LABEL="REMOVE"
    ;;
  *)
    echo "❌ Direction must be 'keep' or 'remove'"
    exit 1
    ;;
esac

REGISTRY="0xb2d538D2BD69a657A5240c446F0565a7F5d52BBF"
CHAIN_ID=480
RPC_URL="https://worldchain-mainnet.g.alchemy.com/public"

# Check item status before voting
ITEM_STATUS=$(cast call "$REGISTRY" "items(uint256)(address,uint256,string,string,uint256,uint256,uint256,uint8)" "$ITEM_ID" --rpc-url "$RPC_URL" 2>/dev/null | tail -1 || echo "")
if [[ "$ITEM_STATUS" != "0" ]] && [[ -n "$ITEM_STATUS" ]]; then
  echo "❌ Item #$ITEM_ID is not in voting period (status: $ITEM_STATUS)"
  exit 1
fi

echo "📰 Newsworthy — Vote on Item #$ITEM_ID"
echo "   Direction: $SUPPORT_LABEL"
echo "   Cost: 0.5 USDC"
echo ""

# Encode vote(uint256,bool)
CALLDATA=$(cast calldata "vote(uint256,bool)" "$ITEM_ID" "$SUPPORT" 2>/dev/null)

if [[ -z "$CALLDATA" ]]; then
  echo "❌ Failed to encode calldata."
  exit 1
fi

VOTE_TX="{\"to\": \"$REGISTRY\", \"data\": \"$CALLDATA\", \"value\": \"0\", \"chainId\": $CHAIN_ID}"

RESULT=$(bankr prompt "Submit this vote transaction on Newsworthy (World Chain). Costs 0.5 USDC: $VOTE_TX" 2>&1)

if echo "$RESULT" | grep -qi "tx\|hash\|success\|0x"; then
  echo "✅ Voted $SUPPORT_LABEL on item #$ITEM_ID"
else
  echo "❌ Vote failed: $RESULT"
  echo ""
  echo "Common issues:"
  echo "  - AlreadyVoted: You already voted on this item"
  echo "  - SelfVote: Can't vote on your own submission"
  echo "  - VotingPeriodExpired: Window closed, call resolve instead"
  echo "  - TransferFailed: Run ./approve.sh and check USDC balance"
  exit 1
fi
