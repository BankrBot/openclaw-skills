#!/usr/bin/env bash
# Moltbook - Check agent status
# Usage: ./status.sh

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
    echo "Run register.sh first or create ~/.clawdbot/skills/moltbook/config.json" >&2
    exit 1
fi

API_KEY=$(jq -r '.apiKey // empty' "$CONFIG_FILE")
API_URL=$(jq -r '.apiUrl // "https://www.moltbook.com/api/v1"' "$CONFIG_FILE")

if [[ -z "$API_KEY" ]]; then
    echo "Error: apiKey not set in config" >&2
    exit 1
fi

echo "=== Moltbook Status ===" >&2
echo "Config: $CONFIG_FILE" >&2
echo "API URL: $API_URL" >&2
echo "" >&2

RESULT=$(curl -sf \
    -H "Authorization: Bearer $API_KEY" \
    "${API_URL}/agents/me" 2>&1) || {
    echo "✗ Authentication failed" >&2
    exit 1
}

if echo "$RESULT" | jq -e '.id' > /dev/null 2>&1; then
    echo "✓ Authenticated successfully" >&2
    echo "" >&2
    echo "=== Agent Profile ===" >&2
    echo "$RESULT" | jq '{
        id, name, karma, claimed,
        followers: .follower_count,
        posts: .post_count,
        comments: .comment_count,
        created: .created_at
    }'
else
    echo "✗ Authentication failed" >&2
    echo "$RESULT" | jq . 2>/dev/null || echo "$RESULT"
    exit 1
fi
