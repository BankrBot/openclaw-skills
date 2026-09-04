#!/bin/bash
# Chitin - Verify a certificate's on-chain status
# Usage: ./verify-cert.sh <cert-token-id>
#
# Environment variables:
#   CHITIN_CERTS_API_URL - Certs API base URL (default: https://certs.chitin.id)

set -e

CERTS_URL="${CHITIN_CERTS_API_URL:-https://certs.chitin.id}"
TOKEN_ID="${1:?Usage: verify-cert.sh <cert-token-id>}"

RESPONSE=$(curl -s -w "\n%{http_code}" \
  "${CERTS_URL}/api/v1/certs/${TOKEN_ID}")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
RESULT=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
  STATUS=$(echo "$RESULT" | jq -r '.status // .data.status // "unknown"')

  if [ "$STATUS" = "VERIFIED" ]; then
    echo "=== CERT #${TOKEN_ID}: VERIFIED ===" >&2
  elif [ "$STATUS" = "REVOKED" ]; then
    echo "=== CERT #${TOKEN_ID}: REVOKED ===" >&2
  else
    echo "=== CERT #${TOKEN_ID}: $STATUS ===" >&2
  fi

  echo "$RESULT" | jq .
else
  echo "Error ($HTTP_CODE): $RESULT" >&2
  exit 1
fi
