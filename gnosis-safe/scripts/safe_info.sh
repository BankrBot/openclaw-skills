#!/usr/bin/env bash
# safe_info.sh — Query Gnosis Safe info via Safe Transaction Service
#
# Usage:
#   ./safe_info.sh <SAFE_ADDRESS> <CHAIN>
#
# Arguments:
#   SAFE_ADDRESS   - Safe contract address (0x...)
#   CHAIN          - Chain name or ID: base (8453), ethereum (1), polygon (137)
#
# Examples:
#   ./safe_info.sh 0xYourSafeAddress base
#   ./safe_info.sh 0xYourSafeAddress 8453
#
# Requirements: curl, python3 (optional, for pretty output)

set -euo pipefail

# ---------------------------------------------------------------------------
# Args
# ---------------------------------------------------------------------------
SAFE_ADDRESS="${1:-}"
CHAIN="${2:-base}"

if [[ -z "$SAFE_ADDRESS" ]]; then
  echo "Usage: $0 <SAFE_ADDRESS> <CHAIN>"
  echo "Example: $0 0xYourSafeAddress base"
  exit 1
fi

# ---------------------------------------------------------------------------
# Resolve TX service URL
# ---------------------------------------------------------------------------
case "${CHAIN,,}" in
  base|8453)
    TX_SERVICE="https://safe-transaction-base.safe.global"
    ;;
  ethereum|mainnet|1)
    TX_SERVICE="https://safe-transaction-mainnet.safe.global"
    ;;
  polygon|137)
    TX_SERVICE="https://safe-transaction-polygon.safe.global"
    ;;
  *)
    echo "ERROR: Unknown chain '${CHAIN}'. Use: base, ethereum, polygon (or 8453, 1, 137)" >&2
    exit 1
    ;;
esac

SAFE_URL="${TX_SERVICE}/api/v1/safes/${SAFE_ADDRESS}/"

# ---------------------------------------------------------------------------
# Header
# ---------------------------------------------------------------------------
echo "🔐 Gnosis Safe Info"
echo "  Address:    $SAFE_ADDRESS"
echo "  Chain:      $CHAIN"
echo "  TX Service: $TX_SERVICE"
echo ""

# ---------------------------------------------------------------------------
# Fetch Safe info
# ---------------------------------------------------------------------------
RESPONSE=$(curl -s -f --max-time 15 \
  -H "Accept: application/json" \
  "$SAFE_URL") || {
  echo "ERROR: Failed to fetch Safe info from: ${SAFE_URL}" >&2
  echo "Verify the Safe address and chain are correct." >&2
  exit 1
}

# ---------------------------------------------------------------------------
# Display — pipe JSON into Python for pretty formatting
# ---------------------------------------------------------------------------
if command -v python3 &>/dev/null; then
  echo "$RESPONSE" | python3 -c "
import json, sys

try:
    data = json.load(sys.stdin)
except json.JSONDecodeError as e:
    print(f'ERROR: Could not parse JSON: {e}')
    raw = sys.stdin.read()
    print('Raw response:', raw[:500])
    sys.exit(1)

print('=' * 60)
print(f'  Nonce:      {data.get(\"nonce\", \"N/A\")}')
print(f'  Threshold:  {data.get(\"threshold\", \"N/A\")}')
print(f'  Version:    {data.get(\"version\", \"N/A\")}')
print()

owners = data.get('owners', [])
print(f'  Owners ({len(owners)}):')
for o in owners:
    print(f'    - {o}')
print()

modules = data.get('modules', [])
if modules:
    print(f'  Modules ({len(modules)}):')
    for m in modules:
        print(f'    - {m}')
    print()

guard = data.get('guard', '')
if guard and guard != '0x0000000000000000000000000000000000000000':
    print(f'  Guard:         {guard}')
    print()

print(f'  Master Copy:   {data.get(\"masterCopy\", \"N/A\")}')
print(f'  Fallback Hdlr: {data.get(\"fallbackHandler\", \"N/A\")}')
print('=' * 60)
"
else
  # Fallback: raw JSON
  echo "$RESPONSE"
fi

echo ""
echo "💡 Use the 'nonce' value when proposing transactions with propose_tx.py"
echo "💡 Threshold = number of confirmations required to execute"
