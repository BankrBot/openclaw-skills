#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 6 ]; then
  echo "Usage: opensea-drop-deploy.sh <chain> <contract_name> <contract_symbol> <drop_type> <token_type> <sender>" >&2
  echo "Returns ready-to-sign transaction data for deploying a new drop contract" >&2
  echo "Example: opensea-drop-deploy.sh ethereum 'My NFT Collection' MNFT seadrop_v1_erc721 erc721_standard 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" >&2
  exit 1
fi

chain="$1"
name="$2"
symbol="$3"
drop_type="$4"
token_type="$5"
sender="$6"

# Validate Ethereum address
if [[ ! "$sender" =~ ^0x[0-9a-fA-F]{40}$ ]]; then
  echo "opensea-drop-deploy.sh: sender must be a valid Ethereum address" >&2
  exit 1
fi

body=$(cat <<EOF
{
  "chain": "$chain",
  "contract_name": "$name",
  "contract_symbol": "$symbol",
  "drop_type": "$drop_type",
  "token_type": "$token_type",
  "sender": "$sender"
}
EOF
)

"$(dirname "$0")/../opensea-post.sh" "/api/v2/drops/deploy" "$body"
