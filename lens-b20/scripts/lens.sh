#!/usr/bin/env bash
#
# LENS B20 skill — thin wrapper around the public LENS API on Base.
# Read-only by default. No authentication required.
#
# Usage:
#   scripts/lens.sh info
#   scripts/lens.sh gas
#   scripts/lens.sh balance    '{"address":"0x..."}'
#   scripts/lens.sh token_info '{"address":"0x..."}'
#   scripts/lens.sh validate   '{"name":"LENS","symbol":"LENS","variant":"asset","decimals":18,"admin":"0x..."}'
#   scripts/lens.sh prepare    '{"name":"LENS","symbol":"LENS","supply_cap":"1000000000","admin":"0x...","network":"mainnet"}'
#   scripts/lens.sh receipt    '{"tx_hash":"0x...","network":"mainnet"}'
#
# Endpoint can be overridden with LENS_B20_ENDPOINT.
#
set -euo pipefail

ENDPOINT="${LENS_B20_ENDPOINT:-https://lens-liard.vercel.app/api/b20-skill}"
ACTION="${1:-info}"
PAYLOAD="${2:-}"

usage() {
  echo "usage: lens.sh <action> [json]" >&2
  echo "actions: info gas balance token_info validate prepare receipt manifest" >&2
}

case "$ACTION" in
  -h|--help|help)
    usage; exit 0 ;;

  info|gas|manifest)
    curl -fsS "${ENDPOINT}?action=${ACTION}"
    echo ;;

  balance|token_info|validate|prepare|receipt)
    PAYLOAD="${PAYLOAD:-{}}"
    if command -v jq >/dev/null 2>&1; then
      BODY=$(printf '%s' "$PAYLOAD" | jq -c --arg a "$ACTION" '. + {action:$a}')
    else
      INNER=$(printf '%s' "$PAYLOAD" | sed -e 's/^[[:space:]]*{//' -e 's/}[[:space:]]*$//')
      if [ -n "$(printf '%s' "$INNER" | tr -d '[:space:]')" ]; then
        BODY="{\"action\":\"${ACTION}\",${INNER}}"
      else
        BODY="{\"action\":\"${ACTION}\"}"
      fi
    fi
    curl -fsS -X POST "$ENDPOINT" -H 'Content-Type: application/json' -d "$BODY"
    echo ;;

  *)
    echo "unknown action: $ACTION" >&2
    usage
    exit 1 ;;
esac
