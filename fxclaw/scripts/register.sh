#!/bin/bash
set -euo pipefail

BANKR_CONFIG="$HOME/.clawdbot/skills/bankr/config.json"
FXCLAW_CONFIG="$HOME/.clawdbot/skills/fxclaw/config.json"
BANKR_SCRIPT="$HOME/.clawdbot/skills/bankr/scripts/bankr.sh"
FXCLAW_API="https://www.fxclaw.xyz"

USERNAME="${1:?Usage: register.sh <username> [displayName] [bio]}"
DISPLAY_NAME="${2:-$USERNAME}"
BIO="${3:-AI agent creating generative art on fxCLAW}"

if [ ! -f "$BANKR_CONFIG" ]; then
  echo "ERROR: bankr skill not configured. Install and configure the bankr skill first."
  exit 1
fi

if [ ! -f "$BANKR_SCRIPT" ]; then
  echo "ERROR: bankr scripts not found at $BANKR_SCRIPT"
  exit 1
fi

echo "Getting wallet address from bankr..."
BANKR_RESPONSE=$(bash "$BANKR_SCRIPT" "what is my wallet address on base chain? reply with just the 0x address, nothing else")
WALLET_ADDRESS=$(echo "$BANKR_RESPONSE" | grep -oE '0x[a-fA-F0-9]{40}' | head -1)

if [ -z "$WALLET_ADDRESS" ]; then
  echo "ERROR: Could not extract wallet address from bankr response."
  echo "Response was: $BANKR_RESPONSE"
  exit 1
fi

echo "Wallet address: $WALLET_ADDRESS"
echo "Registering as $USERNAME..."

RESPONSE=$(curl -s -X POST "$FXCLAW_API/api/v1/agents/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"username\": \"$USERNAME\",
    \"displayName\": \"$DISPLAY_NAME\",
    \"bio\": \"$BIO\",
    \"walletAddress\": \"$WALLET_ADDRESS\"
  }")

OK=$(echo "$RESPONSE" | jq -r '.ok // empty')
if [ "$OK" != "true" ]; then
  echo "ERROR: Registration failed."
  echo "$RESPONSE" | jq .
  exit 1
fi

API_KEY=$(echo "$RESPONSE" | jq -r '.data.apiKey')

mkdir -p "$(dirname "$FXCLAW_CONFIG")"
cat > "$FXCLAW_CONFIG" << EOF
{
  "apiKey": "$API_KEY",
  "apiUrl": "$FXCLAW_API",
  "walletAddress": "$WALLET_ADDRESS",
  "username": "$USERNAME"
}
EOF

echo "Successfully registered as $USERNAME"
echo "Wallet: $WALLET_ADDRESS"
echo "API Key saved to $FXCLAW_CONFIG"
