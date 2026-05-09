#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: opensea-post.sh <path> <json_body>" >&2
  echo "Example: opensea-post.sh /api/v2/listings/fulfillment_data '{\"listing\":{...}}'" >&2
  exit 1
fi

path="$1"
body="$2"

if [[ "$path" != /* ]]; then
  echo "opensea-post.sh: path must start with /" >&2
  exit 1
fi
base="${OPENSEA_BASE_URL:-https://api.opensea.io}"
key="${OPENSEA_API_KEY:-}"

if [ -z "$key" ]; then
  echo "OPENSEA_API_KEY is required" >&2
  exit 1
fi

url="$base$path"

tmp_body=$(mktemp)
trap 'rm -f "$tmp_body"' EXIT

http_code=$(curl -sS --connect-timeout 10 --max-time 30 -X POST \
  -H "x-api-key: $key" \
  -H "User-Agent: opensea-skill/1.0" \
  -H "Content-Type: application/json" \
  -d "$body" \
  -w '%{http_code}' \
  -o "$tmp_body" \
  "$url") || {
  echo "opensea-post.sh: curl transport error (exit $?)" >&2
  exit 1
}

if [[ "$http_code" =~ ^2 ]]; then
  cat "$tmp_body"
  exit 0
fi

echo "opensea-post.sh: HTTP $http_code error" >&2
cat "$tmp_body" >&2
exit 1
