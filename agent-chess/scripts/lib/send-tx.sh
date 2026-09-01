#!/bin/bash
# send-tx.sh - Send transaction via Bankr (preferred) or fallback to cast
# Usage: send-tx.sh <to> <value_wei> <calldata> <description>

TO=$1
VALUE=$2
CALLDATA=$3
DESCRIPTION=${4:-"Agent Chess transaction"}

# Try Bankr first
BANKR_API_KEY=""
if [ -f ~/.clawdbot/skills/bankr/config.json ]; then
  BANKR_API_KEY=$(jq -r '.apiKey // empty' ~/.clawdbot/skills/bankr/config.json 2>/dev/null)
fi

if [ -z "$BANKR_API_KEY" ] && [ -n "$BANKR_API_KEY_ENV" ]; then
  BANKR_API_KEY="$BANKR_API_KEY_ENV"
fi

if [ -n "$BANKR_API_KEY" ]; then
  echo "Using Bankr wallet..." >&2
  
  RESPONSE=$(curl -s -X POST https://api.bankr.bot/agent/submit \
    -H "Content-Type: application/json" \
    -H "X-API-Key: $BANKR_API_KEY" \
    -d "{
      \"transaction\": {
        \"to\": \"$TO\",
        \"chainId\": 8453,
        \"value\": \"$VALUE\",
        \"data\": \"$CALLDATA\"
      },
      \"description\": \"$DESCRIPTION\",
      \"waitForConfirmation\": true
    }")
  
  # Check for job ID (async flow)
  JOB_ID=$(echo "$RESPONSE" | jq -r '.jobId // empty')
  if [ -n "$JOB_ID" ]; then
    echo "Job submitted: $JOB_ID" >&2
    # Poll for completion
    for i in {1..30}; do
      sleep 2
      STATUS=$(curl -s -X GET "https://api.bankr.bot/agent/jobs/$JOB_ID" \
        -H "X-API-Key: $BANKR_API_KEY")
      JOB_STATUS=$(echo "$STATUS" | jq -r '.status // empty')
      if [ "$JOB_STATUS" = "completed" ]; then
        TX_HASH=$(echo "$STATUS" | jq -r '.result.transactionHash // empty')
        echo "TX_HASH=$TX_HASH"
        echo "WALLET=bankr"
        exit 0
      elif [ "$JOB_STATUS" = "failed" ]; then
        echo "Bankr job failed: $(echo "$STATUS" | jq -r '.error // "unknown"')" >&2
        break
      fi
    done
  fi
  
  # Check direct response
  SUCCESS=$(echo "$RESPONSE" | jq -r '.success // empty')
  TX_HASH=$(echo "$RESPONSE" | jq -r '.transactionHash // empty')
  
  if [ "$SUCCESS" = "true" ] && [ -n "$TX_HASH" ]; then
    echo "TX_HASH=$TX_HASH"
    echo "WALLET=bankr"
    exit 0
  fi
  
  echo "Bankr failed, trying fallback..." >&2
fi

# Fallback to cast with private key
PRIVATE_KEY=""

# Check common private key locations
if [ -f ~/.openclaw/farcaster-credentials.json ]; then
  PRIVATE_KEY=$(jq -r '.custodyPrivateKey // empty' ~/.openclaw/farcaster-credentials.json 2>/dev/null)
fi

if [ -z "$PRIVATE_KEY" ] && [ -n "$PRIVATE_KEY_ENV" ]; then
  PRIVATE_KEY="$PRIVATE_KEY_ENV"
fi

if [ -z "$PRIVATE_KEY" ] && [ -f ~/.agent-chess/private-key ]; then
  PRIVATE_KEY=$(cat ~/.agent-chess/private-key)
fi

if [ -z "$PRIVATE_KEY" ]; then
  echo "ERROR: No Bankr API key or private key found" >&2
  echo "Configure Bankr or set PRIVATE_KEY_ENV" >&2
  exit 1
fi

echo "Using fallback wallet (cast)..." >&2

# Find cast binary
CAST="cast"
if [ -f ~/.foundry/bin/cast ]; then
  CAST=~/.foundry/bin/cast
fi

# Convert wei to ether for cast
VALUE_ETH=$(echo "scale=18; $VALUE / 1000000000000000000" | bc)

TX_OUTPUT=$($CAST send "$TO" --value "${VALUE_ETH}ether" --data "$CALLDATA" \
  --rpc-url https://mainnet.base.org \
  --private-key "$PRIVATE_KEY" 2>&1)

if [ $? -eq 0 ]; then
  TX_HASH=$(echo "$TX_OUTPUT" | grep "transactionHash" | awk '{print $2}')
  echo "TX_HASH=$TX_HASH"
  echo "WALLET=fallback"
  exit 0
else
  echo "ERROR: Transaction failed" >&2
  echo "$TX_OUTPUT" >&2
  exit 1
fi
