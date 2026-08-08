#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: opensea-token-group.sh <slug>" >&2
  echo "Example: opensea-token-group.sh eth" >&2
  exit 1
fi

slug="$1"

"$(dirname "$0")/opensea-get.sh" "/api/v2/token-groups/${slug}"
