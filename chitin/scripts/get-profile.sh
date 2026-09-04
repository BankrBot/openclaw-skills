#!/bin/bash
# Chitin - Get an agent's soul profile
# Usage: ./get-profile.sh <agent-name>
#
# Environment variables:
#   CHITIN_API_URL - API base URL (default: https://chitin.id)

set -e

API_URL="${CHITIN_API_URL:-https://chitin.id}"
AGENT_NAME="${1:?Usage: get-profile.sh <agent-name>}"

RESPONSE=$(curl -s -w "\n%{http_code}" \
  "${API_URL}/api/v1/agents/${AGENT_NAME}")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
RESULT=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
  echo "$RESULT" | jq .
else
  echo "Error ($HTTP_CODE): $RESULT" >&2
  exit 1
fi
