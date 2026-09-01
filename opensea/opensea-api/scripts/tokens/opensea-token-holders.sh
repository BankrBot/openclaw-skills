#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: opensea-token-holders.sh <chain> <address> [limit] [cursor] [sort_by] [sort_direction]" >&2
  echo "Get paginated holders for a token, with aggregate distribution health (STRONG | HEALTHY | CONCERNING | BAD)" >&2
  exit 1
fi

chain="$1"
address="$2"
limit="${3:-20}"
cursor="${4:-}"
sort_by="${5:-}"
sort_direction="${6:-}"

query="limit=$limit"
if [ -n "$cursor" ]; then
  query="$query&cursor=$cursor"
fi
if [ -n "$sort_by" ]; then
  query="$query&sort_by=$sort_by"
fi
if [ -n "$sort_direction" ]; then
  query="$query&sort_direction=$sort_direction"
fi

"$(dirname "$0")/../opensea-get.sh" "/api/v2/chain/${chain}/token/${address}/holders" "$query"
