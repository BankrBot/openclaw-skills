#!/bin/sh
# BuzzBD Token Intelligence Script
# Usage: buzzbd.sh <command> <contract_address> <chain>
# Commands: score, qualify, report, chains

set -e

DEXSCREENER_API="https://api.dexscreener.com/tokens/v1"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

usage() {
    echo "🐝 BuzzBD Token Intelligence"
    echo ""
    echo "Usage: buzzbd.sh <command> [args]"
    echo ""
    echo "Commands:"
    echo "  score   <address> <chain>   Score a token (0-100)"
    echo "  qualify <address> <chain>   Quick qualification check"
    echo "  report  <address> <chain>   Full intelligence report"
    echo "  chains                       List supported chains"
    echo ""
    echo "Chains: solana, ethereum, bsc"
    echo ""
    echo "Example:"
    echo "  buzzbd.sh score 7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr solana"
}

list_chains() {
    echo "🐝 BuzzBD Supported Chains"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  solana    | \$5,000 USDC  | Primary"
    echo "  ethereum  | \$7,500 USDC  | Cross-chain premium"
    echo "  bsc       | \$7,500 USDC  | Cross-chain premium"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

fetch_token() {
    ADDRESS="$1"
    CHAIN="$2"

    # Map chain names to DexScreener chain IDs
    case "$CHAIN" in
        solana|sol) DS_CHAIN="solana" ;;
        ethereum|eth) DS_CHAIN="ethereum" ;;
        bsc|bnb) DS_CHAIN="bsc" ;;
        *) echo "❌ Unsupported chain: $CHAIN"; exit 1 ;;
    esac

    # Fetch from DexScreener
    RESPONSE=$(curl -s "${DEXSCREENER_API}/${DS_CHAIN}/${ADDRESS}")

    if echo "$RESPONSE" | grep -q '"pairs":\[\]' 2>/dev/null || echo "$RESPONSE" | grep -q '"pairs":null' 2>/dev/null; then
        echo "❌ Token not found on DexScreener for chain: $CHAIN"
        echo "   Address: $ADDRESS"
        echo "   Verify the contract address and chain are correct."
        exit 1
    fi

    echo "$RESPONSE"
}

