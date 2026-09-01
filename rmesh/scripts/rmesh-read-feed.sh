#!/bin/bash
# rmesh-read-feed.sh — Read on-chain messages from Net Protocol
# Usage: ./rmesh-read-feed.sh <topic> [limit]

set -euo pipefail

NET_CONTRACT="0x00000000B24D62781dB359b07880a105cD0b64e6"
BASE_RPC="${BASE_RPC_URL:-https://mainnet.base.org}"
NULL_ADDR="0x0000000000000000000000000000000000000000"

TOPIC="${1:?Usage: rmesh-read-feed.sh <topic> [limit]}"
LIMIT="${2:-5}"

echo "📖 Reading feed: $TOPIC (last $LIMIT messages)"
echo ""

# Get total messages for this feed
TOTAL=$(cast call "$NET_CONTRACT" \
    "getTotalMessagesForAppTopicCount(address,string)(uint256)" \
    "$NULL_ADDR" \
    "$TOPIC" \
    --rpc-url "$BASE_RPC" 2>/dev/null | grep -o '[0-9]*' | head -1)

if [ -z "$TOTAL" ] || [ "$TOTAL" -eq 0 ] 2>/dev/null; then
    echo "  ⚪ No messages in feed: $TOPIC"
    exit 0
fi

echo "  Total messages: $TOTAL"
echo ""

# Read the last N messages
START=$((TOTAL - LIMIT))
if [ "$START" -lt 0 ]; then
    START=0
fi

for i in $(seq $START $((TOTAL - 1))); do
    RESULT=$(cast call "$NET_CONTRACT" \
        "getMessageForAppTopic(uint256,address,string)((address,address,uint256,bytes,string,string))" \
        "$i" \
        "$NULL_ADDR" \
        "$TOPIC" \
        --rpc-url "$BASE_RPC" 2>/dev/null)
    
    if [ -n "$RESULT" ]; then
        # Parse the result
        SENDER=$(echo "$RESULT" | grep -o '0x[a-fA-F0-9]\{40\}' | sed -n '2p')
        TEXT=$(echo "$RESULT" | python3 -c "
import sys, re
s = sys.stdin.read()
# Extract the text field (5th string in tuple)
m = re.search(r'\"([^\"]+)\"', s)
if m:
    print(m.group(1))
else:
    print('(could not parse)')
" 2>/dev/null)
        # Extract timestamp (10-digit unix timestamp)
        TS=$(echo "$RESULT" | grep -oP '(?<=, )\d{10}(?= \[)' | head -1)
        
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

echo "── Feed: $TOPIC ──"
