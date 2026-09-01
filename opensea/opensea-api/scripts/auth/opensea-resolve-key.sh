#!/usr/bin/env bash
set -euo pipefail

# Usage: opensea-resolve-key.sh [--force]
#
# Resolves an OpenSea API key using a deterministic, persistent flow so an
# instant key fetched once is reused on every later request instead of being
# re-fetched (or lost):
#
#   1. If OPENSEA_API_KEY is set in the environment, print it and stop.
#      User-supplied keys always win — they are never overwritten or re-fetched.
#   2. Else if a key is cached on disk, print it.
#   3. Else fetch a fresh instant free-tier key, SAVE it to disk (so the next
#      invocation reuses it), then print it.
#
# Prints ONLY the resolved key to stdout. Typical use:
#   export OPENSEA_API_KEY=$(packages/skill/opensea-api/scripts/auth/opensea-resolve-key.sh)
#
# --force  Ignore any cached key on disk and fetch a fresh instant key, then
#          overwrite the cache. Use this when a cached instant key is rejected
#          (HTTP 401/403 -> invalid or expired). It does NOT override a key set
#          via the OPENSEA_API_KEY environment variable.
#
# Storage location: ${OPENSEA_CONFIG_DIR:-$HOME/.opensea}/api_key (mode 600).

force=0
if [ "${1:-}" = "--force" ]; then
  force=1
fi

config_dir="${OPENSEA_CONFIG_DIR:-$HOME/.opensea}"
key_file="$config_dir/api_key"

# 1. Environment always wins (preserves the user-supplied-key flow).
if [ -n "${OPENSEA_API_KEY:-}" ]; then
  printf '%s\n' "$OPENSEA_API_KEY"
  exit 0
fi

# 2. Reuse a cached key unless --force was passed.
if [ "$force" -eq 0 ] && [ -s "$key_file" ]; then
  cat "$key_file"
  exit 0
fi

# 3. Fetch a fresh instant key.
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
  echo "opensea-resolve-key.sh: curl transport error (exit $?)" >&2
  exit 1
}

if [[ ! "$http_code" =~ ^2 ]]; then
  if [ "$http_code" = "429" ]; then
    echo "opensea-resolve-key.sh: HTTP 429 rate limited (instant key creation is rate limited per IP). Reuse the cached key if you have one, try again later, or create a key at https://opensea.io/settings/developer" >&2
  else
    echo "opensea-resolve-key.sh: HTTP $http_code error while requesting an instant key" >&2
  fi
  cat "$tmp_body" >&2
  exit 1
fi

api_key=$(jq -r '.api_key // empty' "$tmp_body")
if [ -z "$api_key" ]; then
  echo "opensea-resolve-key.sh: response did not contain an api_key" >&2
  cat "$tmp_body" >&2
  exit 1
fi

# Persist for reuse. Best-effort: still print the key even if saving fails so
# the current request can proceed.
if mkdir -p "$config_dir" 2>/dev/null; then
  if (umask 077; printf '%s\n' "$api_key" > "$key_file") 2>/dev/null; then
    chmod 600 "$key_file" 2>/dev/null || true
  else
    echo "opensea-resolve-key.sh: warning: could not write $key_file (key not cached)" >&2
  fi
else
  echo "opensea-resolve-key.sh: warning: could not create $config_dir (key not cached)" >&2
fi

printf '%s\n' "$api_key"
