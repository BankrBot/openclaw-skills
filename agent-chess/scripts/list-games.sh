#!/bin/bash
# List games (pending, active, or all)

FILTER=${1:-"pending"}  # pending, active, all
CONTRACT="0x8f2E6F1f346Ca446c9c9DaCdF00Ab64a4a24CA06"
RPC="https://mainnet.base.org"

# Get total game count
GAME_COUNT=$(cast call $CONTRACT "gameCount()(uint256)" --rpc-url $RPC 2>/dev/null)

if [ "$GAME_COUNT" = "0" ]; then
  echo "No games found"
  exit 0
fi

echo "=== Agent Chess Games ==="
echo "Filter: $FILTER"
echo "Total games: $GAME_COUNT"
echo ""

# Status codes
# 1 = Pending, 2 = Active, 3 = WhiteWins, 4 = BlackWins, 5 = Draw, 6 = Cancelled

for i in $(seq 1 $GAME_COUNT); do
  GAME_DATA=$(cast call $CONTRACT "getGame(uint256)(address,address,uint256,uint256,uint256,uint256,uint8)" $i --rpc-url $RPC 2>/dev/null)
  
  if [ $? -ne 0 ]; then
    continue
  fi
  
  WHITE=$(echo "$GAME_DATA" | sed -n '1p')
  BLACK=$(echo "$GAME_DATA" | sed -n '2p')
  POT=$(echo "$GAME_DATA" | sed -n '3p')
  STAKE=$(echo "$GAME_DATA" | sed -n '4p')
  STATUS=$(echo "$GAME_DATA" | sed -n '7p')
  
  # Apply filter
  case $FILTER in
    pending)
      [ "$STATUS" != "1" ] && continue
      ;;
    active)
      [ "$STATUS" != "2" ] && continue
      ;;
    finished)
      [ "$STATUS" -lt "3" ] && continue
      ;;
    all)
      ;;
    *)
      ;;
  esac
  
  # Status name
  case $STATUS in
    1) STATUS_NAME="PENDING" ;;
    2) STATUS_NAME="ACTIVE" ;;
    3) STATUS_NAME="WHITE_WINS" ;;
    4) STATUS_NAME="BLACK_WINS" ;;
    5) STATUS_NAME="DRAW" ;;
    6) STATUS_NAME="CANCELLED" ;;
    *) STATUS_NAME="UNKNOWN" ;;
  esac
  
  # Truncate addresses
  WHITE_SHORT="${WHITE:0:6}...${WHITE: -4}"
  BLACK_SHORT="${BLACK:0:6}...${BLACK: -4}"
  if [ "$BLACK" = "0x0000000000000000000000000000000000000000" ]; then
    BLACK_SHORT="(waiting)"
  fi
  
  # Format pot
  POT_ETH=$(echo "scale=6; $POT / 1000000000000000000" | bc)
  
  echo "Game #$i | $STATUS_NAME | ${STAKE}x stake | $POT_ETH ETH"
  echo "  White: $WHITE_SHORT"
  echo "  Black: $BLACK_SHORT"
  echo ""
done

echo "---"
echo "To accept a pending game: ./scripts/accept-game.sh <gameId>"
echo "To watch a game: https://agent-chess-ui.vercel.app/game/<gameId>"
