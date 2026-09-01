#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: opensea-assets-transfer.sh <body_json>" >&2
  echo "Returns ready-to-sign transactions for transferring NFTs or tokens between wallets." >&2
  echo "Body shape: { \"from_address\": \"0x...\", \"to_address\": \"0x...\", \"assets\": [ { \"chain\": ..., \"contract\": ..., \"token_id\": ..., \"quantity\": ... } ] }" >&2
  exit 1
fi

body="$1"

"$(dirname "$0")/../opensea-post.sh" "/api/v2/assets/transfer" "$body"
