#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: opensea-token-activity.sh <chain> <address> [limit] [cursor]" >&2
  echo "Get recent swap activity for a token (max limit 50)" >&2
  exit 1
fi

chain="$1"
address="$2"
limit="${3:-20}"
cursor="${4:-}"

query="limit=$limit"
if [ -n "$cursor" ]; then
  query="$query&cursor=$cursor"
fi

"$(dirname "$0")/../opensea-get.sh" "/api/v2/chain/${chain}/token/${address}/activity" "$query"
