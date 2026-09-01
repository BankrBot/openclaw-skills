#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: opensea-drop-deploy-receipt.sh <chain> <tx_hash>" >&2
  echo "Get the receipt of a previously submitted drop-deploy transaction" >&2
  exit 1
fi

chain="$1"
tx_hash="$2"

"$(dirname "$0")/../opensea-get.sh" "/api/v2/drops/deploy/${chain}/${tx_hash}/receipt"
