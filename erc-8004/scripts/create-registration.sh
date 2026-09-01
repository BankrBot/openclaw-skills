#!/bin/bash
# ERC-8004 - Create agent registration JSON file
# Usage: ./create-registration.sh [output-file]
#
# Environment variables:
#   AGENT_NAME        - Agent display name (default: "AI Agent")
#   AGENT_DESCRIPTION - Agent description
#   AGENT_IMAGE       - Avatar URL
#   AGENT_WEBSITE     - Agent website
#   AGENT_A2A_ENDPOINT - A2A agent card URL
#   AGENT_MCP_ENDPOINT - MCP server endpoint
#   AGENT_ENS         - ENS name
#   X402_SUPPORT      - Enable x402 payments (true/false, default: false)

set -euo pipefail

OUTPUT_FILE="${1:-/tmp/agent-registration.json}"

# Defaults
NAME="${AGENT_NAME:-AI Agent}"
DESCRIPTION="${AGENT_DESCRIPTION:-An autonomous AI agent registered on ERC-8004}"
IMAGE="${AGENT_IMAGE:-}"
WEBSITE="${AGENT_WEBSITE:-}"
A2A_ENDPOINT="${AGENT_A2A_ENDPOINT:-}"
MCP_ENDPOINT="${AGENT_MCP_ENDPOINT:-}"
ENS="${AGENT_ENS:-}"
X402="${X402_SUPPORT:-false}"

# Validate X402 value
if [[ "$X402" != "true" && "$X402" != "false" ]]; then
  echo "Error: X402_SUPPORT must be 'true' or 'false'" >&2
  exit 1
fi

echo "=== Creating Registration File ===" >&2
echo "Name: $NAME" >&2
echo "Description: $DESCRIPTION" >&2
echo "Output: $OUTPUT_FILE" >&2

# Build services array safely using jq — no shell injection risk
SERVICES="[]"

if [ -n "$WEBSITE" ]; then
  SERVICES=$(jq -n --argjson arr "$SERVICES" --arg url "$WEBSITE" \
    '$arr + [{"name": "web", "endpoint": $url}]')
fi

if [ -n "$A2A_ENDPOINT" ]; then
  SERVICES=$(jq -n --argjson arr "$SERVICES" --arg url "$A2A_ENDPOINT" \
    '$arr + [{"name": "A2A", "endpoint": $url, "version": "0.3.0"}]')
fi

if [ -n "$MCP_ENDPOINT" ]; then
  SERVICES=$(jq -n --argjson arr "$SERVICES" --arg url "$MCP_ENDPOINT" \
    '$arr + [{"name": "MCP", "endpoint": $url, "version": "2025-06-18"}]')
fi

if [ -n "$ENS" ]; then
  SERVICES=$(jq -n --argjson arr "$SERVICES" --arg ens "$ENS" \
    '$arr + [{"name": "ENS", "endpoint": $ens, "version": "v1"}]')
fi

# Build the full JSON safely using jq — never raw string interpolation
jq -n \
  --arg type "https://eips.ethereum.org/EIPS/eip-8004#registration-v1" \
  --arg name "$NAME" \
  --arg description "$DESCRIPTION" \
  --arg image "$IMAGE" \
  --argjson services "$SERVICES" \
  --argjson x402 "$X402" \
  '{
    "type": $type,
    "name": $name,
    "description": $description,
    "image": $image,
    "services": $services,
    "x402Support": $x402,
    "active": true,
    "registrations": [],
    "supportedTrust": ["reputation"]
  }' > "$OUTPUT_FILE"

echo "=== SUCCESS ===" >&2
echo "Created: $OUTPUT_FILE" >&2
cat "$OUTPUT_FILE" >&2

echo "$OUTPUT_FILE"
