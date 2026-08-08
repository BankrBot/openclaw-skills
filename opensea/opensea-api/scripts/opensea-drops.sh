#!/usr/bin/env bash
set -euo pipefail

# Usage: opensea-drops.sh [type] [limit] [chains] [cursor]
# Example: opensea-drops.sh featured 20 ethereum,base

type="${1:-featured}"
limit="${2-}"
chains="${3-}"
cursor="${4-}"

query="type=$type"
if [ -n "$limit" ]; then
  query="$query&limit=$limit"
fi
if [ -n "$chains" ]; then
  query="$query&chains=$chains"
fi
if [ -n "$cursor" ]; then
  query="$query&cursor=$cursor"
fi

"$(dirname "$0")/opensea-get.sh" "/api/v2/drops" "$query"
