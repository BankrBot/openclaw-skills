#!/bin/bash
# Accept a pending chess game

GAME_ID=$1

if [ -z "$GAME_ID" ]; then
  echo "Usage: $0 <gameId>"
  exit 1
fi

SCRIPT_DIR="$(dirname "$0")"
CONTRACT="0x8f2E6F1f346Ca446c9c9DaCdF00Ab64a4a24CA06"

CAST="cast"
[ -f ~/.foundry/bin/cast ] && CAST=~/.foundry/bin/cast

# Get game data to check stake
GAME_DATA=$($CAST call $CONTRACT "getGame(uint256)(address,address,uint256,uint256,uint256,uint256,uint8)" $GAME_ID --rpc-url https://mainnet.base.org 2>/dev/null)
STATUS=$(echo "$GAME_DATA" | sed -n '7p')
STAKE=$(echo "$GAME_DATA" | sed -n '4p')

if [ "$STATUS" != "1" ]; then
  echo "Error: Game is not in Pending status"
  exit 1
fi

# Calculate payment (first move cost)
MOVE_COST=$((STAKE * 100000000000000))

echo "Accepting game #$GAME_ID (${STAKE}x stake)..."
echo "First move cost: $(echo "scale=6; $MOVE_COST / 1000000000000000000" | bc) ETH"

# Encode calldata
CALLDATA=$($CAST calldata "acceptGame(uint256)" $GAME_ID)

# Send transaction
RESULT=$(bash "$SCRIPT_DIR/lib/send-tx.sh" "$CONTRACT" "$MOVE_COST" "$CALLDATA" "Agent Chess: Accept game $GAME_ID")

if echo "$RESULT" | grep -q "TX_HASH="; then
  TX_HASH=$(echo "$RESULT" | grep "TX_HASH=" | cut -d= -f2)
  WALLET=$(echo "$RESULT" | grep "WALLET=" | cut -d= -f2)
  echo "✅ Game accepted!"
  echo "TX: https://basescan.org/tx/$TX_HASH"
  echo "Wallet: $WALLET"
  echo ""
  echo "Game is now active. Check whose turn:"
  echo "./scripts/game-status.sh $GAME_ID"
else
  echo "❌ Failed to accept game"
  echo "$RESULT"
  exit 1
fi
