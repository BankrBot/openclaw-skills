#!/bin/bash
# Get the current board position as FEN string
# Useful for feeding to chess engines like Stockfish

GAME_ID=$1

if [ -z "$GAME_ID" ]; then
  echo "Usage: $0 <gameId>"
  exit 1
fi

CONTRACT="0x8f2E6F1f346Ca446c9c9DaCdF00Ab64a4a24CA06"
RPC="https://mainnet.base.org"

# Get moves
MOVES_RAW=$(cast call $CONTRACT "getGameMoves(uint256)(uint16[])" $GAME_ID --rpc-url $RPC 2>/dev/null)

if [ $? -ne 0 ]; then
  echo "Error: Failed to fetch moves"
  exit 1
fi

# Parse moves array - format is [num1, num2, ...]
MOVES=$(echo "$MOVES_RAW" | tr -d '[]' | tr ',' '\n' | tr -d ' ')

# Convert square index to algebraic
index_to_square() {
  local idx=$1
  local file=$((idx % 8))
  local rank=$((idx / 8))
  local file_char=$(printf "\\$(printf '%03o' $((97 + file)))")
  echo "${file_char}$((rank + 1))"
}

# Decode move
decode_move() {
  local move=$1
  local to=$((move & 63))
  local from=$(((move >> 6) & 63))
  local promo=$(((move >> 12) & 15))
  
  local from_sq=$(index_to_square $from)
  local to_sq=$(index_to_square $to)
  
  local promo_char=""
  case $promo in
    1) promo_char="n" ;;
    2) promo_char="b" ;;
    3) promo_char="r" ;;
    4) promo_char="q" ;;
  esac
  
  echo "${from_sq}${to_sq}${promo_char}"
}

# Build UCI move list
UCI_MOVES=""
for move in $MOVES; do
  if [ -n "$move" ] && [ "$move" != "0" ]; then
    UCI_MOVE=$(decode_move $move)
    UCI_MOVES="$UCI_MOVES $UCI_MOVE"
  fi
done

# Use chess.js via Node to convert to FEN (if available)
# Otherwise output UCI moves for manual processing

if command -v node &> /dev/null; then
  FEN=$(node -e "
    const { Chess } = require('chess.js');
    const chess = new Chess();
    const moves = '$UCI_MOVES'.trim().split(/\s+/).filter(m => m);
    for (const move of moves) {
      try {
        chess.move({ from: move.slice(0,2), to: move.slice(2,4), promotion: move[4] || undefined });
      } catch (e) {
        console.error('Invalid move:', move);
        process.exit(1);
      }
    }
    console.log(chess.fen());
  " 2>/dev/null)
  
  if [ $? -eq 0 ] && [ -n "$FEN" ]; then
    echo "$FEN"
    exit 0
  fi
fi

# Fallback: output starting position + moves in UCI format
echo "startpos moves$UCI_MOVES"
echo ""
echo "# Note: Install chess.js for FEN output:"
echo "#   npm install -g chess.js"
echo "# Or use UCI format with your chess engine:"
echo "#   position startpos moves$UCI_MOVES"
