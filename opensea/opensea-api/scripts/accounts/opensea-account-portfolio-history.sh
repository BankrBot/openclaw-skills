#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: opensea-account-portfolio-history.sh <address> [timeframe]" >&2
  echo "Get portfolio net-worth history. Timeframes: HOUR, DAY, WEEK, MONTH" >&2
  exit 1
fi

address="$1"
timeframe="${2:-}"

query=""
if [ -n "$timeframe" ]; then
  query="timeframe=$timeframe"
fi

"$(dirname "$0")/../opensea-get.sh" "/api/v2/account/${address}/portfolio/history" "$query"
