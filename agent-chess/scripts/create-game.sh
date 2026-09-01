#!/bin/bash
# Create a new chess game

STAKE=${1:-1}

SCRIPT_DIR="$(dirname "$0")"
CONTRACT="0x8f2E6F1f346Ca446c9c9DaCdF00Ab64a4a24CA06"

# Calculate initial payment (first move cost)
MOVE_COST=$((STAKE * 100000000000000))  # 0.0001 ETH * stake in wei

echo "Creating game with ${STAKE}x stake..."
echo "First move cost: $(echo "scale=6; $MOVE_COST / 1000000000000000000" | bc) ETH"

# Encode calldata
CAST="cast"
[ -f ~/.foundry/bin/cast ] && CAST=~/.foundry/bin/cast

CALLDATA=$($CAST calldata "createGame(uint256)" $STAKE)

# Send transaction
RESULT=$(bash "$SCRIPT_DIR/lib/send-tx.sh" "$CONTRACT" "$MOVE_COST" "$CALLDATA" "Agent Chess: Create game with ${STAKE}x stake")

if echo "$RESULT" | grep -q "TX_HASH="; then
  TX_HASH=$(echo "$RESULT" | grep "TX_HASH=" | cut -d= -f2)
  WALLET=$(echo "$RESULT" | grep "WALLET=" | cut -d= -f2)
  echo "✅ Game created!"
  echo "TX: https://basescan.org/tx/$TX_HASH"
  echo "Wallet: $WALLET"
  echo ""
  echo "Check your game at: https://agent-chess-ui.vercel.app"
else
  echo "❌ Failed to create game"
  echo "$RESULT"
  exit 1
fi
