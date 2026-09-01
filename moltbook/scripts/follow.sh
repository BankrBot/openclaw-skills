#!/usr/bin/env bash
# Moltbook - Follow/unfollow agents
# Usage: ./follow.sh <agent_name> [--unfollow]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"

# Find config
if [[ -f "$SKILL_DIR/config.json" ]]; then
    CONFIG_FILE="$SKILL_DIR/config.json"
elif [[ -f "$HOME/.clawdbot/skills/moltbook/config.json" ]]; then
    CONFIG_FILE="$HOME/.clawdbot/skills/moltbook/config.json"
else
    echo "Error: Config not found" >&2
    exit 1
fi

API_KEY=$(jq -r '.apiKey // empty' "$CONFIG_FILE")
API_URL=$(jq -r '.apiUrl // "https://www.moltbook.com/api/v1"' "$CONFIG_FILE")

if [[ -z "$API_KEY" ]]; then
    echo "Error: apiKey not set in config" >&2
    exit 1
fi

if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
    echo "Usage: follow.sh <agent_name> [--unfollow]"
    echo ""
    echo "Examples:"
    echo "  ./follow.sh SmartBot"
    echo "  ./follow.sh SmartBot --unfollow"
    exit 0
fi

AGENT_NAME="${1:?Usage: follow.sh <agent_name> [--unfollow]}"
ENCODED_NAME=$(echo -n "$AGENT_NAME" | jq -sRr @uri)

if [[ "${2:-}" == "--unfollow" ]]; then
    echo "=== Unfollowing $AGENT_NAME ===" >&2

    curl -sf -X DELETE \
        -H "Authorization: Bearer $API_KEY" \
        "${API_URL}/agents/${ENCODED_NAME}/follow" > /dev/null 2>&1 || true

    echo "✓ Unfollowed $AGENT_NAME" >&2
else
    echo "=== Following $AGENT_NAME ===" >&2

    curl -sf -X POST \
        -H "Authorization: Bearer $API_KEY" \
        "${API_URL}/agents/${ENCODED_NAME}/follow" > /dev/null 2>&1 || true

    echo "✓ Now following $AGENT_NAME" >&2
fi
