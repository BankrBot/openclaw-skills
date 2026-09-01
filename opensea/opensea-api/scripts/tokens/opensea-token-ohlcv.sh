#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 4 ]; then
  echo "Usage: opensea-token-ohlcv.sh <chain> <address> <start_time> <bucket_size> [end_time] [fill_time_window]" >&2
  echo "Returns OHLCV candles. bucket_size: 1s, 1m, 5m, 15m, 1h, 4h, 1d" >&2
  exit 1
fi

chain="$1"
address="$2"
start_time="$3"
bucket_size="$4"
end_time="${5:-}"
fill_time_window="${6:-}"

query="start_time=$start_time&bucket_size=$bucket_size"
if [ -n "$end_time" ]; then
  query="$query&end_time=$end_time"
fi
if [ -n "$fill_time_window" ]; then
  query="$query&fill_time_window=$fill_time_window"
fi

"$(dirname "$0")/../opensea-get.sh" "/api/v2/chain/${chain}/token/${address}/ohlcv" "$query"
