#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: opensea-cross-chain-fulfill.sh [--recipient <address>] <fulfiller> <payment_chain> <payment_token> <listing_chain> <protocol_address> <hash1> [hash2 ...]" >&2
  echo "" >&2
  echo "Get cross-chain fulfillment data for one or more listings." >&2
  echo "Supports same-chain, cross-token, and cross-chain purchases." >&2
  echo "" >&2
  echo "Options:" >&2
  echo "  --recipient <address>  Different recipient address for NFTs (optional)" >&2
  echo "" >&2
  echo "Arguments:" >&2
  echo "  fulfiller         Buyer wallet address (0x...)" >&2
  echo "  payment_chain     Chain slug of the payment token (EVM or SVM, e.g., base, ethereum, solana)" >&2
  echo "  payment_token     Payment token contract address (0x... for EVM, Base58 for Solana, 0x0...0 for native)" >&2
  echo "  listing_chain     Chain slug where listings live (must be EVM)" >&2
  echo "  protocol_address  Seaport contract address for the listings (0x + 40 hex chars)" >&2
  echo "  hash1 [hash2 ...] One or more order hashes to fulfill (up to 50)" >&2
  echo "" >&2
  echo "Example (single listing):" >&2
  echo "  opensea-cross-chain-fulfill.sh 0xBuyer base 0x0000000000000000000000000000000000000000 ethereum 0x0000000000000068f116a894984e2db1123eb395 0xOrderHash" >&2
  echo "" >&2
  echo "Example (sweep multiple):" >&2
  echo "  opensea-cross-chain-fulfill.sh 0xBuyer base 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 ethereum 0x0000000000000068f116a894984e2db1123eb395 0xHash1 0xHash2 0xHash3" >&2
  echo "" >&2
  echo "Example (with recipient):" >&2
  echo "  opensea-cross-chain-fulfill.sh --recipient 0xRecipient 0xBuyer base 0x0000000000000000000000000000000000000000 ethereum 0x0000000000000068f116a894984e2db1123eb395 0xOrderHash" >&2
  exit 1
}

recipient=""
if [ "${1:-}" = "--recipient" ]; then
  if [ "$#" -lt 2 ]; then
    echo "opensea-cross-chain-fulfill.sh: --recipient requires an address" >&2
    exit 1
  fi
  recipient="$2"
  shift 2
fi

if [ "$#" -lt 6 ]; then
  usage
fi

fulfiller="$1"
payment_chain="$2"
payment_token="$3"
listing_chain="$4"
protocol_address="$5"
shift 5

if [[ ! "$fulfiller" =~ ^0x[0-9a-fA-F]{40}$ ]]; then
  echo "opensea-cross-chain-fulfill.sh: fulfiller must be a valid Ethereum address (0x + 40 hex chars)" >&2
  exit 1
fi

valid_evm_chains="^(ethereum|matic|arbitrum|optimism|base|avalanche|klaytn|zora|blast|sepolia)$"
if [[ ! "$listing_chain" =~ $valid_evm_chains ]]; then
  echo "opensea-cross-chain-fulfill.sh: invalid listing_chain '$listing_chain'" >&2
  exit 1
fi

valid_payment_chains="^(ethereum|matic|arbitrum|optimism|base|avalanche|klaytn|zora|blast|sepolia|solana)$"
if [[ ! "$payment_chain" =~ $valid_payment_chains ]]; then
  echo "opensea-cross-chain-fulfill.sh: invalid payment_chain '$payment_chain'" >&2
  exit 1
fi

if [[ ! "$protocol_address" =~ ^0x[0-9a-fA-F]{40}$ ]]; then
  echo "opensea-cross-chain-fulfill.sh: protocol_address must be a valid Ethereum address (0x + 40 hex chars)" >&2
  exit 1
fi

if [ -n "$recipient" ] && [[ ! "$recipient" =~ ^0x[0-9a-fA-F]{40}$ ]]; then
  echo "opensea-cross-chain-fulfill.sh: recipient must be a valid Ethereum address (0x + 40 hex chars)" >&2
  exit 1
fi

# Build listings array from remaining arguments
listings="["
first=true
for hash in "$@"; do
  if [[ ! "$hash" =~ ^0x[0-9a-fA-F]+$ ]]; then
    echo "opensea-cross-chain-fulfill.sh: order hash must be hex (0x...): $hash" >&2
    exit 1
  fi
  if [ "$first" = true ]; then
    first=false
  else
    listings="$listings,"
  fi
  listings="$listings{\"hash\":\"$hash\",\"chain\":\"$listing_chain\",\"protocol_address\":\"$protocol_address\"}"
done
listings="$listings]"

recipient_field=""
if [ -n "$recipient" ]; then
  recipient_field=",\"recipient\":\"$recipient\""
fi

body="{\"listings\":$listings,\"fulfiller\":{\"address\":\"$fulfiller\"},\"payment\":{\"chain\":\"$payment_chain\",\"token_address\":\"$payment_token\"}$recipient_field}"

"$(dirname "$0")/opensea-post.sh" "/api/v2/listings/cross_chain_fulfillment_data" "$body"
