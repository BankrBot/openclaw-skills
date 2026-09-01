#!/bin/bash
# Approve USDC spending for Newsworthy FeedRegistry on World Chain
# Usage: ./approve.sh
# One-time setup — approves max USDC so you don't need to re-approve per submission.

set -euo pipefail

for cmd in bankr; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "$cmd not found. Install: bun install -g @bankr/cli" >&2
    exit 1
  fi
done

USDC="0x79A02482A880bCE3F13e09Da970dC34db4CD24d1"
REGISTRY="0xb2d538D2BD69a657A5240c446F0565a7F5d52BBF"
CHAIN_ID=480

# approve(address,uint256) — max uint256
APPROVE_SELECTOR="095ea7b3"
SPENDER_PADDED="000000000000000000000000${REGISTRY:2}"
MAX_UINT="ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
APPROVE_DATA="0x${APPROVE_SELECTOR}${SPENDER_PADDED}${MAX_UINT}"

echo "📰 Newsworthy — Approve USDC on World Chain"
echo "   Registry: $REGISTRY"
echo "   Token: $USDC"
echo ""

APPROVE_TX="{\"to\": \"$USDC\", \"data\": \"$APPROVE_DATA\", \"value\": \"0\", \"chainId\": $CHAIN_ID}"

RESULT=$(bankr prompt "Submit this transaction to approve USDC for Newsworthy on World Chain: $APPROVE_TX" 2>&1)

if echo "$RESULT" | grep -qi "tx\|hash\|success\|0x"; then
  echo "✅ USDC approved for Newsworthy"
else
  echo "❌ Approval failed: $RESULT"
  exit 1
fi
