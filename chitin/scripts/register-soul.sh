#!/bin/bash
# Chitin - Register a new AI agent soul
# Usage: ./register-soul.sh <agent-name> <description>
#
# Environment variables:
#   CHITIN_API_URL  - API base URL (default: https://chitin.id)
#   CHITIN_API_KEY  - API key for authenticated writes
#   AGENT_TYPE      - Agent type: personal, autonomous, orchestrator (default: personal)
#   SYSTEM_PROMPT   - Agent's system prompt
#   BIO             - Agent bio text
#   WEBSITE         - Agent website URL
#   A2A_ENDPOINT    - A2A agent card URL
#   MCP_ENDPOINT    - MCP endpoint URL

set -e

API_URL="${CHITIN_API_URL:-https://chitin.id}"
AGENT_NAME="${1:?Usage: register-soul.sh <agent-name> <description>}"
DESCRIPTION="${2:-An AI agent}"
AGENT_TYPE="${AGENT_TYPE:-personal}"

echo "=== Chitin Soul Registration ===" >&2
echo "Agent: $AGENT_NAME" >&2
echo "Type: $AGENT_TYPE" >&2
echo "" >&2

# Build services array
SERVICES="[]"
if [ -n "$A2A_ENDPOINT" ] || [ -n "$MCP_ENDPOINT" ]; then
  SERVICES=$(jq -n '[]
    | if env.A2A_ENDPOINT then . + [{"type":"a2a","url":env.A2A_ENDPOINT}] else . end
    | if env.MCP_ENDPOINT then . + [{"type":"mcp","url":env.MCP_ENDPOINT}] else . end')
fi

# Build request body
BODY=$(jq -n \
  --arg name "$AGENT_NAME" \
  --arg desc "$DESCRIPTION" \
  --arg type "$AGENT_TYPE" \
  --arg prompt "${SYSTEM_PROMPT:-}" \
  --arg bio "${BIO:-}" \
  --arg website "${WEBSITE:-}" \
  --argjson services "$SERVICES" \
  '{
    agentName: $name,
    description: $desc,
    agentType: $type,
    publicIdentity: ({
      bio: (if $bio != "" then $bio else $desc end)
    } + (if $website != "" then {contacts: [{type: "website", value: $website}]} else {} end)),
    services: $services
  } + (if $prompt != "" then {systemPrompt: $prompt} else {} end)')

echo "Registering..." >&2

# POST registration
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST "${API_URL}/api/v1/register" \
  -H "Content-Type: application/json" \
  ${CHITIN_API_KEY:+-H "Authorization: Bearer $CHITIN_API_KEY"} \
  -d "$BODY")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
RESULT=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
  CLAIM_URL=$(echo "$RESULT" | jq -r '.claimUrl // .data.claimUrl // empty')
  REG_ID=$(echo "$RESULT" | jq -r '.registrationId // .data.registrationId // empty')

  echo "" >&2
  echo "======================================" >&2
  echo "=== REGISTRATION SUBMITTED! ===" >&2
  echo "======================================" >&2
  echo "" >&2
  echo "Registration ID: $REG_ID" >&2
  echo "Claim URL: $CLAIM_URL" >&2
  echo "" >&2
  echo "Next: Visit the claim URL to connect your wallet and complete minting." >&2
  echo "" >&2

  echo "$RESULT"
else
  echo "Error ($HTTP_CODE): $RESULT" >&2
  exit 1
fi
