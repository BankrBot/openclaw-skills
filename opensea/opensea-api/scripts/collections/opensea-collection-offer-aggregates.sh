#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: opensea-collection-offer-aggregates.sh <collection_slug> [limit] [cursor] [sort_direction]" >&2
  echo "Get top offers for a collection grouped by price level" >&2
  exit 1
fi

slug="$1"
limit="${2:-20}"
cursor="${3:-}"
sort_direction="${4:-}"

query="limit=$limit"
if [ -n "$cursor" ]; then
  query="$query&cursor=$cursor"
fi
if [ -n "$sort_direction" ]; then
  query="$query&sort_direction=$sort_direction"
fi

"$(dirname "$0")/../opensea-get.sh" "/api/v2/collections/${slug}/offer_aggregates" "$query"
