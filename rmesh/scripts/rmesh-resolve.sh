#!/bin/bash
# rmesh-resolve.sh — Resolve any agent identity across protocols
# Usage: ./rmesh-resolve.sh <identifier>
# Identifier: @handle, 0x..., ENS, Basename

set -euo pipefail

SIGNA_BASE="https://www.signaagent.xyz"
NET_CONTRACT="0x00000000B24D62781dB359b07880a105cD0b64e6"
BASE_RPC="${BASE_RPC_URL:-https://mainnet.base.org}"

ID="${1:?Usage: rmesh-resolve.sh <@handle|0x|ENS|basename>}"

echo "🔍 Resolving: $ID"
echo ""

# Step 1: Resolve via Signa (handles @twitter, ENS, wallet, etc.)
echo "── Signa Resolution ──"
SIGNA_RESULT=$(curl -s "${SIGNA_BASE}/api/resolve?id=$(echo "$ID" | sed 's/@/%40/g')" 2>/dev/null)

if echo "$SIGNA_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if d.get('ok') else 1)" 2>/dev/null; then
    ADDRESS=$(echo "$SIGNA_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['address'])" 2>/dev/null)
    CAIP10=$(echo "$SIGNA_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['caip10'])" 2>/dev/null)
    SOURCE=$(echo "$SIGNA_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['source'])" 2>/dev/null)
    ON_SIGNA=$(echo "$SIGNA_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('on_signa', False))" 2>/dev/null)
    
    echo "  ✅ Resolved: $ADDRESS"
    echo "  📍 Source: $SOURCE"
    echo "  🔗 CAIP-10: $CAIP10"
    echo "  📡 On Signa: $ON_SIGNA"
    
    # Extract display info
    LABEL=$(echo "$SIGNA_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin).get('display',{}); print(d.get('label') or d.get('ens_name') or d.get('basename') or '-')" 2>/dev/null)
    if [ "$LABEL" != "-" ] && [ "$LABEL" != "None" ]; then
        echo "  🏷️  Label: $LABEL"
    fi
    
    # Extract routes
    echo ""
    echo "  📬 Routes:"
    echo "$SIGNA_RESULT" | python3 -c "
import sys, json
d = json.load(sys.stdin)
routes = d.get('routes', {})
for name, info in routes.items():
    if info:
        print(f'    {name}:')
        for k, v in info.items():
            if v:
                print(f'      {k}: {v}')
" 2>/dev/null
else
    echo "  ❌ Signa: Could not resolve"
    ADDRESS=""
fi

# Step 2: Check Net Protocol presence
echo ""
echo "── Net Protocol Presence ──"
if [ -n "$ADDRESS" ]; then
    # Check if this address has posted on Net Protocol
    MSG_COUNT=$(cast call "$NET_CONTRACT" \
        "getTotalMessagesForAppUserCount(address,address)(uint256)" \
        0x0000000000000000000000000000000000000000 \
        "$ADDRESS" \
        --rpc-url "$BASE_RPC" 2>/dev/null | grep -o '[0-9]*' | head -1)
    
    if [ -n "$MSG_COUNT" ] && [ "$MSG_COUNT" -gt 0 ] 2>/dev/null; then
        echo "  ✅ Active: $MSG_COUNT messages on-chain"
    else
        echo "  ⚪ No messages on Net Protocol"
    fi
else
    echo "  ⚠️  Skipped (no wallet address resolved)"
fi

# Step 3: Summary
echo ""
echo "── Routing Summary ──"
if [ -n "$ADDRESS" ]; then
    echo "  Wallet: $ADDRESS"
    echo "  Available channels:"
    echo "    • Signa DM: ✅ (any wallet can receive)"
    echo "    • Signa Brain: ✅ (public)"
    if [ -n "$MSG_COUNT" ] && [ "$MSG_COUNT" -gt 0 ] 2>/dev/null; then
        echo "    • Net Protocol: ✅ ($MSG_COUNT messages)"
    else
        echo "    • Net Protocol: ⚪ (no activity)"
    fi
fi
