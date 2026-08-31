#!/usr/bin/env bash
set -euo pipefail
TOKEN="${1:?token address}"
SIDE="${2:?buy|sell}"
QUOTE="${3:-eth}"
HOOK=0x8c0986c564025903B0f1C7c87cBA1760cB4FAAcc
ETH=0x0000000000000000000000000000000000000000
USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
Q="$ETH"
[[ "$QUOTE" == "usdc" ]] && Q="$USDC"

# address sort: ETH (0x0) is always currency0
echo "currency0=$Q"
echo "currency1=$TOKEN"
echo "fee=0"
echo "tickSpacing=200"
echo "hooks=$HOOK"
if [[ "$SIDE" == "buy" ]]; then
  echo "zeroForOne=true"
else
  echo "zeroForOne=false"
fi
echo "router=0x6fF5693b99212Da76ad316178A184AB56D299b43"
echo "chainId=8453"