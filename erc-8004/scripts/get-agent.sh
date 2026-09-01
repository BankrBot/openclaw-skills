#!/bin/bash
# ERC-8004 - Get agent info by ID
# Usage: ./get-agent.sh <agent-id> [--testnet]
# Example: ./get-agent.sh 123

set -euo pipefail

AGENT_ID="${1:?Usage: get-agent.sh <agent-id> [--testnet]}"

# Validate agent ID is a non-negative integer
if ! [[ "$AGENT_ID" =~ ^[0-9]+$ ]]; then
  echo "Error: agent-id must be a non-negative integer" >&2
  exit 1
fi

# Check for testnet flag
if [ "${2:-}" = "--testnet" ] || [ "${2:-}" = "-t" ]; then
  CHAIN_ID=11155111
  IDENTITY_REGISTRY="0x8004A818BFB912233c491871b3d84c89A494BD9e"
  # Public Sepolia RPC — no demo key required
  RPC_URL="https://rpc.sepolia.org"
  echo "=== TESTNET MODE (Sepolia) ===" >&2
else
  CHAIN_ID=1
  IDENTITY_REGISTRY="0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"
  RPC_URL="https://eth.llamarpc.com"
  echo "=== MAINNET MODE ===" >&2
fi

echo "" >&2
echo "Agent ID: $AGENT_ID" >&2
echo "Chain ID: $CHAIN_ID" >&2
echo "" >&2

# Build tokenURI calldata safely — agent ID passed via env to avoid injection
TOKEN_URI_DATA=$(AGENT_ID_VAL="$AGENT_ID" node -e "
const id = BigInt(process.env.AGENT_ID_VAL);
// tokenURI(uint256) selector: 0xc87b56dd
const selector = '0xc87b56dd';
const param = id.toString(16).padStart(64, '0');
process.stdout.write(selector + param + '\n');
")

RESPONSE=$(curl -s --fail -X POST "$RPC_URL" \
  -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"method\":\"eth_call\",\"params\":[{\"to\":\"$IDENTITY_REGISTRY\",\"data\":\"$TOKEN_URI_DATA\"},\"latest\"],\"id\":1}") || {
  echo "Error: RPC call failed" >&2
  exit 1
}

RESULT=$(echo "$RESPONSE" | jq -r '.result // empty')

if [ -z "$RESULT" ] || [ "$RESULT" = "0x" ]; then
  echo "Error: Agent $AGENT_ID not found or has no URI" >&2
  exit 1
fi

# Decode the ABI-encoded string — hex passed via env to avoid injection
URI=$(HEX_RESULT="$RESULT" node -e "
const hex = process.env.HEX_RESULT.slice(2);
if (hex.length < 128) { process.stderr.write('Error: response too short\n'); process.exit(1); }
// Skip offset (32 bytes), read length (32 bytes)
const len = parseInt(hex.slice(64, 128), 16);
if (isNaN(len) || len < 0) { process.stderr.write('Error: invalid string length\n'); process.exit(1); }
const dataHex = hex.slice(128, 128 + len * 2);
if (dataHex.length !== len * 2) { process.stderr.write('Error: truncated data\n'); process.exit(1); }
const uri = Buffer.from(dataHex, 'hex').toString('utf8');
process.stdout.write(uri + '\n');
")

echo "Agent URI: $URI" >&2

# Fetch profile content based on URI scheme
if [[ "$URI" == ipfs://* ]]; then
  CID="${URI#ipfs://}"
  echo "Fetching from IPFS..." >&2
  CONTENT=$(curl -s --fail "https://gateway.pinata.cloud/ipfs/$CID" 2>/dev/null \
    || curl -s --fail "https://ipfs.io/ipfs/$CID" 2>/dev/null \
    || echo "")

  if [ -n "$CONTENT" ] && echo "$CONTENT" | jq empty 2>/dev/null; then
    echo "" >&2
    echo "=== Agent Profile ===" >&2
    echo "$CONTENT" | jq . >&2
    echo ""
    echo "$CONTENT"
  else
    jq -n --arg agentId "$AGENT_ID" --arg uri "$URI" '{"agentId": $agentId, "uri": $uri}'
  fi
elif [[ "$URI" == https://* || "$URI" == http://* ]]; then
  echo "Fetching from HTTP..." >&2
  CONTENT=$(curl -s --fail "$URI" 2>/dev/null || echo "")

  if [ -n "$CONTENT" ] && echo "$CONTENT" | jq empty 2>/dev/null; then
    echo "" >&2
    echo "=== Agent Profile ===" >&2
    echo "$CONTENT" | jq . >&2
    echo ""
    echo "$CONTENT"
  else
    jq -n --arg agentId "$AGENT_ID" --arg uri "$URI" '{"agentId": $agentId, "uri": $uri}'
  fi
elif [[ "$URI" == data:* ]]; then
  echo "Decoding on-chain data URI..." >&2
  CONTENT=$(echo "${URI#data:application/json;base64,}" | base64 -d 2>/dev/null || echo "")

  if [ -n "$CONTENT" ] && echo "$CONTENT" | jq empty 2>/dev/null; then
    echo "" >&2
    echo "=== Agent Profile (on-chain) ===" >&2
    echo "$CONTENT" | jq . >&2
    echo ""
    echo "$CONTENT"
  else
    jq -n --arg agentId "$AGENT_ID" --arg uri "$URI" '{"agentId": $agentId, "uri": $uri}'
  fi
else
  jq -n --arg agentId "$AGENT_ID" --arg uri "$URI" '{"agentId": $agentId, "uri": $uri}'
fi
