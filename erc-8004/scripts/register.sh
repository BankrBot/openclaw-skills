#!/bin/bash
# ERC-8004 - Register agent on Ethereum Mainnet
# Usage: ./register.sh [--testnet]
#
# Full registration flow:
# 1. Create registration JSON
# 2. Upload to IPFS via Pinata
# 3. Register on-chain via Bankr
#
# Environment variables:
#   PINATA_JWT        - Required for IPFS upload
#   AGENT_NAME        - Agent display name
#   AGENT_DESCRIPTION - Agent description
#   AGENT_IMAGE       - Avatar URL
#   AGENT_WEBSITE     - Website URL
#   AGENT_A2A_ENDPOINT - A2A agent card URL
#   AGENT_MCP_ENDPOINT - MCP endpoint
#   AGENT_ENS         - ENS name

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Require Bankr CLI
if ! command -v bankr >/dev/null 2>&1; then
  echo "Error: Bankr CLI not found. Install with: bun install -g @bankr/cli" >&2
  exit 1
fi

# Require jq
if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq not found. Install with: apt-get install jq" >&2
  exit 1
fi

# Check for testnet flag
if [ "${1:-}" = "--testnet" ] || [ "${1:-}" = "-t" ]; then
  CHAIN="sepolia"
  CHAIN_ID=11155111
  IDENTITY_REGISTRY="0x8004A818BFB912233c491871b3d84c89A494BD9e"
  EXPLORER="sepolia.etherscan.io"
  echo "=== TESTNET MODE (Sepolia) ===" >&2
else
  CHAIN="ethereum"
  CHAIN_ID=1
  IDENTITY_REGISTRY="0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"
  EXPLORER="etherscan.io"
  echo "=== MAINNET MODE ===" >&2
fi

# Check requirements
if [ -z "${PINATA_JWT:-}" ]; then
  echo "Error: PINATA_JWT environment variable not set" >&2
  echo "Get your JWT from https://app.pinata.cloud/developers/api-keys" >&2
  exit 1
fi

echo "" >&2
echo "Chain: $CHAIN (ID: $CHAIN_ID)" >&2
echo "Registry: $IDENTITY_REGISTRY" >&2
echo "" >&2

# Temp file with guaranteed cleanup
REG_FILE="/tmp/agent-registration-$$.json"
trap 'rm -f "$REG_FILE"' EXIT

# Step 1: Create registration file
echo "Step 1/3: Creating registration file..." >&2
"$SCRIPT_DIR/create-registration.sh" "$REG_FILE" >/dev/null
echo "" >&2

# Step 2: Upload to IPFS
echo "Step 2/3: Uploading to IPFS..." >&2
IPFS_URI=$("$SCRIPT_DIR/upload-to-ipfs.sh" "$REG_FILE")
echo "" >&2

# Step 3: Register on-chain
echo "Step 3/3: Registering on-chain..." >&2

# Encode register(string) calldata safely via Node — URI passed via env, never shell-interpolated
CALLDATA=$(AGENT_URI="$IPFS_URI" node -e "
const uri = process.env.AGENT_URI;
if (!uri) { process.stderr.write('Error: AGENT_URI not set\n'); process.exit(1); }
const selector = '0xf2c298be';
const offset = '0000000000000000000000000000000000000000000000000000000000000020';
const encoded = Buffer.from(uri, 'utf8');
const len = encoded.length.toString(16).padStart(64, '0');
const data = encoded.toString('hex').padEnd(Math.ceil(encoded.length / 32) * 64, '0');
process.stdout.write(selector + offset + len + data + '\n');
")

echo "Calldata: $CALLDATA" >&2

# Build the transaction payload safely with jq
TX_PAYLOAD=$(jq -n \
  --arg to "$IDENTITY_REGISTRY" \
  --arg data "$CALLDATA" \
  --argjson chainId "$CHAIN_ID" \
  '{"to": $to, "data": $data, "value": "0", "chainId": $chainId}')

# Submit via Bankr
RESULT=$(bankr agent "Submit this transaction on $CHAIN: $TX_PAYLOAD" 2>/dev/null)

if echo "$RESULT" | grep -qE "$EXPLORER/tx/0x[a-fA-F0-9]{64}"; then
  TX_HASH=$(echo "$RESULT" | grep -oE "$EXPLORER/tx/0x[a-fA-F0-9]{64}" | grep -oE '0x[a-fA-F0-9]{64}' | head -1)

  echo "" >&2
  echo "======================================" >&2
  echo "=== REGISTRATION SUCCESSFUL! ===" >&2
  echo "======================================" >&2
  echo "" >&2
  echo "IPFS URI: $IPFS_URI" >&2
  echo "TX: https://$EXPLORER/tx/$TX_HASH" >&2
  echo "" >&2
  echo "Your agent ID will be visible in the transaction logs." >&2
  echo "View your agent at: https://www.8004.org" >&2
  echo "" >&2

  jq -n \
    --arg chain "$CHAIN" \
    --arg ipfsUri "$IPFS_URI" \
    --arg tx "$TX_HASH" \
    --arg registry "$IDENTITY_REGISTRY" \
    '{"success": true, "chain": $chain, "ipfsUri": $ipfsUri, "tx": $tx, "registry": $registry}'
else
  echo "" >&2
  echo "Registration submitted. Check transaction status:" >&2
  echo "$RESULT" >&2

  jq -n \
    --arg chain "$CHAIN" \
    --arg ipfsUri "$IPFS_URI" \
    --arg result "$RESULT" \
    '{"success": "pending", "chain": $chain, "ipfsUri": $ipfsUri, "result": $result}'
fi
