#!/bin/bash
# Play a chess move

GAME_ID=$1
MOVE=$2

if [ -z "$GAME_ID" ] || [ -z "$MOVE" ]; then
  echo "Usage: $0 <gameId> <move>"
  echo "  move format: e2e4, g1f3, e7e8q (promotion)"
  echo "  or numeric: 796 (pre-encoded)"
  exit 1
fi

SCRIPT_DIR="$(dirname "$0")"
CONTRACT="0x8f2E6F1f346Ca446c9c9DaCdF00Ab64a4a24CA06"

# Check if move is already numeric
if [[ "$MOVE" =~ ^[0-9]+$ ]]; then
  MOVE_ENCODED=$MOVE
else
  # Parse algebraic move (e.g., e2e4 -> from=e2, to=e4)
  FROM=${MOVE:0:2}
  TO=${MOVE:2:2}
  PROMO=${MOVE:4:1}

  # Convert algebraic to square index (a1=0, h8=63)
  square_to_index() {
    local sq=$1
    local file=${sq:0:1}
    local rank=${sq:1:1}
    
    # File: a=0, b=1, ..., h=7
    local file_num=$(($(printf '%d' "'$file") - 97))
    # Rank: 1=0, 2=1, ..., 8=7
    local rank_num=$((rank - 1))
    
    echo $((rank_num * 8 + file_num))
  }

  FROM_IDX=$(square_to_index $FROM)
  TO_IDX=$(square_to_index $TO)

  # Promotion piece: n=1, b=2, r=3, q=4
  PROMO_NUM=0
  case $PROMO in
    n|N) PROMO_NUM=1 ;;
    b|B) PROMO_NUM=2 ;;
    r|R) PROMO_NUM=3 ;;
    q|Q) PROMO_NUM=4 ;;
  esac

  # Encode: from in bits 6-11, to in bits 0-5, promo in bits 12-15
  MOVE_ENCODED=$(( (FROM_IDX << 6) | TO_IDX | (PROMO_NUM << 12) ))
fi

echo "Move encoded: $MOVE_ENCODED"

# Get move cost from contract
CAST="cast"
[ -f ~/.foundry/bin/cast ] && CAST=~/.foundry/bin/cast

GAME_DATA=$($CAST call $CONTRACT "getGame(uint256)(address,address,uint256,uint256,uint256,uint256,uint8)" $GAME_ID --rpc-url https://mainnet.base.org 2>/dev/null)
STAKE=$(echo "$GAME_DATA" | sed -n '4p')
MOVE_COST=$((STAKE * 100000000000000))  # 0.0001 ETH * stake in wei

echo "Move cost: $(echo "scale=6; $MOVE_COST / 1000000000000000000" | bc) ETH"

# Encode calldata
CALLDATA=$($CAST calldata "playMove(uint256,uint16)" $GAME_ID $MOVE_ENCODED)

# Send transaction (Bankr preferred, fallback to cast)
echo "Submitting move..."
RESULT=$(bash "$SCRIPT_DIR/lib/send-tx.sh" "$CONTRACT" "$MOVE_COST" "$CALLDATA" "Agent Chess: Play move in game $GAME_ID")

if echo "$RESULT" | grep -q "TX_HASH="; then
  TX_HASH=$(echo "$RESULT" | grep "TX_HASH=" | cut -d= -f2)
  WALLET=$(echo "$RESULT" | grep "WALLET=" | cut -d= -f2)
  echo "✅ Move played successfully!"
  echo "TX: https://basescan.org/tx/$TX_HASH"
  echo "Wallet: $WALLET"
else
  echo "❌ Move failed"
  echo "$RESULT"
  exit 1
fi
