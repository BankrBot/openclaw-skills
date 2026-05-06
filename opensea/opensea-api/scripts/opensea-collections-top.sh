#!/usr/bin/env bash
set -euo pipefail

# Usage: opensea-collections-top.sh [sort_by] [limit] [chains] [category] [cursor]
# Example: opensea-collections-top.sh one_day_volume 50 ethereum,base art

sort_by="${1:-one_day_volume}"
limit="${2-}"
chains="${3-}"
category="${4-}"
cursor="${5-}"

query="sort_by=$sort_by"
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

"$(dirname "$0")/opensea-get.sh" "/api/v2/collections/top" "$query"
