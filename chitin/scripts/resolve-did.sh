#!/bin/bash
# Chitin - Resolve an agent's W3C DID Document
# Usage: ./resolve-did.sh <agent-name>
#   or:  ./resolve-did.sh did:chitin:8453:<agent-name>
#
# Environment variables:
#   CHITIN_API_URL - API base URL (default: https://chitin.id)

set -e

API_URL="${CHITIN_API_URL:-https://chitin.id}"
INPUT="${1:?Usage: resolve-did.sh <agent-name-or-did>}"

# Extract agent name from DID if full DID is provided
AGENT_NAME=$(echo "$INPUT" | sed 's|^did:chitin:8453:||')

RESPONSE=$(curl -s -w "\n%{http_code}" \
  "${API_URL}/api/v1/agents/${AGENT_NAME}/did")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
RESULT=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
  echo "$RESULT" | jq .
else
  echo "Error ($HTTP_CODE): $RESULT" >&2
  exit 1
fi
