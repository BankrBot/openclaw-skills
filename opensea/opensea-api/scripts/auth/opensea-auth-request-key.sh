#!/usr/bin/env bash
set -euo pipefail

# Usage: opensea-auth-request-key.sh
# Requests a free-tier OpenSea API key without authentication.
# Rate limited to 3 keys per hour per IP. Keys expire after 30 days.

base="${OPENSEA_BASE_URL:-https://api.opensea.io}"
url="$base/api/v2/auth/keys"

tmp_body=$(mktemp)
trap 'rm -f "$tmp_body"' EXIT

http_code=$(curl -sS --connect-timeout 10 --max-time 30 -X POST \
  -H "User-Agent: opensea-skill/1.0" \
  -H "Content-Type: application/json" \
  -d '{}' \
  -w '%{http_code}' \
  -o "$tmp_body" \
  "$url") || {
  echo "opensea-auth-request-key.sh: curl transport error (exit $?)" >&2
  exit 1
}

if [[ "$http_code" =~ ^2 ]]; then
  cat "$tmp_body"
  exit 0
fi

if [ "$http_code" = "429" ]; then
  echo "opensea-auth-request-key.sh: HTTP 429 rate limited (this endpoint is capped at 3 keys per hour per IP). Try again later or request a key at https://opensea.io/settings/developer" >&2
else
  echo "opensea-auth-request-key.sh: HTTP $http_code error" >&2
fi
cat "$tmp_body" >&2
exit 1
