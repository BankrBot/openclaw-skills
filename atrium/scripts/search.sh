#!/usr/bin/env bash
# Search Atrium skills via the indexer. Usage: ./search.sh "<query>" [recent|invocations|earned]
set -euo pipefail
BASE="${ATRIUM_INDEXER:-https://indexer-production-92e5.up.railway.app}"
Q="${1:-}"; SORT="${2:-invocations}"
ENC=$(printf %s "$Q" | sed 's/ /%20/g')
curl -fsS "$BASE/skills?q=$ENC&sort=$SORT&limit=20" \
  | { jq -r '.items[] | "\(.skillId)  \(.pricePerCall) USDC  \(.name)  [\(.tags|join(", "))]"' 2>/dev/null || cat; }
