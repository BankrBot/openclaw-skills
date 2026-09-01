#!/bin/bash
# Check game status and whose turn it is

GAME_ID=$1

if [ -z "$GAME_ID" ]; then
  echo "Usage: $0 <gameId>"
  exit 1
fi

SKILL_DIR="$(dirname "$0")/.."
CONTRACT="0x8f2E6F1f346Ca446c9c9DaCdF00Ab64a4a24CA06"
RPC="https://mainnet.base.org"

# Get game data
GAME_DATA=$(cast call $CONTRACT "getGame(uint256)(address,address,uint256,uint256,uint256,uint256,uint8)" $GAME_ID --rpc-url $RPC 2>/dev/null)

if [ $? -ne 0 ]; then
  echo "Error: Failed to fetch game data"
  exit 1
fi

# Parse response
WHITE=$(echo "$GAME_DATA" | sed -n '1p')
BLACK=$(echo "$GAME_DATA" | sed -n '2p')
POT=$(echo "$GAME_DATA" | sed -n '3p')
STAKE=$(echo "$GAME_DATA" | sed -n '4p')
LAST_MOVE=$(echo "$GAME_DATA" | sed -n '5p')
MOVE_COUNT=$(echo "$GAME_DATA" | sed -n '6p')
STATUS=$(echo "$GAME_DATA" | sed -n '7p')

# Status names
declare -A STATUS_NAMES=(
  [0]="None"
  [1]="Pending"
  [2]="Active"
  [3]="WhiteWins"
  [4]="BlackWins"
  [5]="Draw"
  [6]="Cancelled"
)

STATUS_NAME=${STATUS_NAMES[$STATUS]:-"Unknown"}

# Determine whose turn
if [ "$STATUS" = "2" ]; then
  if [ $((MOVE_COUNT % 2)) -eq 0 ]; then
    CURRENT_TURN="white"
    TURN_ADDRESS=$WHITE
  else
    CURRENT_TURN="black"
    TURN_ADDRESS=$BLACK
  fi
else
  CURRENT_TURN="none"
  TURN_ADDRESS=""
fi

# Get my address (try Bankr config)
MY_ADDRESS=""
if [ -f ~/.clawdbot/skills/bankr/config.json ]; then
  # Would need to query Bankr for address
  :
fi

# Output
echo "=== Game #$GAME_ID ==="
echo "Status: $STATUS_NAME"
echo "White: $WHITE"
echo "Black: $BLACK"
echo "Pot: $(echo "scale=6; $POT / 1000000000000000000" | bc) ETH"
echo "Stake: ${STAKE}x"
echo "Moves: $MOVE_COUNT"

if [ "$STATUS" = "2" ]; then
  echo ""
  echo "Current turn: $CURRENT_TURN ($TURN_ADDRESS)"
  
  # Check timeout
  NOW=$(date +%s)
  TIMEOUT=$((LAST_MOVE + 86400))
  if [ $NOW -gt $TIMEOUT ]; then
    echo "⚠️  TIMEOUT: Can claim win!"
  else
    REMAINING=$((TIMEOUT - NOW))
    HOURS=$((REMAINING / 3600))
    MINS=$(((REMAINING % 3600) / 60))
    echo "Time remaining: ${HOURS}h ${MINS}m"
  fi
fi

# For scripting: output machine-readable status
if [ "$CURRENT_TURN" != "none" ]; then
  echo ""
  echo "TURN=$CURRENT_TURN"
  echo "TURN_ADDRESS=$TURN_ADDRESS"
fi
