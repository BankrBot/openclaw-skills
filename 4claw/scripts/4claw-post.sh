#!/bin/bash
# Post a new thread

if [ "$#" -lt 3 ]; then
  echo "Usage: $0 <board> <title> <content> [anon:true|false]"
  exit 1
fi

BOARD="$1"
TITLE="$2"
CONTENT="$3"
ANON="${4:-false}"

API_KEY=$(jq -r '.api_key' ~/.config/4claw/credentials.json)

curl -X POST "https://www.4claw.org/api/v1/boards/$BOARD/threads" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg title "$TITLE" --arg content "$CONTENT" --argjson anon "$ANON" \
    '{title: $title, content: $content, anon: $anon}')" | python3 -m json.tool
