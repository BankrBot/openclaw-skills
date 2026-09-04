#!/usr/bin/env bash
# personalize-app.sh — Turn personality profiles into per-user UX configuration.
#
# Free mode (default): personality-profile-library PREVIEW; the free preview has
# no prospect-theory, so UX tiers key off neuroticism (a loss-aversion proxy).
# Set X_PAYMENT to run the PAID query and key off the real loss-aversion lambda.
set -euo pipefail
: "${PSYCHOSYNTH_BASE_URL:=https://psychosynth.vercel.app}"

# Requires curl + a WORKING jq CLI. If jq is missing or broken (e.g. a bun/npm
# 'jq' shim that errors on 'commander'), run the zero-dependency Node version:
#   node <skill-dir>/psychosynth.mjs <command>   (this script does that for you)
command -v curl >/dev/null 2>&1 || { echo "psychosynth: 'curl' CLI not found (apt-get install -y curl | apk add curl | brew install curl)." >&2; exit 127; }
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if ! command -v jq >/dev/null 2>&1 || ! printf '{}' | jq -e . >/dev/null 2>&1; then
  exec node "$SCRIPT_DIR/../psychosynth.mjs" personalize "$@"
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

echo "=== App Personalization Engine ==="

if [ -n "${X_PAYMENT:-}" ]; then
  echo "Paid mode: tailoring UX from prospect-theory lambda."
  DATA=$(curl -sS -H "X-PAYMENT: $X_PAYMENT" "$PSYCHOSYNTH_BASE_URL/api/v1/query/personality-profile-library?limit=25")
  echo "$DATA" | jq -r '.records[]? | {
    user: .id[0:8], mbti: .mbti_label, loss_aversion_lambda: .content.prospect_theory.lambda,
    ux_config: (if (.content.prospect_theory.lambda > 2.0)
      then { risk_style: "conservative", warning_banner: "high_prominence", signal_style: "detailed_risk" }
      else { risk_style: "aggressive", warning_banner: "subtle", signal_style: "action_oriented" } end)
  }'
else
  echo "Free preview mode (neuroticism as loss-aversion proxy; set X_PAYMENT for real lambda)."
  DATA=$(curl -sS $CURL_RETRY "$PSYCHOSYNTH_BASE_URL/api/v1/preview/personality-profile-library")
  echo "$DATA" | jq -r '.records[]? | {
    user: .id[0:8], mbti: .mbti_label, neuroticism: .big_five.neuroticism,
    ux_config: (if (.big_five.neuroticism > 0.55)
      then { risk_style: "conservative", warning_banner: "high_prominence", signal_style: "detailed_risk" }
      else { risk_style: "aggressive", warning_banner: "subtle", signal_style: "action_oriented" } end)
  }'
fi
echo "Personalization profiles generated."
