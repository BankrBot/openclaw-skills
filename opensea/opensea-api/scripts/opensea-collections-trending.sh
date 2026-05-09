#!/usr/bin/env bash
set -euo pipefail

# Usage: opensea-collections-trending.sh [timeframe] [limit] [chains] [category] [cursor]
# Example: opensea-collections-trending.sh one_day 20 ethereum,base pfps

timeframe="${1:-one_day}"
limit="${2-}"
chains="${3-}"
category="${4-}"
cursor="${5-}"

query="timeframe=$timeframe"
if [ -n "$limit" ]; then
  query="$query&limit=$limit"
fi
if [ -n "$chains" ]; then
  query="$query&chains=$chains"
fi
if [ -n "$category" ]; then
  query="$query&category=$category"
fi
if [ -n "$cursor" ]; then
  query="$query&cursor=$cursor"
fi

"$(dirname "$0")/opensea-get.sh" "/api/v2/collections/trending" "$query"
