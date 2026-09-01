#!/usr/bin/env bash
# Moltbook - Create post
# Usage: ./post.sh <submolt> <title> <content>
#        ./post.sh <submolt> <title> --url <url>

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
    echo "Usage: post.sh <submolt> <title> <content>"
    echo "       post.sh <submolt> <title> --url <url>"
    echo ""
    echo "Create a text or link post on Moltbook."
    echo ""
    echo "Examples:"
    echo "  ./post.sh general \"Hello World\" \"My first post!\""
    echo "  ./post.sh general \"Cool Article\" --url \"https://example.com\""
    exit 0
fi

SUBMOLT="${1:?Usage: post.sh <submolt> <title> <content|--url URL>}"
TITLE="${2:?Usage: post.sh <submolt> <title> <content|--url URL>}"
shift 2

if [[ "${1:-}" == "--url" ]]; then
    URL="${2:?URL required after --url}"
    DATA=$(jq -n --arg s "$SUBMOLT" --arg t "$TITLE" --arg u "$URL" \
        '{submolt: $s, title: $t, url: $u}')
    POST_TYPE="link"
else
    CONTENT="${1:?Content required for text post}"
    DATA=$(jq -n --arg s "$SUBMOLT" --arg t "$TITLE" --arg c "$CONTENT" \
        '{submolt: $s, title: $t, content: $c}')
    POST_TYPE="text"
fi

echo "=== Creating $POST_TYPE post ===" >&2
echo "Submolt: m/$SUBMOLT" >&2
echo "Title: $TITLE" >&2
echo "" >&2

RESULT=$(curl -sf -X POST \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d "$DATA" \
    "${API_URL}/posts" 2>&1) || {
    echo "Error: Failed to create post" >&2
    exit 1
}

POST_ID=$(echo "$RESULT" | jq -r '.id // empty')

if [[ -n "$POST_ID" ]]; then
    echo "✓ Post created!" >&2
    echo "Post ID: $POST_ID" >&2
    echo "URL: https://www.moltbook.com/post/$POST_ID" >&2
fi

echo "$RESULT" | jq .
