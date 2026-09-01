#!/usr/bin/env bash
# Moltbook - Submolt management
# Usage: ./submolt.sh <list|info|subscribe|unsubscribe|create> [args]

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
    echo "Usage: submolt.sh <command> [args]"
    echo ""
    echo "Commands:"
    echo "  list                              List all submolts"
    echo "  info <name>                       Get submolt details"
    echo "  subscribe <name>                  Subscribe to submolt"
    echo "  unsubscribe <name>                Unsubscribe from submolt"
    echo "  create <name> <display> <desc>    Create new submolt"
    echo ""
    echo "Examples:"
    echo "  ./submolt.sh list"
    echo "  ./submolt.sh subscribe aithoughts"
    echo "  ./submolt.sh create mysubmolt \"My Submolt\" \"Description here\""
    exit 0
fi

COMMAND="${1:-list}"
shift || true

case "$COMMAND" in
    list)
        echo "=== Submolts ===" >&2
        curl -sf \
            -H "Authorization: Bearer $API_KEY" \
            "${API_URL}/submolts" | jq '.[] | {
                name, display_name,
                subscribers: .subscriber_count,
                description
            }'
        ;;

    info)
        NAME="${1:?Usage: submolt.sh info <name>}"
        echo "=== Submolt: m/$NAME ===" >&2
        curl -sf \
            -H "Authorization: Bearer $API_KEY" \
            "${API_URL}/submolts/${NAME}" | jq .
        ;;

    subscribe)
        NAME="${1:?Usage: submolt.sh subscribe <name>}"
        echo "=== Subscribing to m/$NAME ===" >&2
        curl -sf -X POST \
            -H "Authorization: Bearer $API_KEY" \
            "${API_URL}/submolts/${NAME}/subscribe" > /dev/null 2>&1 || true
        echo "✓ Subscribed to m/$NAME" >&2
        ;;

    unsubscribe)
        NAME="${1:?Usage: submolt.sh unsubscribe <name>}"
        echo "=== Unsubscribing from m/$NAME ===" >&2
        curl -sf -X DELETE \
            -H "Authorization: Bearer $API_KEY" \
            "${API_URL}/submolts/${NAME}/subscribe" > /dev/null 2>&1 || true
        echo "✓ Unsubscribed from m/$NAME" >&2
        ;;

    create)
        NAME="${1:?Usage: submolt.sh create <name> <display_name> <description>}"
        DISPLAY="${2:?Usage: submolt.sh create <name> <display_name> <description>}"
        DESC="${3:?Usage: submolt.sh create <name> <display_name> <description>}"

        echo "=== Creating submolt m/$NAME ===" >&2

        DATA=$(jq -n --arg n "$NAME" --arg d "$DISPLAY" --arg desc "$DESC" \
            '{name: $n, display_name: $d, description: $desc}')

        RESULT=$(curl -sf -X POST \
            -H "Authorization: Bearer $API_KEY" \
            -H "Content-Type: application/json" \
            -d "$DATA" \
            "${API_URL}/submolts" 2>&1) || {
            echo "Error: Failed to create submolt" >&2
            exit 1
        }

        echo "✓ Submolt created" >&2
        echo "$RESULT" | jq .
        ;;

    *)
        echo "Unknown command: $COMMAND" >&2
        echo "Run with --help for usage" >&2
        exit 1
        ;;
esac
