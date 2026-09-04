#!/usr/bin/env bash
# simulate-doppler-launch.sh — Simulate retail counterparty resistance against
# Doppler bonding-curve parameters, using synthetic retail personas.
#
# Free mode (default): pulls the robinhood-counterparty-pack PREVIEW (retail
# personas) and uses neuroticism as a loss-aversion proxy — the free preview
# does not expose prospect-theory. Set X_PAYMENT (a signed x402 header) to run
# the PAID query instead and get the real loss-aversion lambda.
set -euo pipefail
: "${PSYCHOSYNTH_BASE_URL:=https://psychosynth.vercel.app}"

# Requires curl + a WORKING jq CLI. If jq is missing or broken (e.g. a bun/npm
# 'jq' shim that errors on 'commander'), run the zero-dependency Node version:
#   node <skill-dir>/psychosynth.mjs <command>   (this script does that for you)
command -v curl >/dev/null 2>&1 || { echo "psychosynth: 'curl' CLI not found (apt-get install -y curl | apk add curl | brew install curl)." >&2; exit 127; }
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if ! command -v jq >/dev/null 2>&1 || ! printf '{}' | jq -e . >/dev/null 2>&1; then
  exec node "$SCRIPT_DIR/../psychosynth.mjs" doppler "$@"
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
PRODUCT="robinhood-counterparty-pack"

echo "=== Doppler Launch Simulation — retail counterparty resistance ==="

if [ -n "${X_PAYMENT:-}" ]; then
  echo "Paid mode: retail personas with prospect-theory posture (loss aversion lambda)."
  DATA=$(curl -sS -H "X-PAYMENT: $X_PAYMENT" "$PSYCHOSYNTH_BASE_URL/api/v1/query/$PRODUCT?lambda_min=2.0&limit=25")
  echo "$DATA" | jq -r '.records[]? | "persona \(.id[0:8]) | \(.mbti_label) \(.decision_style) | loss-aversion lambda=\(.content.prospect_theory.lambda) | neuroticism=\(.big_five.neuroticism)"'
  echo "$DATA" | jq -r '([.records[]?]|length) as $t | ([.records[]? | select(.content.prospect_theory.lambda >= 2.5)]|length) as $h | "High-resistance personas (lambda>=2.5): \($h)/\($t) — these fight the curve on the way down (panic-sell pressure)."'
else
  echo "Free preview mode (neuroticism as loss-aversion proxy; set X_PAYMENT for real lambda)."
  DATA=$(curl -sS $CURL_RETRY "$PSYCHOSYNTH_BASE_URL/api/v1/preview/$PRODUCT")
  echo "Loaded $(echo "$DATA" | jq -r '.count // 0') retail personas."
  echo "$DATA" | jq -r '.records[]? | "persona \(.id[0:8]) | \(.mbti_label) \(.decision_style) | neuroticism=\(.big_five.neuroticism) | \((.tags // []) | join(","))"'
  echo "$DATA" | jq -r '([.records[]?]|length) as $t | ([.records[]? | select(.big_five.neuroticism >= 0.6)]|length) as $h | "High-resistance personas (neuroticism>=0.6): \($h)/\($t) — proxy for panic-sell pressure into the bonding curve."'
fi
echo "Simulation complete."
