#!/usr/bin/env bash
# create-poll.sh — Create a Twitter/X poll via OAuth 1.0a
# Usage: ./scripts/create-poll.sh --question "..." --options "A" "B" [--duration 1440]
# Requires: bash, curl, openssl, python3

set -euo pipefail

# ---------------------------------------------------------------------------
# Parse args
# ---------------------------------------------------------------------------
QUESTION=""
OPTIONS=()
DURATION=1440

while [[ $# -gt 0 ]]; do
  case "$1" in
    --question) QUESTION="$2"; shift 2 ;;
    --duration) DURATION="$2"; shift 2 ;;
    --options)
      shift
      while [[ $# -gt 0 ]] && [[ "$1" != --* ]]; do
        OPTIONS+=("$1"); shift
      done ;;
    *) shift ;;
  esac
done

[[ -z "$QUESTION" ]] && { echo "Error: --question is required" >&2; exit 1; }
[[ ${#OPTIONS[@]} -lt 2 || ${#OPTIONS[@]} -gt 4 ]] && { echo "Error: --options requires 2-4 values" >&2; exit 1; }
[[ "$DURATION" -lt 5 ]] && { echo "Warning: clamping duration to minimum 5 min" >&2; DURATION=5; }
[[ "$DURATION" -gt 10080 ]] && { echo "Warning: clamping duration to maximum 10080 min (7 days)" >&2; DURATION=10080; }

# ---------------------------------------------------------------------------
# Credentials from env
# ---------------------------------------------------------------------------
API_KEY="${X_API_KEY:?X_API_KEY not set}"
API_SECRET="${X_API_KEY_SECRET:?X_API_KEY_SECRET not set}"
ACCESS_TOKEN="${X_ACCESS_TOKEN:?X_ACCESS_TOKEN not set}"
ACCESS_SECRET="${X_ACCESS_TOKEN_SECRET:?X_ACCESS_TOKEN_SECRET not set}"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
urlencode() {
  python3 -c "import sys,urllib.parse; print(urllib.parse.quote(sys.argv[1],safe=''))" "$1"
}

# ---------------------------------------------------------------------------
# Build JSON body
# ---------------------------------------------------------------------------
BODY=$(python3 -c "
import json, sys
question  = sys.argv[1]
duration  = int(sys.argv[2])
options   = sys.argv[3:]
print(json.dumps({'text': question, 'poll': {'options': options, 'duration_minutes': duration}}))
" "$QUESTION" "$DURATION" "${OPTIONS[@]}")

# ---------------------------------------------------------------------------
# OAuth 1.0a signing
# ---------------------------------------------------------------------------
METHOD="POST"
URL="https://api.twitter.com/2/tweets"
TIMESTAMP=$(date +%s)
NONCE=$(openssl rand -hex 16)

ENC_KEY=$(urlencode "$API_KEY")
ENC_TOKEN=$(urlencode "$ACCESS_TOKEN")
ENC_NONCE=$(urlencode "$NONCE")

# Param string — all OAuth params percent-encoded, sorted alphabetically
PARAM_STRING="oauth_consumer_key=${ENC_KEY}&oauth_nonce=${ENC_NONCE}&oauth_signature_method=HMAC-SHA1&oauth_timestamp=${TIMESTAMP}&oauth_token=${ENC_TOKEN}&oauth_version=1.0"

# Signature base string
BASE_STRING="${METHOD}&$(urlencode "$URL")&$(urlencode "$PARAM_STRING")"

# Signing key
SIGNING_KEY="$(urlencode "$API_SECRET")&$(urlencode "$ACCESS_SECRET")"

# HMAC-SHA1
SIGNATURE=$(echo -n "$BASE_STRING" | openssl dgst -sha1 -hmac "$SIGNING_KEY" -binary | base64)
ENC_SIG=$(urlencode "$SIGNATURE")

# Authorization header
AUTH="OAuth oauth_consumer_key=\"${ENC_KEY}\",oauth_nonce=\"${NONCE}\",oauth_signature=\"${ENC_SIG}\",oauth_signature_method=\"HMAC-SHA1\",oauth_timestamp=\"${TIMESTAMP}\",oauth_token=\"${ENC_TOKEN}\",oauth_version=\"1.0\""

# ---------------------------------------------------------------------------
# Make request
# ---------------------------------------------------------------------------
TMPFILE=$(mktemp)
HTTP_CODE=$(curl -s -o "$TMPFILE" -w "%{http_code}" -X POST "$URL" \
  -H "Authorization: $AUTH" \
  -H "Content-Type: application/json" \
  -d "$BODY")
RESPONSE=$(cat "$TMPFILE"); rm -f "$TMPFILE"

if [[ "$HTTP_CODE" != "201" ]]; then
  echo "Error: HTTP $HTTP_CODE" >&2
  echo "$RESPONSE" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Output JSON
# ---------------------------------------------------------------------------
python3 -c "
import json, sys
from datetime import datetime, timezone, timedelta

data     = json.loads(sys.argv[1])
question = sys.argv[2]
duration = int(sys.argv[3])
options  = sys.argv[4:]

tweet_id = data['data']['id']
ends_at  = (datetime.now(timezone.utc) + timedelta(minutes=duration)).strftime('%Y-%m-%dT%H:%M:%S.000Z')

print(json.dumps({
  'tweetId':         tweet_id,
  'question':        question,
  'options':         options,
  'durationMinutes': duration,
  'endsAt':          ends_at,
  'url':             f'https://x.com/i/web/status/{tweet_id}'
}, indent=2))
" "$RESPONSE" "$QUESTION" "$DURATION" "${OPTIONS[@]}"
