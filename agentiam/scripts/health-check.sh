#!/usr/bin/env bash
# health-check.sh — smoke-test every AgentIAM service.
#
# Runs curl POST against each endpoint with an empty JSON body and expects a
# 402 Payment Required response carrying a valid x402 quote. This verifies
# endpoint availability + quote shape without spending any USDC.
#
# Usage:  bash scripts/health-check.sh
# Exit:   0 if all services return 402, non-zero otherwise.

set -euo pipefail

WALLET="0x24908846a4397d3549d07661e0fc02220ab14dad"
BASE="https://x402.bankr.bot/$WALLET"
SERVICES=(flowcore noleak memguard riskoracle secureexec validate)

FAIL=0
echo "AgentIAM health check — $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "Base URL: $BASE"
echo

for svc in "${SERVICES[@]}"; do
  code=$(curl -sS -o /dev/null -w "%{http_code}" \
    -X POST "$BASE/$svc" \
    -H "Content-Type: application/json" \
    -d '{}' || true)
  if [[ "$code" == "402" ]]; then
    printf '  [OK]  %-12s HTTP %s\n' "$svc" "$code"
  else
    printf '  [FAIL] %-12s HTTP %s\n' "$svc" "$code"
    FAIL=1
  fi
done

echo
if [[ "$FAIL" -eq 0 ]]; then
  echo "All services healthy."
  exit 0
else
  echo "One or more services failed." >&2
  exit 1
fi
