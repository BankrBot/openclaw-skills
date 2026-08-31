#!/usr/bin/env bash
set -euo pipefail
RPC="${BASE_RPC:-https://mainnet.base.org}"
ESCROW=0xD43586103c760Bd5e139a2De2655413dE441B150
ETH=0x0000000000000000000000000000000000000000
USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
WALLET="${1:?wallet address}"

eth=$(cast call "$ESCROW" "owed(address,address)(uint256)" "$WALLET" "$ETH" --rpc-url "$RPC")
usdc=$(cast call "$ESCROW" "owed(address,address)(uint256)" "$WALLET" "$USDC" --rpc-url "$RPC")
echo "wallet=$WALLET"
echo "eth_wei=$eth"
echo "usdc_raw=$usdc"