#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: opensea-account-collections.sh <address> [limit] [after] [chains]" >&2
  echo "Get collections owned by an account" >&2
  exit 1
fi

address="$1"
limit="${2:-20}"
after="${3:-}"
chains="${4:-}"

query="limit=$limit"
[ -n "$after" ] && query="$query&after=$after"
[ -n "$chains" ] && query="$query&chains=$chains"

"$(dirname "$0")/../opensea-get.sh" "/api/v2/account/${address}/collections" "$query"
