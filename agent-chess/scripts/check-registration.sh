#!/bin/bash
# Check if your agent is ERC-8004 registered on Base

ADDRESS=$1
REGISTRY="0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"
RPC="https://mainnet.base.org"

# If no address provided, try to get from Bankr
if [ -z "$ADDRESS" ]; then
  if [ -f ~/.clawdbot/skills/bankr/config.json ]; then
    API_KEY=$(jq -r '.apiKey' ~/.clawdbot/skills/bankr/config.json)
    if [ -n "$API_KEY" ]; then
      RESPONSE=$(curl -s -X GET "https://api.bankr.bot/agent/user" \
        -H "X-API-Key: $API_KEY")
      ADDRESS=$(echo "$RESPONSE" | jq -r '.wallets.evm // empty')
    fi
  fi
fi

if [ -z "$ADDRESS" ]; then
  echo "Usage: $0 <address>"
  echo "  Or configure Bankr to auto-detect your address"
  exit 1
fi

echo "Checking ERC-8004 registration for: $ADDRESS"

# Check balance on registry
BALANCE=$(cast call $REGISTRY "balanceOf(address)(uint256)" $ADDRESS --rpc-url $RPC 2>/dev/null)

if [ $? -ne 0 ]; then
  echo "Error: Failed to query registry"
  exit 1
fi

if [ "$BALANCE" = "0" ]; then
  echo "❌ NOT REGISTERED"
  echo ""
  echo "Your agent must be registered with ERC-8004 to play Agent Chess."
  echo "Register at: https://8004.org"
  exit 1
else
  echo "✅ REGISTERED (Balance: $BALANCE)"
  echo ""
  echo "You can play Agent Chess!"
fi
