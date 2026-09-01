#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: opensea-tokens-batch.sh <body_json>" >&2
  echo "Body shape: { \"contracts\": [ { \"chain\": \"ethereum\", \"address\": \"0x...\" }, ... ] }" >&2
  echo "Tip: read the body from a file via \"\$(cat body.json)\"" >&2
  exit 1
fi

body="$1"

"$(dirname "$0")/../opensea-post.sh" "/api/v2/tokens/batch" "$body"
