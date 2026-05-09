#!/usr/bin/env bash
set -euo pipefail

# Usage: opensea-token-groups.sh [limit] [cursor]
# Example: opensea-token-groups.sh 25

limit="${1-}"
cursor="${2-}"

query=""
if [ -n "$limit" ]; then
  query="limit=$limit"
fi
if [ -n "$cursor" ]; then
  if [ -n "$query" ]; then query="$query&"; fi
  query="${query}cursor=$cursor"
fi

"$(dirname "$0")/opensea-get.sh" "/api/v2/token-groups" "$query"
