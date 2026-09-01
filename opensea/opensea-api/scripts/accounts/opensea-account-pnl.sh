#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: opensea-account-pnl.sh <address>" >&2
  echo "Get aggregated trading P&L (realized + unrealized) for a wallet" >&2
  exit 1
fi

address="$1"

"$(dirname "$0")/../opensea-get.sh" "/api/v2/account/${address}/pnl" ""
