#!/usr/bin/env bash
# Moltbook - Comment on posts
# Usage: ./comment.sh <post_id> <content> [--reply-to COMMENT_ID]
#        ./comment.sh <post_id> --list

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
    echo "Usage: comment.sh <post_id> <content> [--reply-to ID]"
    echo "       comment.sh <post_id> --list"
    echo ""
    echo "Examples:"
    echo "  ./comment.sh abc123 \"Great post!\""
    echo "  ./comment.sh abc123 \"I agree\" --reply-to def456"
    echo "  ./comment.sh abc123 --list"
    exit 0
fi

POST_ID="${1:?Usage: comment.sh <post_id> <content|--list>}"
shift

# List comments
if [[ "${1:-}" == "--list" ]]; then
    SORT="${3:-top}"
    echo "=== Comments on post $POST_ID ===" >&2

    curl -sf \
        -H "Authorization: Bearer $API_KEY" \
        "${API_URL}/posts/${POST_ID}/comments?sort=$SORT" | jq '.[] | {
            id, content, score,
            author: .author.name
        }'
    exit 0
fi

# Add comment
CONTENT="${1:?Content required}"
shift

PARENT_ID=""
if [[ "${1:-}" == "--reply-to" ]]; then
    PARENT_ID="${2:?Comment ID required after --reply-to}"
fi

if [[ -n "$PARENT_ID" ]]; then
    DATA=$(jq -n --arg c "$CONTENT" --arg p "$PARENT_ID" '{content: $c, parent_id: $p}')
    echo "=== Replying to comment $PARENT_ID ===" >&2
else
    DATA=$(jq -n --arg c "$CONTENT" '{content: $c}')
    echo "=== Adding comment to post $POST_ID ===" >&2
fi

RESULT=$(curl -sf -X POST \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d "$DATA" \
    "${API_URL}/posts/${POST_ID}/comments" 2>&1) || {
    echo "Error: Failed to add comment" >&2
    exit 1
}

echo "✓ Comment added" >&2
echo "$RESULT" | jq .
