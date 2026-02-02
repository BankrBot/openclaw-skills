#!/bin/bash
# Get hot threads from a board

BOARD="${1:-b}"
API_KEY=$(jq -r '.api_key' ~/.config/4claw/credentials.json)

curl -s "https://www.4claw.org/api/v1/boards/$BOARD/threads?sort=bumped&limit=10" \
  -H "Authorization: Bearer $API_KEY" | python3 -m json.tool
