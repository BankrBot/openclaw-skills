#!/usr/bin/env bash
# get-poll-results.sh — Fetch vote counts for a Twitter/X poll
# Usage: ./scripts/get-poll-results.sh --tweet-id 1234567890
# Requires: bash, curl, openssl, python3

set -euo pipefail

# ---------------------------------------------------------------------------
# Parse args
# ---------------------------------------------------------------------------
TWEET_ID=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tweet-id) TWEET_ID="$2"; shift 2 ;;
    *) shift ;;
  esac
done

[[ -z "$TWEET_ID" ]] && { echo "Error: --tweet-id is required" >&2; exit 1; }

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
# OAuth 1.0a signing
# ---------------------------------------------------------------------------
METHOD="GET"
BASE_URL="https://api.twitter.com/2/tweets/${TWEET_ID}"
QUERY="expansions=attachments.poll_ids&poll.fields=options%2Cend_datetime%2Cvoting_status%2Cduration_minutes&tweet.fields=attachments"
URL="${BASE_URL}?${QUERY}"

TIMESTAMP=$(date +%s)
NONCE=$(openssl rand -hex 16)

ENC_KEY=$(urlencode "$API_KEY")
ENC_TOKEN=$(urlencode "$ACCESS_TOKEN")

# For GET, query params must be included in the OAuth param string, sorted
# expansions, poll.fields, tweet.fields plus OAuth params — all sorted
PARAM_STRING="expansions=attachments.poll_ids&oauth_consumer_key=${ENC_KEY}&oauth_nonce=${NONCE}&oauth_signature_method=HMAC-SHA1&oauth_timestamp=${TIMESTAMP}&oauth_token=${ENC_TOKEN}&oauth_version=1.0&poll.fields=options%2Cend_datetime%2Cvoting_status%2Cduration_minutes&tweet.fields=attachments"

BASE_STRING="${METHOD}&$(urlencode "$BASE_URL")&$(urlencode "$PARAM_STRING")"
SIGNING_KEY="$(urlencode "$API_SECRET")&$(urlencode "$ACCESS_SECRET")"

SIGNATURE=$(echo -n "$BASE_STRING" | openssl dgst -sha1 -hmac "$SIGNING_KEY" -binary | base64)
ENC_SIG=$(urlencode "$SIGNATURE")

AUTH="OAuth oauth_consumer_key=\"${ENC_KEY}\",oauth_nonce=\"${NONCE}\",oauth_signature=\"${ENC_SIG}\",oauth_signature_method=\"HMAC-SHA1\",oauth_timestamp=\"${TIMESTAMP}\",oauth_token=\"${ENC_TOKEN}\",oauth_version=\"1.0\""

# ---------------------------------------------------------------------------
# Make request
# ---------------------------------------------------------------------------
TMPFILE=$(mktemp)
HTTP_CODE=$(curl -s -o "$TMPFILE" -w "%{http_code}" -G "$BASE_URL" \
  --data-urlencode "expansions=attachments.poll_ids" \
  --data-urlencode "poll.fields=options,end_datetime,voting_status,duration_minutes" \
  --data-urlencode "tweet.fields=attachments" \
  -H "Authorization: $AUTH")
RESPONSE=$(cat "$TMPFILE"); rm -f "$TMPFILE"

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "Error: HTTP $HTTP_CODE" >&2
  echo "$RESPONSE" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Parse and output JSON
# ---------------------------------------------------------------------------
python3 -c "
import json, sys
from datetime import datetime, timezone

data     = json.loads(sys.argv[1])
tweet_id = sys.argv[2]

tweet = data.get('data', {})
polls = data.get('includes', {}).get('polls', [])

if not polls:
    print(json.dumps({'error': 'No poll found on this tweet'}, indent=2))
    sys.exit(1)

poll     = polls[0]
ends_at  = poll.get('end_datetime', '')
voting   = poll.get('voting_status', '')
options  = poll.get('options', [])

# Determine status
now = datetime.now(timezone.utc)
try:
    end_dt = datetime.fromisoformat(ends_at.replace('Z','+00:00'))
    status = 'closed' if (voting == 'closed' or end_dt <= now) else 'open'
except Exception:
    status = voting or 'unknown'

# Tally
total = sum(o.get('votes', 0) for o in options)
results = []
for o in options:
    v = o.get('votes', 0)
    pct = f'{v/total*100:.1f}%' if total > 0 else None
    results.append({'label': o['label'], 'votes': v, 'pct': pct})

print(json.dumps({
    'tweetId':    tweet_id,
    'question':   tweet.get('text',''),
    'status':     status,
    'endsAt':     ends_at,
    'totalVotes': total if total > 0 else None,
    'options':    results
}, indent=2))
" "$RESPONSE" "$TWEET_ID"
