#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: opensea-get.sh <path> [query]" >&2
  echo "Example: opensea-get.sh /api/v2/collections/cool-cats-nft" >&2
  exit 1
fi

path="$1"
query="${2-}"

if [[ "$path" != /* ]]; then
  echo "opensea-get.sh: path must start with /" >&2
  exit 1
fi
base="${OPENSEA_BASE_URL:-https://api.opensea.io}"
key="${OPENSEA_API_KEY:-}"

if [ -z "$key" ]; then
  echo "OPENSEA_API_KEY is required" >&2
  exit 1
fi

url="$base$path"
if [ -n "$query" ]; then
  url="$url?$query"
fi

tmp_body=$(mktemp)
trap 'rm -f "$tmp_body"' EXIT

max_attempts=3
base_delay=2

for (( attempt=1; attempt<=max_attempts; attempt++ )); do
  http_code=$(curl -sS --connect-timeout 10 --max-time 30 \
    -H "x-api-key: $key" \
    -H "User-Agent: opensea-skill/1.0" \
    -w '%{http_code}' \
    -o "$tmp_body" \
    "$url") || {
    echo "opensea-get.sh: curl transport error (exit $?)" >&2
    exit 1
  }

  if [[ "$http_code" =~ ^2 ]]; then
    cat "$tmp_body"
    exit 0
  fi

  if [ "$http_code" = "429" ] && [ "$attempt" -lt "$max_attempts" ]; then
    delay=$(( base_delay * (1 << (attempt - 1)) ))
    echo "opensea-get.sh: 429 rate limited, retrying in ${delay}s (attempt $attempt/$max_attempts)" >&2
    sleep "$delay"
    continue
  fi

  echo "opensea-get.sh: HTTP $http_code error" >&2
  cat "$tmp_body" >&2
  exit 1
done
