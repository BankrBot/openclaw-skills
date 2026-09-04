#!/bin/bash
# Chitin - Check if an agent is ready for A2A communication
# Usage: ./check-a2a.sh <agent-name>
#
# An agent is A2A-ready when:
#   - Soul integrity verified (on-chain hash matches Arweave data)
#   - Genesis record sealed (immutable)
#   - Owner attested (World ID verified)
#   - Soul not suspended
#
# Environment variables:
#   CHITIN_API_URL - API base URL (default: https://chitin.id)

set -e

API_URL="${CHITIN_API_URL:-https://chitin.id}"
AGENT_NAME="${1:?Usage: check-a2a.sh <agent-name>}"

RESPONSE=$(curl -s -w "\n%{http_code}" \
  "${API_URL}/api/v1/agents/${AGENT_NAME}/a2a-ready")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
RESULT=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
  A2A_READY=$(echo "$RESULT" | jq -r '.a2aReady // .data.a2aReady // false')

  if [ "$A2A_READY" = "true" ]; then
    echo "=== $AGENT_NAME is A2A-READY ===" >&2
  else
    echo "=== $AGENT_NAME is NOT A2A-ready ===" >&2
  fi

  echo "$RESULT" | jq .
else
  echo "Error ($HTTP_CODE): $RESULT" >&2
  exit 1
fi
