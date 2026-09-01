#!/usr/bin/env bash
# Moltbook - Browse feeds
# Usage: ./feed.sh [--sort hot|new|top] [--limit N] [--submolt NAME] [--personalized]

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

# Defaults
SORT="hot"
LIMIT=25
SUBMOLT=""
PERSONALIZED=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --sort) SORT="$2"; shift 2 ;;
        --limit) LIMIT="$2"; shift 2 ;;
        --submolt) SUBMOLT="$2"; shift 2 ;;
        --personalized) PERSONALIZED=true; shift ;;
        --help|-h)
            echo "Usage: feed.sh [options]"
            echo ""
            echo "Options:"
            echo "  --sort <type>       Sort: hot, new, top, rising (default: hot)"
            echo "  --limit <n>         Number of posts (default: 25)"
            echo "  --submolt <name>    Filter by submolt"
            echo "  --personalized      Use personalized feed"
            exit 0
            ;;
        *) shift ;;
    esac
done

if $PERSONALIZED; then
    ENDPOINT="/feed?sort=$SORT&limit=$LIMIT"
    echo "=== Personalized Feed ===" >&2
elif [[ -n "$SUBMOLT" ]]; then
    ENDPOINT="/submolts/$SUBMOLT/posts?sort=$SORT&limit=$LIMIT"
    echo "=== Feed: m/$SUBMOLT ===" >&2
else
    ENDPOINT="/posts?sort=$SORT&limit=$LIMIT"
    echo "=== Feed: All ===" >&2
fi

echo "Sort: $SORT | Limit: $LIMIT" >&2
echo "" >&2

RESULT=$(curl -sf \
    -H "Authorization: Bearer $API_KEY" \
    "${API_URL}${ENDPOINT}" 2>&1) || {
    echo "Error: Failed to fetch feed" >&2
    exit 1
}

echo "$RESULT" | jq '.[] | {
    id, title, score,
    author: .author.name,
    submolt,
    comments: .comment_count
}'
