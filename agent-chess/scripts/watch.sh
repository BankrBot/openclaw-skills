#!/bin/bash
# Watch a game and alert when it's your turn
# Useful for integrating with cron or background monitoring

GAME_ID=$1
MY_ADDRESS=$2
INTERVAL=${3:-60}  # Check every 60 seconds by default

if [ -z "$GAME_ID" ]; then
  echo "Usage: $0 <gameId> [myAddress] [intervalSeconds]"
  exit 1
fi

CONTRACT="0x8f2E6F1f346Ca446c9c9DaCdF00Ab64a4a24CA06"
RPC="https://mainnet.base.org"

# Try to get address from Bankr if not provided
if [ -z "$MY_ADDRESS" ]; then
  if [ -f ~/.clawdbot/skills/bankr/config.json ]; then
    API_KEY=$(jq -r '.apiKey' ~/.clawdbot/skills/bankr/config.json)
    if [ -n "$API_KEY" ]; then
      RESPONSE=$(curl -s -X GET "https://api.bankr.bot/agent/user" \
        -H "X-API-Key: $API_KEY")
      MY_ADDRESS=$(echo "$RESPONSE" | jq -r '.wallets.evm // empty')
    fi
  fi
fi

if [ -z "$MY_ADDRESS" ]; then
  echo "Error: Could not determine your address"
  echo "Provide it as second argument or configure Bankr"
  exit 1
fi

MY_ADDRESS_LOWER=$(echo "$MY_ADDRESS" | tr '[:upper:]' '[:lower:]')

echo "Watching game #$GAME_ID for address $MY_ADDRESS"
echo "Checking every ${INTERVAL}s..."
echo ""

LAST_STATUS=""

while true; do
  # Get game data
  GAME_DATA=$(cast call $CONTRACT "getGame(uint256)(address,address,uint256,uint256,uint256,uint256,uint8)" $GAME_ID --rpc-url $RPC 2>/dev/null)
  
  if [ $? -ne 0 ]; then
    echo "$(date): Error fetching game data"
    sleep $INTERVAL
    continue
  fi
  
  WHITE=$(echo "$GAME_DATA" | sed -n '1p' | tr '[:upper:]' '[:lower:]')
  BLACK=$(echo "$GAME_DATA" | sed -n '2p' | tr '[:upper:]' '[:lower:]')
  MOVE_COUNT=$(echo "$GAME_DATA" | sed -n '6p')
  STATUS=$(echo "$GAME_DATA" | sed -n '7p')
  
  # Check if game is still active
  if [ "$STATUS" != "2" ]; then
    case $STATUS in
      1) echo "$(date): Game is pending (waiting for opponent)" ;;
      3) echo "$(date): Game over - White wins!" ;;
      4) echo "$(date): Game over - Black wins!" ;;
      5) echo "$(date): Game over - Draw!" ;;
      6) echo "$(date): Game cancelled" ;;
      *) echo "$(date): Game status: $STATUS" ;;
    esac
    
    if [ "$STATUS" != "1" ] && [ "$STATUS" != "2" ]; then
      echo "Game has ended. Exiting watch."
      exit 0
    fi
    
    sleep $INTERVAL
    continue
  fi
  
  # Determine whose turn
  if [ $((MOVE_COUNT % 2)) -eq 0 ]; then
    TURN_ADDRESS=$WHITE
    TURN_COLOR="white"
  else
    TURN_ADDRESS=$BLACK
    TURN_COLOR="black"
  fi
  
  # Check if it's my turn
  if [ "$TURN_ADDRESS" = "$MY_ADDRESS_LOWER" ]; then
    CURRENT_STATUS="YOUR_TURN"
    if [ "$CURRENT_STATUS" != "$LAST_STATUS" ]; then
      echo ""
      echo "=========================================="
      echo "🚨 IT'S YOUR TURN! (playing as $TURN_COLOR)"
      echo "Game #$GAME_ID | Move $((MOVE_COUNT + 1))"
      echo "=========================================="
      echo ""
      echo "YOUR_TURN"  # Machine-readable output
    fi
  else
    CURRENT_STATUS="WAITING"
    if [ "$CURRENT_STATUS" != "$LAST_STATUS" ]; then
      echo "$(date): Waiting for opponent ($TURN_COLOR to move)"
    fi
  fi
  
  LAST_STATUS=$CURRENT_STATUS
  sleep $INTERVAL
done
