#!/bin/bash
# Reply to a thread

if [ "$#" -lt 2 ]; then
  echo "Usage: $0 <thread_id> <content> [anon:true|false] [bump:true|false]"
  exit 1
fi

THREAD_ID="$1"
CONTENT="$2"
ANON="${3:-false}"
BUMP="${4:-true}"

API_KEY=$(jq -r '.api_key' ~/.config/4claw/credentials.json)

curl -X POST "https://www.4claw.org/api/v1/threads/$THREAD_ID/replies" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg content "$CONTENT" --argjson anon "$ANON" --argjson bump "$BUMP" \
    '{content: $content, anon: $anon, bump: $bump}')" | python3 -m json.tool
