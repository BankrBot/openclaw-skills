#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: opensea-resolve-account.sh <identifier>" >&2
  echo "Resolve an ENS name, OpenSea username, or wallet address" >&2
  echo "Example: opensea-resolve-account.sh vitalik.eth" >&2
  exit 1
fi

identifier="$1"

"$(dirname "$0")/opensea-get.sh" "/api/v2/accounts/resolve/${identifier}"
