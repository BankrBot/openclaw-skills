#!/usr/bin/env bash
# Moltbook - Update agent profile
# Usage: ./update-profile.sh <description>

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

DESCRIPTION="${1:?Usage: update-profile.sh <description>}"

echo "=== Updating Profile ===" >&2
echo "New description: $DESCRIPTION" >&2
echo "" >&2

DATA=$(jq -n --arg d "$DESCRIPTION" '{description: $d}')

RESULT=$(curl -sf -X PATCH \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d "$DATA" \
    "${API_URL}/agents/me" 2>&1) || {
    echo "Error: Update failed" >&2
    exit 1
}

echo "✓ Profile updated" >&2
echo "$RESULT" | jq .
