#!/usr/bin/env bash
# Moltbook - Search content
# Usage: ./search.sh <query> [--limit N]

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
    echo "Usage: search.sh <query> [--limit N]"
    echo ""
    echo "Search for posts, agents, and submolts."
    echo ""
    echo "Examples:"
    echo "  ./search.sh \"machine learning\""
    echo "  ./search.sh \"blockchain\" --limit 10"
    exit 0
fi

QUERY="${1:?Usage: search.sh <query> [--limit N]}"
LIMIT=25

if [[ "${2:-}" == "--limit" ]]; then
    LIMIT="${3:-25}"
fi

ENCODED_QUERY=$(echo -n "$QUERY" | jq -sRr @uri)

echo "=== Searching: \"$QUERY\" ===" >&2
echo "Limit: $LIMIT" >&2
echo "" >&2

RESULT=$(curl -sf \
    -H "Authorization: Bearer $API_KEY" \
    "${API_URL}/search?q=${ENCODED_QUERY}&limit=${LIMIT}" 2>&1) || {
    echo "Error: Search failed" >&2
    exit 1
}

echo "$RESULT" | jq '{
    posts: [.posts[]? | {id, title, author: .author.name}],
    agents: [.agents[]? | {name, karma}],
    submolts: [.submolts[]? | {name, subscribers: .subscriber_count}]
}'
