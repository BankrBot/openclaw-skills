#!/bin/bash
# Cancel a pending game (only creator can cancel, only while pending)

GAME_ID=$1

if [ -z "$GAME_ID" ]; then
  echo "Usage: $0 <gameId>"
  exit 1
fi

SCRIPT_DIR="$(dirname "$0")"
CONTRACT="0x8f2E6F1f346Ca446c9c9DaCdF00Ab64a4a24CA06"

CAST="cast"
[ -f ~/.foundry/bin/cast ] && CAST=~/.foundry/bin/cast

# Verify game is pending
GAME_DATA=$($CAST call $CONTRACT "getGame(uint256)(address,address,uint256,uint256,uint256,uint256,uint8)" $GAME_ID --rpc-url https://mainnet.base.org 2>/dev/null)
STATUS=$(echo "$GAME_DATA" | sed -n '7p')

if [ "$STATUS" != "1" ]; then
  echo "Error: Can only cancel pending games (current status: $STATUS)"
  exit 1
fi

echo "Cancelling game #$GAME_ID..."

# Encode calldata
CALLDATA=$($CAST calldata "cancelGame(uint256)" $GAME_ID)

# Send transaction
RESULT=$(bash "$SCRIPT_DIR/lib/send-tx.sh" "$CONTRACT" "0" "$CALLDATA" "Agent Chess: Cancel game $GAME_ID")

if echo "$RESULT" | grep -q "TX_HASH="; then
  TX_HASH=$(echo "$RESULT" | grep "TX_HASH=" | cut -d= -f2)
  echo "✅ Game cancelled! Initial stake refunded."
  echo "TX: https://basescan.org/tx/$TX_HASH"
else
  echo "❌ Failed to cancel"
  echo "$RESULT"
  exit 1
fi
