#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: opensea-collection-holders.sh <collection_slug> [limit] [cursor] [sort_direction] [owned_by]" >&2
  echo "Get holders of a collection ranked by quantity owned" >&2
  exit 1
fi

slug="$1"
limit="${2:-20}"
cursor="${3:-}"
sort_direction="${4:-}"
owned_by="${5:-}"

query="limit=$limit"
if [ -n "$cursor" ]; then
  query="$query&cursor=$cursor"
fi
if [ -n "$sort_direction" ]; then
  query="$query&sort_direction=$sort_direction"
fi
if [ -n "$owned_by" ]; then
  query="$query&owned_by=$owned_by"
fi

"$(dirname "$0")/../opensea-get.sh" "/api/v2/collections/${slug}/holders" "$query"
