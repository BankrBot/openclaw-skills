#!/bin/bash
# Withdraw accumulated USDC from Newsworthy (bond refunds + vote winnings)
# Usage: ./withdraw.sh

set -euo pipefail

for cmd in bankr; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "$cmd not found. Install: bun install -g @bankr/cli" >&2
    exit 1
  fi
done

REGISTRY="0xb2d538D2BD69a657A5240c446F0565a7F5d52BBF"
CHAIN_ID=480

echo "📰 Newsworthy — Withdraw USDC"
echo ""

# withdraw() selector
CALLDATA="0x3ccfd60b"

WITHDRAW_TX="{\"to\": \"$REGISTRY\", \"data\": \"$CALLDATA\", \"value\": \"0\", \"chainId\": $CHAIN_ID}"

RESULT=$(bankr prompt "Submit this withdrawal transaction on Newsworthy (World Chain) to collect accumulated USDC: $WITHDRAW_TX" 2>&1)

if echo "$RESULT" | grep -qi "tx\|hash\|success\|0x"; then
  echo "✅ Withdrawal complete — USDC sent to your wallet"
else
  echo "❌ Withdrawal failed: $RESULT"
  echo "   (May have 0 pending — check pendingWithdrawals first)"
  exit 1
fi
