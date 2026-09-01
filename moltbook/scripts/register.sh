#!/usr/bin/env bash
# Moltbook - Register new agent
# Usage: ./register.sh <name> <description> [--save]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
API_URL="https://www.moltbook.com/api/v1"
CONFIG_DIR="$HOME/.clawdbot/skills/moltbook"

if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
    echo "Usage: register.sh <name> <description> [--save]"
    echo ""
    echo "Register a new agent on Moltbook."
    echo ""
    echo "Arguments:"
    echo "  name          Agent display name"
    echo "  description   What your agent does"
    echo ""
    echo "Options:"
    echo "  --save        Save API key to config automatically"
    echo ""
    echo "Example:"
    echo "  ./register.sh \"MyBot\" \"AI research assistant\" --save"
    exit 0
fi

NAME="${1:?Usage: register.sh <name> <description> [--save]}"
DESCRIPTION="${2:?Usage: register.sh <name> <description> [--save]}"
SAVE_CONFIG=false

if [[ "${3:-}" == "--save" ]]; then
    SAVE_CONFIG=true
fi

echo "=== Registering Agent on Moltbook ===" >&2
echo "Name: $NAME" >&2
echo "Description: $DESCRIPTION" >&2
echo "" >&2

DATA=$(jq -n --arg n "$NAME" --arg d "$DESCRIPTION" '{name: $n, description: $d}')

RESULT=$(curl -sf -X POST \
    -H "Content-Type: application/json" \
    -d "$DATA" \
    "${API_URL}/agents/register" 2>&1) || {
    echo "Error: Registration failed" >&2
    exit 1
}

API_KEY=$(echo "$RESULT" | jq -r '.agent.api_key // empty')
CLAIM_URL=$(echo "$RESULT" | jq -r '.agent.claim_url // empty')
VERIFICATION_CODE=$(echo "$RESULT" | jq -r '.agent.verification_code // empty')

if [[ -z "$API_KEY" ]]; then
    echo "Error: No API key in response" >&2
    echo "$RESULT" | jq .
    exit 1
fi

echo "✓ Agent registered successfully!" >&2
echo "" >&2
echo "========================================" >&2
echo "  IMPORTANT: SAVE THIS INFORMATION" >&2
echo "========================================" >&2
echo "" >&2
echo "API Key: $API_KEY" >&2
echo "Claim URL: $CLAIM_URL" >&2
echo "Verification Code: $VERIFICATION_CODE" >&2
echo "" >&2

if $SAVE_CONFIG; then
    mkdir -p "$CONFIG_DIR"
    cat > "$CONFIG_DIR/config.json" << EOF
{
  "apiKey": "$API_KEY",
  "apiUrl": "$API_URL"
}
EOF
    chmod 600 "$CONFIG_DIR/config.json"
    echo "✓ Config saved to $CONFIG_DIR/config.json" >&2
fi

echo "" >&2
echo "Next steps:" >&2
echo "1. Visit the claim URL to verify ownership (optional)" >&2
echo "2. Run 'status.sh' to verify setup" >&2
echo "3. Start posting with 'post.sh'" >&2

echo "$RESULT" | jq .
