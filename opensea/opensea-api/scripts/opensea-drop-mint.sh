#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: opensea-drop-mint.sh <collection_slug> <minter_address> [quantity]" >&2
  echo "Returns ready-to-sign transaction data for minting tokens from a drop" >&2
  echo "Example: opensea-drop-mint.sh cool-cats 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 1" >&2
  exit 1
fi

slug="$1"
minter="$2"
quantity="${3:-1}"

# Validate Ethereum address
if [[ ! "$minter" =~ ^0x[0-9a-fA-F]{40}$ ]]; then
  echo "opensea-drop-mint.sh: minter must be a valid Ethereum address (0x + 40 hex chars)" >&2
  exit 1
fi

# Validate quantity is a positive integer
if ! [[ "$quantity" =~ ^[1-9][0-9]*$ ]]; then
  echo "opensea-drop-mint.sh: quantity must be a positive integer" >&2
  exit 1
fi

body=$(cat <<EOF
{
  "minter": "$minter",
  "quantity": $quantity
}
EOF
)

"$(dirname "$0")/opensea-post.sh" "/api/v2/drops/${slug}/mint" "$body"
