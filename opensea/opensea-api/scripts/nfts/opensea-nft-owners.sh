#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 3 ]; then
  echo "Usage: opensea-nft-owners.sh <chain> <contract> <token_id> [limit] [next]" >&2
  echo "Get owners of an NFT (paginated for ERC-1155s)" >&2
  exit 1
fi

chain="$1"
contract="$2"
identifier="$3"
limit="${4:-20}"
next="${5:-}"

query="limit=$limit"
if [ -n "$next" ]; then
  query="$query&next=$next"
fi

"$(dirname "$0")/../opensea-get.sh" "/api/v2/chain/${chain}/contract/${contract}/nfts/${identifier}/owners" "$query"
