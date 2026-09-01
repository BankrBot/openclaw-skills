#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: opensea-listings-actions.sh <body_json>" >&2
  echo "Returns ordered approval + sign actions needed to create one or more listings." >&2
  echo "Body shape: { \"address\": \"0x...\", \"items\": [ { \"chain\": ..., \"contract\": ..., \"token_id\": ..., \"quantity\": ..., \"price\": {...} } ], \"use_creator_fee\": true, \"taker\": \"0x...\" }" >&2
  exit 1
fi

body="$1"

"$(dirname "$0")/../opensea-post.sh" "/api/v2/listings/actions" "$body"
