#!/bin/bash
# Check a wallet's pending reflection earnings for a DumbMoney token
# Usage: check-earnings.sh <MINT_ADDRESS> <WALLET_ADDRESS>
MINT="$1"
WALLET="$2"
if [ -z "$MINT" ] || [ -z "$WALLET" ]; then
  echo "Usage: check-earnings.sh <MINT_ADDRESS> <WALLET_ADDRESS>"
  exit 1
fi
# Validate base58 format (Solana addresses are 32-44 chars of alphanumeric, no 0/O/I/l)
if ! echo "$MINT" | grep -qE '^[1-9A-HJ-NP-Za-km-z]{32,44}$'; then
  echo "Error: Invalid mint address format"
  exit 1
fi
if ! echo "$WALLET" | grep -qE '^[1-9A-HJ-NP-Za-km-z]{32,44}$'; then
  echo "Error: Invalid wallet address format"
  exit 1
fi
curl -s "https://dumbmoney.win/api/tokens/${MINT}/earnings?wallet=${WALLET}" | jq '{
  wallet, token,
  pendingEarnings: "\(.pendingSol) SOL ($\(.pendingUsd | tostring | .[0:10]))",
  sharePercent: "\(.sharePercent | tostring | .[0:5])%",
  holderShares, totalShares
}'
