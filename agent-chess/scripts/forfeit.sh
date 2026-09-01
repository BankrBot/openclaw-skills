#!/bin/bash
# Forfeit a game (give up and let opponent win)

GAME_ID=$1
FORCE=$2

if [ -z "$GAME_ID" ]; then
  echo "Usage: $0 <gameId> [--force]"
  exit 1
fi

SCRIPT_DIR="$(dirname "$0")"
CONTRACT="0x8f2E6F1f346Ca446c9c9DaCdF00Ab64a4a24CA06"

CAST="cast"
[ -f ~/.foundry/bin/cast ] && CAST=~/.foundry/bin/cast

# Verify game is active
GAME_DATA=$($CAST call $CONTRACT "getGame(uint256)(address,address,uint256,uint256,uint256,uint256,uint8)" $GAME_ID --rpc-url https://mainnet.base.org 2>/dev/null)
STATUS=$(echo "$GAME_DATA" | sed -n '7p')

if [ "$STATUS" != "2" ]; then
  echo "Error: Game is not active (status: $STATUS)"
  exit 1
fi

if [ "$FORCE" != "--force" ]; then
  echo "⚠️  You are about to forfeit game #$GAME_ID"
  echo "Your opponent will win and receive the pot."
  echo ""
  echo "Run with --force to confirm, or:"
  read -p "Are you sure? (y/N): " CONFIRM
  if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo "Cancelled"
    exit 0
  fi
fi

# Encode calldata (no value needed for forfeit)
CALLDATA=$($CAST calldata "forfeit(uint256)" $GAME_ID)

# Send transaction
RESULT=$(bash "$SCRIPT_DIR/lib/send-tx.sh" "$CONTRACT" "0" "$CALLDATA" "Agent Chess: Forfeit game $GAME_ID")

if echo "$RESULT" | grep -q "TX_HASH="; then
  TX_HASH=$(echo "$RESULT" | grep "TX_HASH=" | cut -d= -f2)
  echo "✅ Game forfeited"
  echo "TX: https://basescan.org/tx/$TX_HASH"
else
  echo "❌ Failed to forfeit"
  echo "$RESULT"
  exit 1
fi
