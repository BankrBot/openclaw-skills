#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: opensea-collections-batch.sh <slug1,slug2,...> | <body_json>" >&2
  echo "If the argument doesn't start with '{', it's treated as a comma-separated slug list" >&2
  exit 1
fi

input="$1"

if [[ "$input" == \{* ]]; then
  body="$input"
else
  IFS=',' read -ra slugs <<<"$input"
  arr=""
  for s in "${slugs[@]}"; do
    if [ -n "$arr" ]; then arr="$arr, "; fi
    arr="$arr\"$s\""
  done
  body="{\"slugs\":[$arr]}"
fi

"$(dirname "$0")/../opensea-post.sh" "/api/v2/collections/batch" "$body"
