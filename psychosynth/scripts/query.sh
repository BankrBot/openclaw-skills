#!/usr/bin/env bash
# Paid x402 query. Without X_PAYMENT set, prints the 402 quote (accepts[],
# tiers) so your wallet layer can sign; with X_PAYMENT set, executes the paid
# call.
# Usage: ./query.sh behavioral-response-library "category=trading&limit=20"
set -euo pipefail
: "${PSYCHOSYNTH_BASE_URL:=https://psychosynth.vercel.app}"

# Requires curl + a WORKING jq CLI. If jq is missing or broken (e.g. a bun/npm
# 'jq' shim that errors on 'commander'), run the zero-dependency Node version:
#   node <skill-dir>/psychosynth.mjs <command>   (this script does that for you)
command -v curl >/dev/null 2>&1 || { echo "psychosynth: 'curl' CLI not found (apt-get install -y curl | apk add curl | brew install curl)." >&2; exit 127; }
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if ! command -v jq >/dev/null 2>&1 || ! printf '{}' | jq -e . >/dev/null 2>&1; then
  exec node "$SCRIPT_DIR/../psychosynth.mjs" query "$@"
fi
SLUG="${1:?usage: query.sh <product-slug> [query-string]}"
QS="${2:-}"
URL="$PSYCHOSYNTH_BASE_URL/api/v1/query/$SLUG${QS:+?$QS}"
if [ -n "${X_PAYMENT:-}" ]; then
  curl -sS -H "X-PAYMENT: $X_PAYMENT" "$URL" | jq .
else
  echo "No X_PAYMENT set — fetching the 402 quote:" >&2
  curl -sS "$URL" | jq .
fi
