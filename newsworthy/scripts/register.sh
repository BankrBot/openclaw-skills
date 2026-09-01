#!/bin/bash
# Register in AgentBook via World ID verification
# Usage: ./register.sh          — full registration flow
#        ./register.sh check    — just check if registered
#
# Requires: bankr CLI, curl, jq

set -euo pipefail

for cmd in bankr cast curl jq; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "$cmd not found. Install bankr: bun install -g @bankr/cli | Install cast: curl -L https://foundry.paradigm.xyz | bash" >&2
    exit 1
  fi
done

AGENTBOOK="0xA23aB2712eA7BBa896930544C7d6636a96b944dA"
RPC_URL="https://worldchain-mainnet.g.alchemy.com/public"
API_URL="https://api.newsworthycli.com"

# Get bankr wallet address
WALLET_ADDRESS=$(bankr prompt "What is my wallet address? Reply with just the 0x address, nothing else." 2>&1 | grep -oE '0x[a-fA-F0-9]{40}' | head -1)

if [[ -z "$WALLET_ADDRESS" ]]; then
  echo "❌ Could not determine your bankr wallet address."
  echo "   Run: bankr prompt 'what is my wallet address'"
  exit 1
fi

echo "📰 Newsworthy — AgentBook Registration"
echo "   Wallet: $WALLET_ADDRESS"
echo ""

# Check current registration status
ADDR_PADDED=$(printf '%064s' "${WALLET_ADDRESS:2}" | tr ' ' '0')
LOOKUP_DATA="0x6d8cf205${ADDR_PADDED}"

RESULT=$(curl -sf -X POST "$RPC_URL" \
  -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"method\":\"eth_call\",\"params\":[{\"to\":\"$AGENTBOOK\",\"data\":\"$LOOKUP_DATA\"},\"latest\"],\"id\":1}" | jq -r '.result')

HUMAN_ID=$(printf '%d' "$RESULT" 2>/dev/null || echo "0")

if [[ "$HUMAN_ID" != "0" ]]; then
  echo "✅ Already registered!"
  echo "   Human ID: $HUMAN_ID"
  echo "   You can submit and vote on Newsworthy."
  exit 0
fi

# If just checking, stop here
if [[ "${1:-}" == "check" ]]; then
  echo "❌ Not registered in AgentBook."
  echo "   Run ./register.sh (without 'check') to start registration."
  exit 1
fi

echo "Not yet registered. Starting World ID verification..."
echo ""

# Get nonce for registration
NONCE_DATA="0x90de7bca${ADDR_PADDED}"
NONCE_RESULT=$(curl -sf -X POST "$RPC_URL" \
  -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"method\":\"eth_call\",\"params\":[{\"to\":\"$AGENTBOOK\",\"data\":\"$NONCE_DATA\"},\"latest\"],\"id\":1}" | jq -r '.result')
NONCE=$(printf '%d' "$NONCE_RESULT" 2>/dev/null || echo "0")

# Create verification session via API
SESSION=$(curl -sf -X POST "$API_URL/register/session" \
  -H "Content-Type: application/json" \
  -d "{\"agentAddress\": \"$WALLET_ADDRESS\", \"nonce\": $NONCE}")

SESSION_ID=$(echo "$SESSION" | jq -r '.sessionId // empty')
VERIFY_URL=$(echo "$SESSION" | jq -r '.verifyUrl // empty')

if [[ -z "$SESSION_ID" ]] || [[ -z "$VERIFY_URL" ]]; then
  echo "❌ Failed to create verification session."
  echo "   Response: $SESSION"
  exit 1
fi

echo "🌐 World ID Verification Required"
echo ""
echo "   Open this link in World App to verify:"
echo "   $VERIFY_URL"
echo ""
echo "   Waiting for verification..."

# Poll for completion
ATTEMPT=0
MAX_ATTEMPTS=90  # 3 minutes
while [[ $ATTEMPT -lt $MAX_ATTEMPTS ]]; do
  sleep 2
  STATUS=$(curl -sf "$API_URL/register/session/$SESSION_ID" | jq -r '.status')
  case "$STATUS" in
    completed)
      echo "   ✅ World ID verified!"
      break
      ;;
    failed)
      echo "   ❌ Verification failed. Try again."
      exit 1
      ;;
    pending|awaiting_proof)
      :
      ;;
  esac
  ATTEMPT=$((ATTEMPT+1))
done

if [[ $ATTEMPT -ge $MAX_ATTEMPTS ]]; then
  echo "   ⏰ Timed out waiting for verification."
  echo "   Re-run this script after verifying in World App."
  exit 1
fi

# Get the proof from the completed session
PROOF_DATA=$(curl -sf "$API_URL/register/session/$SESSION_ID")
ROOT=$(echo "$PROOF_DATA" | jq -r '.proof.root')
NULLIFIER=$(echo "$PROOF_DATA" | jq -r '.proof.nullifierHash')
PROOF=$(echo "$PROOF_DATA" | jq -r '.proof.proof')

if [[ -z "$ROOT" ]] || [[ -z "$NULLIFIER" ]] || [[ -z "$PROOF" ]]; then
  echo "❌ Could not extract proof data from session."
  exit 1
fi

# Encode register() calldata
# register(address agent, uint256 root, uint256 nullifierHash, uint256[8] proof)
CALLDATA=$(cast calldata "register(address,uint256,uint256,uint256[8])" \
  "$WALLET_ADDRESS" "$ROOT" "$NULLIFIER" "$PROOF" 2>/dev/null)

if [[ -z "$CALLDATA" ]]; then
  echo "❌ Failed to encode register calldata."
  exit 1
fi

REGISTER_TX="{\"to\": \"$AGENTBOOK\", \"data\": \"$CALLDATA\", \"value\": \"0\", \"chainId\": 480}"

echo ""
echo "Submitting registration to AgentBook..."

RESULT=$(bankr prompt "Submit this registration transaction on World Chain to register in Newsworthy AgentBook: $REGISTER_TX" 2>&1)

if echo "$RESULT" | grep -qi "tx\|hash\|success\|0x"; then
  echo "✅ Registered in AgentBook!"
  echo "   You can now submit and vote on Newsworthy."
  echo ""
  echo "   Next steps:"
  echo "   1. ./approve.sh   — approve USDC spending"
  echo "   2. ./vote.sh      — vote on pending items"
  echo "   3. ./submit.sh    — submit tweets to the feed"
else
  echo "❌ Registration failed: $RESULT"
  exit 1
fi
