#!/usr/bin/env bash
#
# Aegis sponsorship helper script.
# Usage:
#   AEGIS_URL=... ./aegis-sponsor.sh price                    # Get pricing
#   AEGIS_URL=... ./aegis-sponsor.sh status req_xxx            # Check request status
#   AEGIS_URL=... ./aegis-sponsor.sh stats                     # Queue stats
#   AEGIS_URL=... ./aegis-sponsor.sh cancel req_xxx            # Cancel pending request
#   AEGIS_URL=... ./aegis-sponsor.sh register-protocol         # Register protocol (interactive)
#
# Requires: curl, jq

set -e

AEGIS_URL="${AEGIS_URL:-https://clawgas.vercel.app}"
AEGIS_URL="${AEGIS_URL%/}"

if ! command -v curl &>/dev/null; then
  echo "Error: curl is required" >&2
  exit 1
fi

if ! command -v jq &>/dev/null; then
  echo "Error: jq is required" >&2
  exit 1
fi

cmd="${1:-help}"
arg="$2"

case "$cmd" in
  price)
    echo "=== Aegis Pricing ==="
    curl -sf "$AEGIS_URL/api/agent/price?action=${arg:-TRANSFER}&token=USDC" | jq .
    ;;

  status)
    if [ -z "$arg" ]; then
      echo "Usage: $0 status <requestId>" >&2
      exit 1
    fi
    echo "=== Request Status: $arg ==="
    curl -sf "$AEGIS_URL/api/agent/request-status/$arg" | jq .
    ;;

  stats)
    echo "=== Queue Stats ==="
    curl -sf "$AEGIS_URL/api/agent/request-status/stats" | jq .
    ;;

  cancel)
    if [ -z "$arg" ]; then
      echo "Usage: $0 cancel <requestId>" >&2
      exit 1
    fi
    echo "=== Cancelling: $arg ==="
    curl -sf -X POST "$AEGIS_URL/api/agent/request-status/$arg" \
      -H "Content-Type: application/json" \
      -d '{"action":"cancel"}' | jq .
    ;;

  register-protocol)
    read -p "Protocol ID: " pid
    read -p "Protocol name: " pname
    echo "=== Registering protocol ==="
    curl -sf -X POST "$AEGIS_URL/api/protocol/register" \
      -H "Content-Type: application/json" \
      -d "{\"protocolId\":\"$pid\",\"name\":\"$pname\",\"tier\":\"bronze\"}" | jq .
    ;;

  help|*)
    echo "Aegis sponsorship helper"
    echo ""
    echo "Commands:"
    echo "  price [ACTION]           Get pricing (default: TRANSFER)"
    echo "  status <requestId>       Check request status"
    echo "  stats                    Queue stats"
    echo "  cancel <requestId>       Cancel pending request"
    echo "  register-protocol        Register protocol (interactive)"
    echo ""
    echo "Environment:"
    echo "  AEGIS_URL  Base URL (default: https://clawgas.vercel.app)"
    exit 0
    ;;
esac
