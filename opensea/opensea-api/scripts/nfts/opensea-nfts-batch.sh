#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: opensea-nfts-batch.sh <body_json>" >&2
  echo "Body shape: { \"identifiers\": [ { \"chain\": \"ethereum\", \"contract_address\": \"0x...\", \"token_id\": \"1\" }, ... ] }" >&2
  exit 1
fi

body="$1"

"$(dirname "$0")/../opensea-post.sh" "/api/v2/nfts/batch" "$body"
