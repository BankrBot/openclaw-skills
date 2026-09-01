#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 3 ]; then
  echo "Usage: opensea-token-price-history.sh <chain> <address> <start_time> [end_time] [bucket_size]" >&2
  echo "start_time/end_time are ISO 8601. bucket_size: 1s, 1m, 5m, 15m, 1h, 4h, 1d" >&2
  exit 1
fi

chain="$1"
address="$2"
start_time="$3"
end_time="${4:-}"
bucket_size="${5:-}"

query="start_time=$start_time"
if [ -n "$end_time" ]; then
  query="$query&end_time=$end_time"
fi
if [ -n "$bucket_size" ]; then
  query="$query&bucket_size=$bucket_size"
fi

"$(dirname "$0")/../opensea-get.sh" "/api/v2/chain/${chain}/token/${address}/price_history" "$query"
