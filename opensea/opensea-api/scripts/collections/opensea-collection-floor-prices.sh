#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: opensea-collection-floor-prices.sh <collection_slug> [timeframe] [resolution]" >&2
  echo "Get floor price history for a collection" >&2
  echo "Timeframes: one_minute, five_minutes, fifteen_minutes, one_hour, one_day, seven_days, thirty_days, one_year, all_time" >&2
  exit 1
fi

slug="$1"
timeframe="${2:-}"
resolution="${3:-}"

query=""
if [ -n "$timeframe" ]; then
  query="timeframe=$timeframe"
fi
if [ -n "$resolution" ]; then
  if [ -n "$query" ]; then query="$query&"; fi
  query="${query}resolution=$resolution"
fi

"$(dirname "$0")/../opensea-get.sh" "/api/v2/collections/${slug}/floor_prices" "$query"
