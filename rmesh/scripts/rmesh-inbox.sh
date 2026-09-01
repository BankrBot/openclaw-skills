#!/bin/bash
# rmesh-inbox.sh — Read inbox from Signa + Net Protocol
# Usage: ./rmesh-inbox.sh <wallet_address> [limit]

set -euo pipefail

SIGNA_BASE="https://www.signaagent.xyz"
NET_CONTRACT="0x00000000B24D62781dB359b07880a105cD0b64e6"
BASE_RPC="${BASE_RPC_URL:-https://mainnet.base.org}"
NULL_ADDR="0x0000000000000000000000000000000000000000"

WALLET="${1:?Usage: rmesh-inbox.sh <wallet_address> [limit]}"
LIMIT="${2:-5}"

echo "📬 Inbox for: $WALLET"
echo ""

# === Signa Inbox ===
echo "── Signa DMs ──"
SIGNA_RESULT=$(curl -s "${SIGNA_BASE}/api/agents/${WALLET}/inbox?limit=${LIMIT}" 2>/dev/null)

echo "$SIGNA_RESULT" | python3 -c "
import sys, json
d = json.load(sys.stdin)
if not d.get('ok'):
    print('  ❌ Could not read Signa inbox')
    sys.exit(0)

dms = d.get('dms', [])
count = d.get('count', 0)
print(f'  Total: {count} messages')
print()

if not dms:
    print('  ⚪ No DMs')
else:
    for dm in dms[:5]:
        sender = dm.get('from', '?')[:10] + '...' + dm.get('from', '?')[-6:]
        body = dm.get('body', '')[:80]
        ts = dm.get('ts', 0)
        if ts:
            from datetime import datetime
            time = datetime.utcfromtimestamp(ts/1000 if ts > 1e12 else ts).strftime('%Y-%m-%d %H:%M UTC')
        else:
            time = 'unknown'
        print(f'  [{time}] {sender}')
        print(f'  {body}')
        print()
" 2>/dev/null

# === Net Protocol Messages ===
echo "── Net Protocol (Address Feed) ──"
# Check messages sent TO this address (their profile feed)
MSG_COUNT=$(cast call "$NET_CONTRACT" \
    "getTotalMessagesForAppUserCount(address,address)(uint256)" \
    "$NULL_ADDR" \
    "$WALLET" \
    --rpc-url "$BASE_RPC" 2>/dev/null | grep -o '[0-9]*' | head -1)

if [ -n "$MSG_COUNT" ] && [ "$MSG_COUNT" -gt 0 ] 2>/dev/null; then
    echo "  Total: $MSG_COUNT messages"
    
    # Read last few messages
    START=$((MSG_COUNT - LIMIT))
    if [ "$START" -lt 0 ]; then
        START=0
    fi
    
    for i in $(seq $START $((MSG_COUNT - 1))); do
        RESULT=$(cast call "$NET_CONTRACT" \
            "getMessageForAppUser(uint256,address,address)((address,address,uint256,bytes,string,string))" \
            "$i" \
            "$NULL_ADDR" \
            "$WALLET" \
            --rpc-url "$BASE_RPC" 2>/dev/null)
        
        if [ -n "$RESULT" ]; then
            SENDER=$(echo "$RESULT" | grep -o '0x[a-fA-F0-9]\{40\}' | sed -n '2p')
            TEXT=$(echo "$RESULT" | python3 -c "
import sys, re
s = sys.stdin.read()
# Find quoted strings
matches = re.findall(r'\"([^\"]+)\"', s)
# The text is usually the 5th quoted string (after address components)
for m in matches:
    if len(m) > 10 and not m.startswith('0x'):
        print(m[:100])
        break
else:
    print('(could not parse)')
" 2>/dev/null)
            TS=$(echo "$RESULT" | grep -o '[0-9]\{10\}' | head -1)
            
            if [ -n "$TS" ]; then
                TIME=$(date -d "@$TS" -u "+%Y-%m-%d %H:%M UTC" 2>/dev/null || echo "$TS")
            else
                TIME="unknown"
            fi
            
            echo "  [$TIME] ${SENDER:0:10}...${SENDER: -6}"
            echo "  $TEXT"
            echo ""
        fi
    done
else
    echo "  ⚪ No messages on Net Protocol"
fi

echo "── End Inbox ──"
