#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: opensea-account-favorites.sh <address> [limit] [after] [sort_by] [sort_direction] [chains]" >&2
  echo "Get items favorited by an account" >&2
  exit 1
fi

address="$1"
limit="${2:-20}"
after="${3:-}"
sort_by="${4:-}"
sort_direction="${5:-}"
chains="${6:-}"

query="limit=$limit"
[ -n "$after" ] && query="$query&after=$after"
[ -n "$sort_by" ] && query="$query&sort_by=$sort_by"
[ -n "$sort_direction" ] && query="$query&sort_direction=$sort_direction"
[ -n "$chains" ] && query="$query&chains=$chains"

"$(dirname "$0")/../opensea-get.sh" "/api/v2/account/${address}/favorites" "$query"
