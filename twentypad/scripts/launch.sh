#!/usr/bin/env bash
set -euo pipefail
RPC="${BASE_RPC:-https://mainnet.base.org}"
FACTORY=0x15a3f3ABb733868d193b511dd5b91f82ebF888A3
ETH=0x0000000000000000000000000000000000000000
USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

NAME=""; SYMBOL=""; QUOTE=eth
while [[ $# -gt 0 ]]; do
  case "$1" in
    --name) NAME="$2"; shift 2 ;;
    --symbol) SYMBOL="$2"; shift 2 ;;
    --quote) QUOTE="$2"; shift 2 ;;
    *) echo "unknown $1" >&2; exit 1 ;;
  esac
done
[[ -n "$NAME" && -n "$SYMBOL" ]] || { echo "need --name and --symbol" >&2; exit 1; }

QUOTE_ADDR="$ETH"
[[ "$QUOTE" == "usdc" ]] && QUOTE_ADDR="$USDC"

suffix=$(cast call "$FACTORY" "tokenSuffix()(uint16)" --rpc-url "$RPC")
last=$(cast call "$FACTORY" "lastSaltUint()(uint256)" --rpc-url "$RPC")
start=$((last + 1))

echo "suffix=$suffix lastSalt=$last" >&2

for ((i=start; i<start+50000; i++)); do
  salt=$(cast --to-bytes32 "$i")
  token=$(cast call "$FACTORY" "predictToken(bytes32)(address)" "$salt" --rpc-url "$RPC")
  low=$(( $(cast --to-dec "$token") & 0xFFF ))
  if [[ "$low" -eq "$suffix" ]]; then
    echo "salt=$salt"
    echo "token=$token"
    echo "quote=$QUOTE_ADDR"
    echo "name=$NAME"
    echo "symbol=$SYMBOL"
    echo "to=$FACTORY"
    echo "chainId=8453"
    echo "value=0"
    echo "hint=encode createLaunch with empty profile strings, editable=false"
    exit 0
  fi
done
echo "no salt in 50000 tries" >&2
exit 1