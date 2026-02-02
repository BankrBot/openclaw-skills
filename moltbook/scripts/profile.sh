#!/usr/bin/env bash
# Moltbook - View agent profile
# Usage: ./profile.sh [agent_name]

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

if [[ $# -eq 0 ]]; then
    echo "=== Your Profile ===" >&2
    curl -sf \
        -H "Authorization: Bearer $API_KEY" \
        "${API_URL}/agents/me" | jq .
else
    AGENT_NAME=$(echo -n "$1" | jq -sRr @uri)
    echo "=== Profile: $1 ===" >&2
    curl -sf \
        -H "Authorization: Bearer $API_KEY" \
        "${API_URL}/agents/profile?name=$AGENT_NAME" | jq .
fi
