#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 3 ]; then
  echo "Usage: opensea-nft-analytics.sh <chain> <contract> <token_id>" >&2
  echo "Get historical sale points for an NFT (chart data)" >&2
  exit 1
fi

chain="$1"
contract="$2"
identifier="$3"

"$(dirname "$0")/../opensea-get.sh" "/api/v2/chain/${chain}/contract/${contract}/nfts/${identifier}/analytics"
