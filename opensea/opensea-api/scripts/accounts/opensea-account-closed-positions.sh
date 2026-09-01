#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: opensea-account-closed-positions.sh <address> [limit] [sort_by] [next]" >&2
  echo "Get closed (realized) trading positions for a wallet" >&2
  exit 1
fi

address="$1"
limit="${2:-20}"
sort_by="${3:-}"
next="${4:-}"

query="limit=$limit"
[ -n "$sort_by" ] && query="$query&sort_by=$sort_by"
[ -n "$next" ] && query="$query&next=$next"

"$(dirname "$0")/../opensea-get.sh" "/api/v2/account/${address}/pnl/closed-positions" "$query"
