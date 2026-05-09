#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 3 ]; then
  echo "Usage: opensea-fulfill-listing.sh <chain> <order_hash> <fulfiller_address>" >&2
  echo "Returns transaction data to execute onchain to buy the NFT" >&2
  echo "Example: opensea-fulfill-listing.sh ethereum 0x1234... 0xYourWallet" >&2
  exit 1
fi

chain="$1"
order_hash="$2"
fulfiller="$3"

valid_chains="^(ethereum|matic|arbitrum|optimism|base|avalanche|klaytn|zora|blast|sepolia)$"
if [[ ! "$chain" =~ $valid_chains ]]; then
  echo "opensea-fulfill-listing.sh: invalid chain '$chain'" >&2
  exit 1
fi

if [[ ! "$order_hash" =~ ^0x[0-9a-fA-F]+$ ]]; then
  echo "opensea-fulfill-listing.sh: order_hash must be hex (0x...)" >&2
  exit 1
fi

if [[ ! "$fulfiller" =~ ^0x[0-9a-fA-F]{40}$ ]]; then
  echo "opensea-fulfill-listing.sh: fulfiller must be a valid Ethereum address (0x + 40 hex chars)" >&2
  exit 1
fi

protocol="0x0000000000000068f116a894984e2db1123eb395"

body=$(cat <<EOF
{
  "listing": {
    "hash": "$order_hash",
    "chain": "$chain",
    "protocol_address": "$protocol"
  },
  "fulfiller": {
    "address": "$fulfiller"
  }
}
EOF
)

"$(dirname "$0")/opensea-post.sh" "/api/v2/listings/fulfillment_data" "$body"
