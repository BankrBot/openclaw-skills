#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: opensea-drop.sh <collection_slug>" >&2
  echo "Example: opensea-drop.sh cool-cats" >&2
  exit 1
fi

slug="$1"

"$(dirname "$0")/opensea-get.sh" "/api/v2/drops/${slug}"