score_token() {
    ADDRESS="$1"
    CHAIN="$2"

    DATA=$(fetch_token "$ADDRESS" "$CHAIN")

    # Extract metrics from first pair (highest liquidity)
    MCAP=$(echo "$DATA" | python3 -c "
import sys, json
d = json.load(sys.stdin)
pairs = d if isinstance(d, list) else d.get('pairs', d.get('pair', []))
if isinstance(pairs, list) and len(pairs) > 0:
    p = pairs[0]
    print(p.get('marketCap', p.get('fdv', 0)) or 0)
else:
    print(0)
" 2>/dev/null || echo "0")

    LIQUIDITY=$(echo "$DATA" | python3 -c "
import sys, json
d = json.load(sys.stdin)
pairs = d if isinstance(d, list) else d.get('pairs', d.get('pair', []))
if isinstance(pairs, list) and len(pairs) > 0:
    p = pairs[0]
    liq = p.get('liquidity', {})
    print(liq.get('usd', 0) if isinstance(liq, dict) else 0)
else:
    print(0)
" 2>/dev/null || echo "0")

    VOLUME=$(echo "$DATA" | python3 -c "
import sys, json
d = json.load(sys.stdin)
pairs = d if isinstance(d, list) else d.get('pairs', d.get('pair', []))
if isinstance(pairs, list) and len(pairs) > 0:
    p = pairs[0]
    vol = p.get('volume', {})
    print(vol.get('h24', 0) if isinstance(vol, dict) else 0)
else:
    print(0)
" 2>/dev/null || echo "0")

    TOKEN_NAME=$(echo "$DATA" | python3 -c "
import sys, json
d = json.load(sys.stdin)
pairs = d if isinstance(d, list) else d.get('pairs', d.get('pair', []))
if isinstance(pairs, list) and len(pairs) > 0:
    bt = pairs[0].get('baseToken', {})
    print(bt.get('name', 'Unknown'))
else:
    print('Unknown')
" 2>/dev/null || echo "Unknown")

    TOKEN_SYMBOL=$(echo "$DATA" | python3 -c "
import sys, json
d = json.load(sys.stdin)
pairs = d if isinstance(d, list) else d.get('pairs', d.get('pair', []))
if isinstance(pairs, list) and len(pairs) > 0:
    bt = pairs[0].get('baseToken', {})
    print(bt.get('symbol', '???'))
else:
    print('???')
" 2>/dev/null || echo "???")

    # Calculate score
    SCORE=$(python3 -c "
mcap = float('${MCAP}')
liq = float('${LIQUIDITY}')
vol = float('${VOLUME}')

score = 0

# Market Cap (20 pts)
if mcap > 10000000: score += 20
elif mcap > 5000000: score += 16
elif mcap > 1000000: score += 12
elif mcap > 500000: score += 8
else: score += 4

# Liquidity (25 pts)
if liq > 500000: score += 25
elif liq > 200000: score += 20
elif liq > 100000: score += 15
elif liq > 50000: score += 8
else: score += 3

# Volume (20 pts)
if vol > 1000000: score += 20
elif vol > 500000: score += 16
elif vol > 100000: score += 12
elif vol > 50000: score += 6
else: score += 2

# Social/Age/Team estimated at midrange (35 pts)
# Full scoring requires manual verification
score += 17

print(score)
" 2>/dev/null || echo "0")

    # Determine category
    if [ "$SCORE" -ge 85 ]; then
        CATEGORY="HOT"
        EMOJI="🔥"
    elif [ "$SCORE" -ge 70 ]; then
        CATEGORY="Qualified"
        EMOJI="✅"
    elif [ "$SCORE" -ge 50 ]; then
        CATEGORY="Watch"
        EMOJI="👀"
    else
        CATEGORY="Skip"
        EMOJI="❌"
    fi

    # Listing fee
    case "$CHAIN" in
        solana|sol) FEE="5,000" ;;
        *) FEE="7,500" ;;
    esac

    echo "$SCORE|$CATEGORY|$EMOJI|$TOKEN_NAME|$TOKEN_SYMBOL|$MCAP|$LIQUIDITY|$VOLUME|$FEE"
}

cmd_score() {
    ADDRESS="$1"
    CHAIN="$2"
    RESULT=$(score_token "$ADDRESS" "$CHAIN")

    SCORE=$(echo "$RESULT" | cut -d'|' -f1)
    CATEGORY=$(echo "$RESULT" | cut -d'|' -f2)
    EMOJI=$(echo "$RESULT" | cut -d'|' -f3)
    NAME=$(echo "$RESULT" | cut -d'|' -f4)
    SYMBOL=$(echo "$RESULT" | cut -d'|' -f5)

    echo "🐝 BuzzBD Score: ${NAME} (${SYMBOL})"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Score: ${SCORE}/100 ${EMOJI} ${CATEGORY}"
    echo "  Chain: ${CHAIN}"
    echo "  Address: ${ADDRESS}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Note: Social metrics, token age, and team transparency"
    echo "require manual verification for full accuracy."
}

cmd_qualify() {
    ADDRESS="$1"
    CHAIN="$2"
    RESULT=$(score_token "$ADDRESS" "$CHAIN")

    SCORE=$(echo "$RESULT" | cut -d'|' -f1)
    CATEGORY=$(echo "$RESULT" | cut -d'|' -f2)
    LIQUIDITY=$(echo "$RESULT" | cut -d'|' -f7)
    NAME=$(echo "$RESULT" | cut -d'|' -f4)
    FEE=$(echo "$RESULT" | cut -d'|' -f9)

    LIQ_OK=$(python3 -c "print('YES' if float('${LIQUIDITY}') >= 100000 else 'NO')")

    echo "🐝 BuzzBD Qualification: ${NAME}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    if [ "$SCORE" -ge 70 ] && [ "$LIQ_OK" = "YES" ]; then
        echo "  ✅ QUALIFIED for SolCex listing"
        echo "  Score: ${SCORE}/100"
        echo "  Listing fee: \$${FEE} USDC"
        echo "  Contact: buzzbysolcex@gmail.com"
    else
        echo "  ❌ NOT QUALIFIED"
        echo "  Score: ${SCORE}/100 (need 70+)"
        echo "  Liquidity check: ${LIQ_OK} (need \$100K+)"
    fi
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

cmd_report() {
    ADDRESS="$1"
    CHAIN="$2"
    RESULT=$(score_token "$ADDRESS" "$CHAIN")

    SCORE=$(echo "$RESULT" | cut -d'|' -f1)
    CATEGORY=$(echo "$RESULT" | cut -d'|' -f2)
    EMOJI=$(echo "$RESULT" | cut -d'|' -f3)
    NAME=$(echo "$RESULT" | cut -d'|' -f4)
    SYMBOL=$(echo "$RESULT" | cut -d'|' -f5)
    MCAP=$(echo "$RESULT" | cut -d'|' -f6)
    LIQUIDITY=$(echo "$RESULT" | cut -d'|' -f7)
    VOLUME=$(echo "$RESULT" | cut -d'|' -f8)
    FEE=$(echo "$RESULT" | cut -d'|' -f9)

    MCAP_FMT=$(python3 -c "print(f'\${float(\"${MCAP}\"):,.0f}')")
    LIQ_FMT=$(python3 -c "print(f'\${float(\"${LIQUIDITY}\"):,.0f}')")
    VOL_FMT=$(python3 -c "print(f'\${float(\"${VOLUME}\"):,.0f}')")

    echo "🐝 BUZZBD INTELLIGENCE REPORT"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Token: ${NAME} (${SYMBOL})"
    echo "Chain: ${CHAIN}"
    echo "Contract: ${ADDRESS}"
    echo "Score: ${SCORE}/100 — ${EMOJI} ${CATEGORY}"
    echo ""
    echo "📊 BASE METRICS"
    echo "  Market Cap: ${MCAP_FMT}"
    echo "  Liquidity: ${LIQ_FMT}"
    echo "  24h Volume: ${VOL_FMT}"
    echo ""
    echo "📡 INTELLIGENCE SIGNALS"
    echo "  DexScreener: ✅ Data available"
    echo "  AIXBT Momentum: ⏳ Requires separate check"
    echo "  KOL Activity: ⏳ Requires separate check"
    echo ""
    echo "🎯 LISTING ASSESSMENT"
    if [ "$SCORE" -ge 70 ]; then
        echo "  Qualification: ✅ QUALIFIED"
        echo "  Listing Fee: \$${FEE} USDC"
    else
        echo "  Qualification: ❌ NOT QUALIFIED (score ${SCORE}, need 70+)"
    fi
    echo ""
    echo "📋 NEXT STEPS"
    if [ "$SCORE" -ge 85 ]; then
        echo "  → Immediate outreach recommended"
        echo "  → Contact: buzzbysolcex@gmail.com"
    elif [ "$SCORE" -ge 70 ]; then
        echo "  → Added to priority queue"
        echo "  → Contact: buzzbysolcex@gmail.com"
    elif [ "$SCORE" -ge 50 ]; then
        echo "  → Monitor for 48h — may improve"
    else
        echo "  → Does not meet criteria at this time"
    fi
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "BuzzBD by SolCex Exchange"
    echo "https://github.com/buzzbysolcex/buzz-bd-agent"
}

# Main
case "${1:-}" in
    score)
        [ -z "${2:-}" ] && { echo "❌ Missing contract address"; usage; exit 1; }
        [ -z "${3:-}" ] && { echo "❌ Missing chain"; usage; exit 1; }
        cmd_score "$2" "$3"
        ;;
    qualify)
        [ -z "${2:-}" ] && { echo "❌ Missing contract address"; usage; exit 1; }
        [ -z "${3:-}" ] && { echo "❌ Missing chain"; usage; exit 1; }
        cmd_qualify "$2" "$3"
        ;;
    report)
        [ -z "${2:-}" ] && { echo "❌ Missing contract address"; usage; exit 1; }
        [ -z "${3:-}" ] && { echo "❌ Missing chain"; usage; exit 1; }
        cmd_report "$2" "$3"
        ;;
    chains)
        list_chains
        ;;
    *)
        usage
        ;;
esac
