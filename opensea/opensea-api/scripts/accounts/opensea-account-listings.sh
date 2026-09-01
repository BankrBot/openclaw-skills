#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: opensea-account-listings.sh <address> [limit] [after] [collection_slugs] [chains] [sort_by] [sort_direction]" >&2
  echo "Get active listings for an account" >&2
  exit 1
fi

address="$1"
limit="${2:-20}"
after="${3:-}"
collection_slugs="${4:-}"
chains="${5:-}"
sort_by="${6:-}"
sort_direction="${7:-}"

query="limit=$limit"
[ -n "$after" ] && query="$query&after=$after"
[ -n "$collection_slugs" ] && query="$query&collection_slugs=$collection_slugs"
[ -n "$chains" ] && query="$query&chains=$chains"
[ -n "$sort_by" ] && query="$query&sort_by=$sort_by"
[ -n "$sort_direction" ] && query="$query&sort_direction=$sort_direction"

"$(dirname "$0")/../opensea-get.sh" "/api/v2/account/${address}/listings" "$query"
