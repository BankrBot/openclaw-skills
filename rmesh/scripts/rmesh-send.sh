#!/bin/bash
# rmesh-send.sh — Smart router: auto-detect message type and route
# Usage: ./rmesh-send.sh --to <identifier> --message <text> [--type dm|broadcast|question]
#        ./rmesh-send.sh --broadcast --topic <topic> --message <text>

set -euo pipefail

SIGNA_BASE="https://www.signaagent.xyz"
NET_CONTRACT="0x00000000B24D62781dB359b07880a105cD0b64e6"
BASE_RPC="${BASE_RPC_URL:-https://mainnet.base.org}"

# Parse arguments
TO=""
MESSAGE=""
TYPE=""
TOPIC="general"
BROADCAST=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --to) TO="$2"; shift 2 ;;
        --message) MESSAGE="$2"; shift 2 ;;
        --type) TYPE="$2"; shift 2 ;;
        --topic) TOPIC="$2"; shift 2 ;;
        --broadcast) BROADCAST=true; shift ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

if [ -z "$MESSAGE" ]; then
    echo "❌ Missing --message"
    exit 1
fi

# Route based on type
if [ "$BROADCAST" = true ]; then
    # Broadcast to Net Protocol feed
    echo "📢 Broadcasting to feed: $TOPIC"
    echo "  Message: $MESSAGE"
    echo ""
    echo "  ℹ️  To broadcast on-chain, use:"
    echo "  cast send $NET_CONTRACT \"sendMessage(string,string,bytes)\" \"$MESSAGE\" \"$TOPIC\" 0x --rpc-url $BASE_RPC --private-key <key>"
    echo ""
    echo "  Or use Bankr:"
    echo "  @bankr submit transaction to $NET_CONTRACT with data \$(cast calldata \"sendMessage(string,string,bytes)\" \"$MESSAGE\" \"$TOPIC\" 0x) on chain 8453"
    exit 0
fi

if [ -z "$TO" ]; then
    echo "❌ Missing --to (or use --broadcast)"
    exit 1
fi

# Auto-detect type if not specified
if [ -z "$TYPE" ]; then
    # Simple heuristics
    if echo "$MESSAGE" | grep -qiE '\?$|what|how|why|when|where|who|which'; then
        TYPE="question"
    elif echo "$TO" | grep -qE '^@|^0x|\.eth$|\.base\.eth$'; then
        TYPE="dm"
    else
        TYPE="dm"
    fi
    echo "🔍 Auto-detected type: $TYPE"
fi

# Resolve the target
echo "🔍 Resolving: $TO"
RESOLVE_RESULT=$(curl -s "${SIGNA_BASE}/api/resolve?id=$(echo "$TO" | sed 's/@/%40/g')" 2>/dev/null)

if ! echo "$RESOLVE_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if d.get('ok') else 1)" 2>/dev/null; then
    echo "❌ Could not resolve: $TO"
    exit 1
fi

ADDRESS=$(echo "$RESOLVE_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['address'])" 2>/dev/null)
echo "  ✅ Resolved: $ADDRESS"
echo ""

# Route based on type
case $TYPE in
    dm)
        echo "📬 Routing: Signa DM"
        echo "  To send a DM, you need to sign with your wallet:"
        echo ""
        echo "  ./rmesh-send-signa.sh <your_private_key> $ADDRESS \"$MESSAGE\""
        echo ""
        echo "  Or use Bankr:"
        echo "  @bankr send a DM to $ADDRESS saying: $MESSAGE"
        ;;
    
    question)
        echo "🧠 Routing: Signa Brain"
        echo "  Asking the network..."
        echo ""
        
        BRAIN_RESULT=$(curl -s -X POST "${SIGNA_BASE}/api/brain" \
            -H "Content-Type: application/json" \
            -d "{\"goal\": $(python3 -c "import json; print(json.dumps('$MESSAGE'))")}" 2>/dev/null)
        
        ANSWER=$(echo "$BRAIN_RESULT" | python3 -c "
import sys, json
d = json.load(sys.stdin)
if d.get('ok'):
    print(f'Answer: {d.get(\"answer\", \"no answer\")}')
    tools = d.get('tools', [])
    if tools:
        print(f'Sources: {\", \".join([t.get(\"cap\",\"\") for t in tools])}')
else:
    print(f'Error: {d.get(\"error\", \"unknown\")}')
" 2>/dev/null)
        
        echo "  $ANSWER"
        ;;
    
    broadcast)
        echo "📢 Routing: Net Protocol"
        echo "  Topic: $TOPIC"
        echo "  To broadcast on-chain:"
        echo ""
        echo "  cast send $NET_CONTRACT \"sendMessage(string,string,bytes)\" \"$MESSAGE\" \"$TOPIC\" 0x --rpc-url $BASE_RPC --private-key <key>"
        ;;
    
    *)
        echo "❌ Unknown type: $TYPE"
        echo "  Valid types: dm, broadcast, question"
        exit 1
        ;;
esac
