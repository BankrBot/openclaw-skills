#!/bin/bash
# ENS Agent Identity - Register a Bankr agent and set text records via NameStone
# Usage: ./set-agent-records.sh <agent-name> <agent-type> <capabilities> [address]
# Example: ./set-agent-records.sh alpha-go trading-bot "swap,bridge,limit-order"

set -e

AGENT_NAME="${1:?Usage: set-agent-records.sh <agent-name> <agent-type> <capabilities> [address]}"
AGENT_TYPE="${2:?Usage: set-agent-records.sh <agent-name> <agent-type> <capabilities> [address]}"
CAPABILITIES="${3:?Usage: set-agent-records.sh <agent-name> <agent-type> <capabilities> [address]}"
ADDRESS="${4:-}"
DOMAIN="${BANKR_ENS_DOMAIN:-bankr.eth}"

# Require NameStone API key
if [ -z "$NAMESTONE_API_KEY" ]; then
  echo "Error: NAMESTONE_API_KEY environment variable not set" >&2
  echo "Get your API key at https://namestone.com" >&2
  exit 1
fi

# Resolve address from Bankr CLI if none provided
if [ -z "$ADDRESS" ]; then
  if ! command -v bankr >/dev/null 2>&1; then
    echo "Bankr CLI not found. Provide an address or install with: bun install -g @bankr/cli" >&2
    exit 1
  fi
  echo "Resolving wallet address from Bankr..." >&2
  ADDRESS=$(bankr prompt "What is my wallet address?" 2>/dev/null | grep -oE '0x[a-fA-F0-9]{40}' | head -1)
  if [ -z "$ADDRESS" ]; then
    echo "Error: Could not resolve wallet address from Bankr" >&2
    exit 1
  fi
fi

echo "=== ENS Agent Identity Setup ===" >&2
echo "Name: ${AGENT_NAME}.${DOMAIN}" >&2
echo "Type: $AGENT_TYPE" >&2
echo "Capabilities: $CAPABILITIES" >&2
echo "Address: $ADDRESS" >&2
echo "" >&2

# Build the full NameStone request body in a single Node.js call.
# All user input is passed via environment variables to prevent injection.
echo "Step 1: Registering subname via NameStone..." >&2

REQUEST_BODY=$(\
  AGENT_NAME="$AGENT_NAME" \
  DOMAIN="$DOMAIN" \
  ADDRESS="$ADDRESS" \
  AGENT_TYPE="$AGENT_TYPE" \
  CAPABILITIES="$CAPABILITIES" \
  AGENT_CHAINS="${AGENT_CHAINS:-base}" \
  AGENT_VERSION="${AGENT_VERSION}" \
  AGENT_CREATOR="${AGENT_CREATOR}" \
  AGENT_A2A="${AGENT_A2A}" \
  AGENT_TOKEN="${AGENT_TOKEN}" \
  AGENT_DELEGATION="${AGENT_DELEGATION}" \
  AGENT_MODE="${AGENT_MODE}" \
  AGENT_POLICY="${AGENT_POLICY}" \
  AGENT_CHAIN_ID="${AGENT_CHAIN_ID}" \
  node -e "
const records = {
  'agent:type': process.env.AGENT_TYPE,
  'agent:capabilities': process.env.CAPABILITIES,
  'agent:chains': process.env.AGENT_CHAINS,
};

const optional = {
  'agent:version': process.env.AGENT_VERSION,
  'agent:creator': process.env.AGENT_CREATOR,
  'agent:a2a': process.env.AGENT_A2A,
  'agent:token': process.env.AGENT_TOKEN,
  'agent:delegation': process.env.AGENT_DELEGATION,
  'agent:mode': process.env.AGENT_MODE,
  'agent:policy': process.env.AGENT_POLICY,
  'agent:chainId': process.env.AGENT_CHAIN_ID,
};

for (const [key, value] of Object.entries(optional)) {
  if (value) records[key] = value;
}

console.log(JSON.stringify({
  name: process.env.AGENT_NAME,
  domain: process.env.DOMAIN,
  address: process.env.ADDRESS,
  text_records: records,
}));
")

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "https://namestone.com/api/public_v1/set-name" \
  -H "Authorization: $NAMESTONE_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$REQUEST_BODY")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -lt 200 ] || [ "$HTTP_CODE" -ge 300 ]; then
  echo "Error (HTTP $HTTP_CODE): $BODY" >&2
  exit 1
fi

echo "Subname registered successfully." >&2

# Step 2: Verify resolution
echo "" >&2
echo "Step 2: Verifying resolution..." >&2
sleep 2

# URL-encode name and domain in a single Node.js call
ENCODED=$(AGENT_NAME="$AGENT_NAME" DOMAIN="$DOMAIN" node -e "
  console.log(encodeURIComponent(process.env.AGENT_NAME));
  console.log(encodeURIComponent(process.env.DOMAIN));
")
ENCODED_NAME=$(echo "$ENCODED" | head -1)
ENCODED_DOMAIN=$(echo "$ENCODED" | tail -1)

VERIFY_RESPONSE=$(curl -s "https://namestone.com/api/public_v1/get-names?domain=${ENCODED_DOMAIN}&name=${ENCODED_NAME}" \
  -H "Authorization: $NAMESTONE_API_KEY")

RESOLVED_ADDR=$(echo "$VERIFY_RESPONSE" | node -e "
  const data = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
  if (Array.isArray(data) && data.length > 0) {
    console.log(data[0].address || '');
  }
" 2>/dev/null || echo "")

# Emit final result as JSON (all values passed via env vars)
emit_result() {
  AGENT_NAME="$AGENT_NAME" DOMAIN="$DOMAIN" ADDRESS="$1" \
    AGENT_TYPE="$AGENT_TYPE" CAPABILITIES="$CAPABILITIES" VERIFIED="$2" \
    node -e "
      const o = {
        success: true,
        name: process.env.AGENT_NAME + '.' + process.env.DOMAIN,
        address: process.env.ADDRESS,
      };
      if (process.env.VERIFIED === 'true') {
        o.type = process.env.AGENT_TYPE;
        o.capabilities = process.env.CAPABILITIES;
      } else {
        o.verified = false;
      }
      console.log(JSON.stringify(o));
    "
}

if [ -n "$RESOLVED_ADDR" ]; then
  echo "Resolved: ${AGENT_NAME}.${DOMAIN} -> $RESOLVED_ADDR" >&2
  echo "" >&2
  echo "======================================" >&2
  echo "=== AGENT IDENTITY REGISTERED ===" >&2
  echo "======================================" >&2
  echo "" >&2
  echo "ENS Name: ${AGENT_NAME}.${DOMAIN}" >&2
  echo "Address:  $RESOLVED_ADDR" >&2
  echo "Type:     $AGENT_TYPE" >&2
  echo "" >&2
  echo "Resolve with: viem getEnsText('${AGENT_NAME}.${DOMAIN}', 'agent:type')" >&2
  echo "" >&2
  emit_result "$RESOLVED_ADDR" "true"
else
  echo "Warning: Could not verify resolution immediately. It may take a moment to propagate." >&2
  emit_result "$ADDRESS" "false"
fi
