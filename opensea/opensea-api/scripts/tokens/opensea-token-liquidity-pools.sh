#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: opensea-token-liquidity-pools.sh <chain> <address> [limit]" >&2
  echo "Get liquidity pools for a token (pool type, USD reserves, bonding-curve progress)" >&2
  exit 1
fi

chain="$1"
address="$2"
limit="${3:-20}"

query="limit=$limit"

"$(dirname "$0")/../opensea-get.sh" "/api/v2/chain/${chain}/token/${address}/liquidity-pools" "$query"
