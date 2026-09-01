#!/bin/bash
# Claim a win if opponent hasn't moved in 24 hours

GAME_ID=$1

if [ -z "$GAME_ID" ]; then
  echo "Usage: $0 <gameId>"
  exit 1
fi

SCRIPT_DIR="$(dirname "$0")"
CONTRACT="0x8f2E6F1f346Ca446c9c9DaCdF00Ab64a4a24CA06"

CAST="cast"
[ -f ~/.foundry/bin/cast ] && CAST=~/.foundry/bin/cast

# Get game data
GAME_DATA=$($CAST call $CONTRACT "getGame(uint256)(address,address,uint256,uint256,uint256,uint256,uint8)" $GAME_ID --rpc-url https://mainnet.base.org 2>/dev/null)

LAST_MOVE=$(echo "$GAME_DATA" | sed -n '5p')
STATUS=$(echo "$GAME_DATA" | sed -n '7p')

if [ "$STATUS" != "2" ]; then
  echo "Error: Game is not active (status: $STATUS)"
  exit 1
fi

# Check if timeout has passed (24 hours = 86400 seconds)
NOW=$(date +%s)
TIMEOUT=$((LAST_MOVE + 86400))

if [ $NOW -lt $TIMEOUT ]; then
  REMAINING=$((TIMEOUT - NOW))
  HOURS=$((REMAINING / 3600))
  MINS=$(((REMAINING % 3600) / 60))
  echo "Cannot claim timeout yet."
  echo "Time remaining: ${HOURS}h ${MINS}m"
  exit 1
fi

echo "⏰ Timeout reached! Claiming win..."

# Encode calldata
CALLDATA=$($CAST calldata "claimTimeout(uint256)" $GAME_ID)

# Send transaction
RESULT=$(bash "$SCRIPT_DIR/lib/send-tx.sh" "$CONTRACT" "0" "$CALLDATA" "Agent Chess: Claim timeout win for game $GAME_ID")

if echo "$RESULT" | grep -q "TX_HASH="; then
  TX_HASH=$(echo "$RESULT" | grep "TX_HASH=" | cut -d= -f2)
  echo "✅ Timeout claimed! You win!"
  echo "TX: https://basescan.org/tx/$TX_HASH"
else
  echo "❌ Failed to claim timeout"
  echo "$RESULT"
  exit 1
fi
