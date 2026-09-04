#!/usr/bin/env bash
# check-trading-guardrails.sh — Screen a trade setup against cognitive-bias
# models from the (free) cognitive-bias-simulator preview.
set -euo pipefail
: "${PSYCHOSYNTH_BASE_URL:=https://psychosynth.vercel.app}"

# Requires curl + a WORKING jq CLI. If jq is missing or broken (e.g. a bun/npm
# 'jq' shim that errors on 'commander'), run the zero-dependency Node version:
#   node <skill-dir>/psychosynth.mjs <command>   (this script does that for you)
command -v curl >/dev/null 2>&1 || { echo "psychosynth: 'curl' CLI not found (apt-get install -y curl | apk add curl | brew install curl)." >&2; exit 127; }
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if ! command -v jq >/dev/null 2>&1 || ! printf '{}' | jq -e . >/dev/null 2>&1; then
  exec node "$SCRIPT_DIR/../psychosynth.mjs" guardrails "$@"
fi

# Transient-failure tolerance for FREE endpoints: retry twice on network/5xx
# blips so a cold start or a momentary upstream 500 doesn't fail the workflow.
# (--retry-all-errors needs curl >= 7.71; feature-detect so older curls still
# run. Paid X_PAYMENT calls are NEVER retried — replaying a signed EIP-3009
# authorization after an ambiguous failure is unsafe.)
# -f: a failed attempt must emit NO body, otherwise the retried 200 body
# gets concatenated after the 5xx error body and corrupts the jq parse.
CURL_RETRY="-f --retry 2 --retry-delay 1"
curl --help all 2>/dev/null | grep -q -- --retry-all-errors && CURL_RETRY="$CURL_RETRY --retry-all-errors"

SETUP_INFO="${1:-Long position on leverage following a recent price surge}"

echo "=== Trading Guardrails Check ==="
echo "Analyzing trade setup: \"$SETUP_INFO\""
echo "Fetching cognitive bias models from Psychosynth..."

BIASES=$(curl -sS $CURL_RETRY "$PSYCHOSYNTH_BASE_URL/api/v1/preview/cognitive-bias-simulator")

COUNT=$(echo "$BIASES" | jq -r '.count // 0')
if [ "$COUNT" = "0" ]; then
  echo "No bias records returned (check the endpoint/product status)."
  exit 0
fi

echo ""
echo "=== Guardrails Report ($COUNT bias models) ==="
# Fields per record: name, slug, description, examples[], mitigations[]
echo "$BIASES" | jq -r '.records[]? |
  "Bias: \(.name) (\(.slug))\n  What it is: \(.description)\n  Example: \((.examples // [])[0] // "n/a")\n  Guardrail: \((.mitigations // [])[0] // "n/a")\n---"'

echo "Guardrails evaluation finished. Tip: pass your setup as arg 1 for the header."
