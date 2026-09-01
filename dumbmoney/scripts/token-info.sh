#!/bin/bash
# Get detailed info about a specific DumbMoney token
# Usage: token-info.sh <MINT_ADDRESS>
MINT="$1"
if [ -z "$MINT" ]; then
  echo "Usage: token-info.sh <MINT_ADDRESS>"
  exit 1
fi
# Validate base58 format (Solana addresses are 32-44 chars of alphanumeric, no 0/O/I/l)
if ! echo "$MINT" | grep -qE '^[1-9A-HJ-NP-Za-km-z]{32,44}$'; then
  echo "Error: Invalid Solana address format"
  exit 1
fi
curl -s "https://dumbmoney.win/api/tokens/${MINT}" | jq '{
  name, symbol, mint,
  status,
  reflectionRate: "\(.reflectionBps / 100)%",
  burnRate: "\(.burnBps / 100)%",
  solReserves: "\(.solReserves) SOL",
  marketCapSol: "\(.marketCapSol) SOL",
  reflectionPool: "\(.reflectionPoolSol) SOL ($\(.reflectionPoolUsd | tostring | .[0:10]))",
  totalBurned: "\(.totalBurned) tokens",
  bondingCurveProgress: "\(.bondingCurveProgress | tostring | .[0:5])%",
  price: .price
}'
