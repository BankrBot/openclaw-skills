#!/usr/bin/env bash
set -euo pipefail
RPC="${BASE_RPC:-https://mainnet.base.org}"
ESCROW=0xD43586103c760Bd5e139a2De2655413dE441B150
ASSET_NAME="${1:?eth|usdc}"
TO="${2:-}"

if [[ "$ASSET_NAME" == "eth" ]]; then
  ASSET=0x0000000000000000000000000000000000000000
else
  ASSET=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
fi

if [[ -n "$TO" ]]; then
  DATA=$(cast calldata "claimTo(address,address)" "$TO" "$ASSET")
else
  DATA=$(cast calldata "claim(address)" "$ASSET")
fi

echo "to=$ESCROW"
echo "chainId=8453"
echo "value=0"
echo "data=$DATA"

if [[ "${SEND:-}" == "1" && -n "${PRIVATE_KEY:-}" ]]; then
  cast send "$ESCROW" "$DATA" --rpc-url "$RPC" --private-key "$PRIVATE_KEY"
fi