#!/bin/bash
# rmesh-send-signa.sh — Send a DM via Signa
# Usage: ./rmesh-send-signa.sh <from_private_key> <to_address> <message>
# Note: This signs and sends a wallet-signed DM

set -euo pipefail

SIGNA_BASE="https://www.signaagent.xyz"

FROM_KEY="${1:?Usage: rmesh-send-signa.sh <from_private_key> <to_address> <message>}"
TO_ADDR="${2:?Missing recipient address}"
MESSAGE="${3:?Missing message}"

# Get sender address from private key
FROM_ADDR=$(cast wallet address --private-key "$FROM_KEY" 2>/dev/null)
if [ -z "$FROM_ADDR" ]; then
    echo "❌ Could not derive address from private key"
    exit 1
fi

echo "📤 Sending DM via Signa"
echo "  From: $FROM_ADDR"
echo "  To: $TO_ADDR"
echo "  Message: $MESSAGE"
echo ""

# Build the canonical envelope
TS=$(date +%s)
PREIMAGE="SIGNA agent dm v1
ts:${TS}
from:${FROM_ADDR,,}
to:${TO_ADDR,,}
body:${MESSAGE}"

# Sign the message
SIGNATURE=$(cast wallet sign --private-key "$FROM_KEY" "$PREIMAGE" 2>/dev/null)
if [ -z "$SIGNATURE" ]; then
    echo "❌ Could not sign message"
    exit 1
fi

echo "  Signed: ${SIGNATURE:0:20}..."
echo ""

# Send the DM
RESULT=$(curl -s -X POST "${SIGNA_BASE}/api/agents/${FROM_ADDR}/dm" \
    -H "Content-Type: application/json" \
    -d "{
        \"from\": \"${FROM_ADDR,,}\",
        \"to\": \"${TO_ADDR,,}\",
        \"body\": $(python3 -c "import json; print(json.dumps('$MESSAGE'))"),
        \"ts\": ${TS},
        \"signature\": \"$SIGNATURE\"
    }" 2>/dev/null)

echo "📬 Result:"
echo "$RESULT" | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin), indent=2))" 2>/dev/null || echo "$RESULT"
