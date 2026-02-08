#!/usr/bin/env bash
#
# Aegis health check script.
# Usage: AEGIS_URL=https://clawgas.vercel.app ./aegis-health.sh
# Or:   ./aegis-health.sh https://clawgas.vercel.app
#
# Requires: curl, jq

set -e

AEGIS_URL="${1:-${AEGIS_URL:-https://clawgas.vercel.app}}"
AEGIS_URL="${AEGIS_URL%/}"

if ! command -v curl &>/dev/null; then
  echo "Error: curl is required" >&2
  exit 1
fi

if ! command -v jq &>/dev/null; then
  echo "Error: jq is required" >&2
  exit 1
fi

echo "=== Aegis Health Check ==="
echo "URL: $AEGIS_URL"
echo ""

echo "--- /api/health ---"
curl -sf "$AEGIS_URL/api/health" | jq '{
  status,
  ethBalance,
  usdcBalance,
  runwayDays,
  sponsorshipsLast24h,
  emergencyMode,
  lastUpdated
}'
echo ""

echo "--- /api/agent/price (TRANSFER) ---"
curl -sf "$AEGIS_URL/api/agent/price?action=TRANSFER&token=USDC" | jq '{
  price,
  currency,
  action,
  validFor,
  breakdown
}'
echo ""

echo "--- /.well-known/agent-card.json ---"
curl -sf "$AEGIS_URL/.well-known/agent-card.json" | jq '{
  name,
  description,
  version,
  capabilities,
  endpoints
}'
echo ""

echo "--- /api/agent/request-status/stats ---"
curl -sf "$AEGIS_URL/api/agent/request-status/stats" | jq .
echo ""

echo "Done."
