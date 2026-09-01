#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 3 ]; then
  echo "Usage: opensea-account-token-transfers.sh <address> <contract_address> <chain> [limit] [next]" >&2
  echo "Get the token transfers contributing to a wallet's position in a currency" >&2
  exit 1
fi

address="$1"
contract_address="$2"
chain="$3"
limit="${4:-20}"
next="${5:-}"

query="contract_address=$contract_address&chain=$chain&limit=$limit"
[ -n "$next" ] && query="$query&next=$next"

"$(dirname "$0")/../opensea-get.sh" "/api/v2/account/${address}/pnl/token-transfers" "$query"
