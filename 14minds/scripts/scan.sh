#!/usr/bin/env bash
# 14minds Token Scanner — Simple wrapper for scanner-unified.py
#
# Usage:
#   ./scan.sh 0xTOKEN_ADDRESS          # Scan only, no posting
#   ./scan.sh 0xTOKEN_ADDRESS --post   # Full pipeline with posting

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCANNER="$SCRIPT_DIR/scanner-unified.py"

if [ ! -f "$SCANNER" ]; then
    echo "Error: scanner-unified.py not found at $SCANNER"
    exit 1
fi

if [ -z "$1" ]; then
    echo "Usage: $0 <token-contract-address> [--post]"
    echo ""
    echo "Examples:"
    echo "  $0 0xf30bf00edd0c22db54c9274b90d2a4c21fc09b07"
    echo "  $0 0xf30bf00edd0c22db54c9274b90d2a4c21fc09b07 --post"
    exit 1
fi

TOKEN_ADDRESS="$1"
POST_FLAG="${2:-}"

# Validate contract address format
if [[ ! "$TOKEN_ADDRESS" =~ ^0x[a-fA-F0-9]{40}$ ]]; then
    echo "Error: Invalid contract address format"
    echo "Expected: 0x followed by 40 hex characters"
    exit 1
fi

echo "🔍 14MINDS Token Scanner"
echo "Token: $TOKEN_ADDRESS"
echo ""

if [ "$POST_FLAG" = "--post" ]; then
    echo "Mode: Full pipeline (scan + visual + post)"
    python3 "$SCANNER" "$TOKEN_ADDRESS" --post
else
    echo "Mode: Scan only (no posting)"
    python3 "$SCANNER" "$TOKEN_ADDRESS"
fi
