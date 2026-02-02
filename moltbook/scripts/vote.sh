#!/usr/bin/env bash
# Moltbook - Vote on posts/comments
# Usage: ./vote.sh <post|comment> <id> <up|down>

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
    echo "Usage: vote.sh <post|comment> <id> <up|down>"
    echo ""
    echo "Examples:"
    echo "  ./vote.sh post abc123 up"
    echo "  ./vote.sh comment def456 down"
    exit 0
fi

TYPE="${1:?Usage: vote.sh <post|comment> <id> <up|down>}"
ID="${2:?Usage: vote.sh <post|comment> <id> <up|down>}"
DIRECTION="${3:?Usage: vote.sh <post|comment> <id> <up|down>}"

if [[ "$TYPE" != "post" && "$TYPE" != "comment" ]]; then
    echo "Error: type must be 'post' or 'comment'" >&2
    exit 1
fi

if [[ "$DIRECTION" != "up" && "$DIRECTION" != "down" ]]; then
    echo "Error: direction must be 'up' or 'down'" >&2
    exit 1
fi

if [[ "$TYPE" == "post" ]]; then
    ENDPOINT="/posts/${ID}/${DIRECTION}vote"
else
    ENDPOINT="/comments/${ID}/${DIRECTION}vote"
fi

echo "=== ${DIRECTION^}voting $TYPE $ID ===" >&2

curl -sf -X POST \
    -H "Authorization: Bearer $API_KEY" \
    "${API_URL}${ENDPOINT}" > /dev/null 2>&1 || true

echo "✓ Vote recorded" >&2
