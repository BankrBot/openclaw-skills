#!/usr/bin/env bash
# x402-negotiation-sim.sh — Preview how synthetic counterparties react in
# high-stakes scenarios, as priors for x402 service-price negotiation.
#
# Uses the free behavioral-response-library preview. Optional arg 1 filters the
# displayed category (trading|negotiation|social|crisis) client-side.
set -euo pipefail
: "${PSYCHOSYNTH_BASE_URL:=https://psychosynth.vercel.app}"

# Requires curl + a WORKING jq CLI. If jq is missing or broken (e.g. a bun/npm
# 'jq' shim that errors on 'commander'), run the zero-dependency Node version:
#   node <skill-dir>/psychosynth.mjs <command>   (this script does that for you)
command -v curl >/dev/null 2>&1 || { echo "psychosynth: 'curl' CLI not found (apt-get install -y curl | apk add curl | brew install curl)." >&2; exit 127; }
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if ! command -v jq >/dev/null 2>&1 || ! printf '{}' | jq -e . >/dev/null 2>&1; then
  exec node "$SCRIPT_DIR/../psychosynth.mjs" negotiation "$@"
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

CATEGORY="${1:-}"

echo "=== x402 Counterparty Negotiation Simulation ==="
echo "Fetching behavioral responses${CATEGORY:+ (category: $CATEGORY)}..."

RESPONSES=$(curl -sS $CURL_RETRY "$PSYCHOSYNTH_BASE_URL/api/v1/preview/behavioral-response-library")

echo ""
echo "=== Counterparty Reactions ==="
# Record shape: response, reasoning_chain, emotional_arc, confidence,
# scenarios{slug,category,title,description}, profiles{id,mbti_label,decision_style,big_five}
echo "$RESPONSES" | jq -r --arg cat "$CATEGORY" '
  .records[]?
  | select($cat == "" or (.scenarios.category == $cat))
  | "Scenario: \(.scenarios.title // "n/a") [\(.scenarios.category // "")]\n  Counterparty: \(.profiles.mbti_label // "?") / \(.profiles.decision_style // "?")\n  Reaction: \(.response)\n  Reasoning: \(.reasoning_chain)\n  Confidence: \(.confidence)\n---"'

echo "Negotiation simulation complete."
