#!/usr/bin/env bash
# list_pending.sh — List pending (unexecuted) Gnosis Safe transactions
#
# Usage:
#   ./list_pending.sh <SAFE_ADDRESS> <CHAIN>
#
# Arguments:
#   SAFE_ADDRESS   - Safe contract address (0x...)
#   CHAIN          - Chain name or ID: base (8453), ethereum (1), polygon (137)
#
# Examples:
#   ./list_pending.sh 0xYourSafeAddress base
#   ./list_pending.sh 0xYourSafeAddress ethereum
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

# pending txs: executed=false, ordered by nonce descending
PENDING_URL="${TX_SERVICE}/api/v1/safes/${SAFE_ADDRESS}/multisig-transactions/?executed=false&ordering=-nonce&limit=20"

# ---------------------------------------------------------------------------
# Header
# ---------------------------------------------------------------------------
echo "⏳ Pending Gnosis Safe Transactions"
echo "  Safe:       $SAFE_ADDRESS"
echo "  Chain:      $CHAIN"
echo "  TX Service: $TX_SERVICE"
echo ""

# ---------------------------------------------------------------------------
# Fetch
# ---------------------------------------------------------------------------
RESPONSE=$(curl -s -f --max-time 15 \
  -H "Accept: application/json" \
  "$PENDING_URL") || {
  echo "ERROR: Failed to fetch pending transactions from: ${PENDING_URL}" >&2
  echo "Verify the Safe address and chain are correct." >&2
  exit 1
}

# ---------------------------------------------------------------------------
# Display
# ---------------------------------------------------------------------------
if command -v python3 &>/dev/null; then
  echo "$RESPONSE" | python3 -c "
import json, sys
from datetime import datetime

try:
    data = json.load(sys.stdin)
except json.JSONDecodeError as e:
    print(f'ERROR: Could not parse JSON: {e}')
    sys.exit(1)

results = data.get('results', [])
count   = data.get('count', 0)

if count == 0 or not results:
    print('  No pending transactions found.')
    print()
    print('  Either all transactions have been executed, or none have been proposed yet.')
    sys.exit(0)

print(f'  Found {count} pending transaction(s):')
print()

for i, tx in enumerate(results, 1):
    confirmations     = tx.get('confirmations', [])
    confs_required    = tx.get('confirmationsRequired', tx.get('threshold', '?'))
    confs_count       = len(confirmations)
    safe_tx_hash      = tx.get('safeTxHash', 'N/A')
    nonce             = tx.get('nonce', 'N/A')
    to                = tx.get('to', 'N/A')
    value             = tx.get('value', '0')
    data              = tx.get('data', None)
    modified          = tx.get('modified', tx.get('submissionDate', 'N/A'))
    is_executable     = tx.get('isExecutable', False)

    try:
        value_eth = int(value) / 10**18
    except (ValueError, TypeError):
        value_eth = 0

    print(f'  [{i}] Nonce: {nonce}')
    print(f'      Hash:     {safe_tx_hash}')
    print(f'      To:       {to}')
    print(f'      Value:    {value_eth:.6f} ETH ({value} wei)')
    if data and data != '0x':
        data_preview = data[:66] + ('...' if len(data) > 66 else '')
        print(f'      Data:     {data_preview}')
    else:
        print(f'      Data:     (none)')
    print(f'      Confirms: {confs_count}/{confs_required}', end='')
    if is_executable:
        print(' ✅ READY TO EXECUTE', end='')
    print()
    if confirmations:
        print(f'      Signers:')
        for conf in confirmations:
            owner     = conf.get('owner', 'N/A')
            sig_type  = conf.get('signatureType', 'N/A')
            print(f'        - {owner} ({sig_type})')
    print()

if count > len(results):
    print(f'  (Showing {len(results)} of {count} total — increase limit to see more)')
print()
print('  Execute ready txs via: bankr call --to <safe> --abi execTransaction(...)')
print('  Or via Safe UI: https://app.safe.global')
"
else
  # Fallback: raw JSON
  echo "$RESPONSE"
fi
